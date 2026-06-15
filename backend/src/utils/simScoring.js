// backend/src/utils/simScoring.js
// Pure scoring functions — no DB calls. All inputs are plain data.
'use strict';

// Server-authoritative expected duration per step (seconds)
const EXPECTED_SECONDS = {
  1: 60, 2: 15, 3: 10, 4: 45, 5: 40,
  6: 50, 7: 120, 8: 90, 9: 90, 10: 15, 11: 30,
};

// Bone step target counts (anatomical maxima)
const BONE_TARGETS = { 6: 26, 7: 87, 8: 48, 9: 42 };
const BONE_TYPES   = { 6: 'rib', 7: 'dorsal', 8: 'ventral', 9: 'lateral' };

// Error class severity weights for accuracy_factor
const ERROR_WEIGHTS = {
  wrong_cut_path:      1.5,
  excess_flesh_damage: 1.0,
  missed_bone:         2.0,
};

const HINT_MULTIPLIER = { 0: 1.0, 1: 0.90, 2: 0.80 };

// Score weights per step — snapshot of STEP_DEFINITIONS; TOTAL_SCORE = 100
const SCORE_WEIGHTS = {
  1: 8, 2: 5, 3: 0, 4: 8, 5: 8,
  6: 10, 7: 18, 8: 15, 9: 15, 10: 5, 11: 8,
};
const TOTAL_SCORE = 100;

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

/**
 * Compute per-step score factors and earned score.
 *
 * @param {object} stepResult  - one item from request body step_results[]
 *   { step_id, error_count, time_spent_seconds, completed, errors[], tool_usage[] }
 * @param {object} boneData    - { dorsal, ventral, lateral } counts from bone_counts
 * @returns {object} { earnedScore, accuracyFactor, efficiencyFactor, qualityFactor, correctActions }
 */
function computeStepScore(stepResult, boneData) {
  const {
    step_id,
    error_count        = 0,
    time_spent_seconds = 0,
    errors             = [],
  } = stepResult;

  const scoreWeight = SCORE_WEIGHTS[step_id] ?? 0;

  // ── accuracy_factor ──────────────────────────────────────────────────────
  // Sum weighted errors from individual error records when available;
  // fall back to treating all errors as wrong_cut_path (weight 1.5).
  let weightedErrors = 0;
  if (errors.length > 0) {
    for (const e of errors) {
      weightedErrors += ERROR_WEIGHTS[e.class] ?? 1.0;
    }
  } else {
    weightedErrors = error_count * 1.5;
  }

  // correct_actions: server-computed per step type
  let correctActions;
  if      (step_id === 6) correctActions = boneData.rib     ?? 0;
  else if (step_id === 7) correctActions = boneData.dorsal  ?? 0;
  else if (step_id === 8) correctActions = boneData.ventral ?? 0;
  else if (step_id === 9) correctActions = boneData.lateral ?? 0;
  else if (step_id === 1) correctActions = 3; // targetCount for trim_fins
  else                    correctActions = 1; // all other single-action steps

  const totalActions  = correctActions + error_count;
  const accuracyFactor = clamp(1 - (weightedErrors / Math.max(totalActions, 1)), 0, 1);

  // ── efficiency_factor ────────────────────────────────────────────────────
  const expectedSeconds  = EXPECTED_SECONDS[step_id] ?? 60;
  const efficiencyFactor = clamp(expectedSeconds / Math.max(time_spent_seconds, 1), 0.70, 1.0);

  // ── quality_factor ───────────────────────────────────────────────────────
  let qualityFactor = 1.0;
  if (BONE_TARGETS[step_id]) {
    const boneType = BONE_TYPES[step_id];
    qualityFactor  = clamp((boneData[boneType] ?? 0) / BONE_TARGETS[step_id], 0, 1);
  }

  const baseScore   = Math.round(scoreWeight * accuracyFactor * efficiencyFactor * qualityFactor);
  const hintLevel   = stepResult.hint_level ?? 0;
  const hintPenalty = HINT_MULTIPLIER[hintLevel] ?? 1.0;
  const earnedScore = Math.max(0, Math.round(baseScore * hintPenalty));

  return {
    earnedScore,
    accuracyFactor:   Math.round(accuracyFactor   * 1000) / 1000,
    efficiencyFactor: Math.round(efficiencyFactor * 1000) / 1000,
    qualityFactor:    Math.round(qualityFactor    * 1000) / 1000,
    correctActions,
  };
}

/**
 * Compute session-level score from an array of per-step results.
 *
 * @param {Array<{ earnedScore: number }>} computedSteps
 * @returns {{ rawScore, scorePercent, grade, passed }}
 */
function computeSessionScore(computedSteps) {
  const rawScore     = computedSteps.reduce((sum, s) => sum + s.earnedScore, 0);
  const scorePercent = Math.round((rawScore / TOTAL_SCORE) * 100);

  const grade = scorePercent >= 90 ? 'A'
              : scorePercent >= 80 ? 'B'
              : scorePercent >= 70 ? 'C'
              : scorePercent >= 60 ? 'D' : 'F';

  return { rawScore, scorePercent, grade, passed: scorePercent >= 60 };
}

/**
 * Compute updated mastery score for one step.
 * Weights recent 3 attempts (60%) + all-time avg (40%) so improving
 * students see mastery rise quickly without erasing early struggles.
 *
 * @param {number[]} allAccuracies - all accuracy_factor values for this user+step,
 *   oldest first, newest last (must include the current attempt's value)
 * @returns {number} mastery score 0–100, rounded to 2 decimal places
 */
function computeMasteryScore(allAccuracies) {
  if (!allAccuracies.length) return 0;

  const allTimeAvg = allAccuracies.reduce((s, v) => s + v, 0) / allAccuracies.length;
  const recent     = allAccuracies.slice(-3);
  const recentAvg  = recent.reduce((s, v) => s + v, 0) / recent.length;

  return Math.round((recentAvg * 0.6 + allTimeAvg * 0.4) * 100 * 100) / 100;
}

module.exports = { computeStepScore, computeSessionScore, computeMasteryScore, SCORE_WEIGHTS, TOTAL_SCORE };
