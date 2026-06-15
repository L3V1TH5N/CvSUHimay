//file path: web/src/pages/dashboards/student/Simulations.jsx

import './Simulations.css';
import {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  Suspense,
  lazy,
} from "react";
import { createPortal } from "react-dom";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ArrowRight, Activity } from "lucide-react";
import axios from "axios";
import { AppContext } from "../../../context/AppContext";
import { useGLTF } from "../../../simulation/utils/useGLTFLocal";

const BangusDeboningSim = lazy(() =>
  import("../../../simulation/BangusDeboningSim")
);

const API_URL            = import.meta.env.VITE_API_URL || "http://localhost:4000";
const PREVIEW_MODEL_PATH      = "/models/bangus3.opt.glb";
const DAING_PREVIEW_MODEL_PATH  = "/models/BangusCUTTEDFIN.opt.glb";
const DAING2_PREVIEW_MODEL_PATH = "/models/DaingCuttedFins.opt.glb";

// ── Per-tab camera positions ──────────────────────────────────────────────────
// Edit DAING2_CAMERA to reposition the Daing · Cut preview.
// Bangus · Whole and Bangus · Fins Cut share DEFAULT_CAMERA.
const DEFAULT_CAMERA = { position: [3, 2, 5],  fov: 20 };
const DAING2_CAMERA  = { position: [3, 3, 5],  fov: 16 }; // ← change this

// ── Mastery contract ──────────────────────────────────────────────────────────
// mastery_score is the canonical 0–100 value from sim_mastery, server-computed
// as a weighted EMA of recent + all-time accuracy. MASTERY_THRESHOLD is the
// minimum value to count a step as "mastered" in the dashboard summary.
const MASTERY_THRESHOLD = 80;

// Steps tracked in the mastery roadmap. Step 3 (Place on Cutting Board) is
// excluded — its score_weight is 0; it's a navigation step, not a scored skill.
// Titles mirror STEP_DEFINITIONS in the simulation config — hardcoded here so
// the dashboard route doesn't pull the entire simulation bundle for labels.
const MASTERY_STEPS = [
  { id: 1,  title: "Trim Fins" },
  { id: 2,  title: "Wash the Bangus" },
  { id: 4,  title: "Dorsal Split" },
  { id: 5,  title: "Remove Gills & Organs" },
  { id: 6,  title: "Remove Rib Bones" },
  { id: 7,  title: "Dorsal Spines" },
  { id: 8,  title: "Ventral Spines" },
  { id: 9,  title: "Y-shaped Lateral Spines" },
  { id: 10, title: "Final Rinse" },
  { id: 11, title: "Quality Inspection" },
];
const MASTERY_STEPS_COUNT = MASTERY_STEPS.length;

const SIMULATION = {
  name: "Bangus (Milkfish) Deboning",
  description:
    "Master the complete bangus deboning process through interactive step-by-step guidance",
  difficulty: "Advanced",
};

// 8-step milkfish deboning procedure (Guevara et al., 1973, via
// Espejo-Hermes 1998) — matches the content in DeboningGuideFull.jsx.
const DEBONING_STEPS = [
  {
    title: "Trim fins and remove the anal fin",
    desc: "Trim all fins; cut around the anal fin base and pull forward to extract it with its attached bones.",
  },
  {
    title: "Wash the fish",
    desc: "Rinse with cold water before processing.",
  },
  {
    title: "Dorsal split — open like a butterfly",
    desc: "Cut along the back from tail to head, knife flat against the backbone, and open the fish flat.",
  },
  {
    title: "Remove gills and internal organs",
    desc: "Pull out gills and viscera, then rinse the body cavity.",
  },
  {
    title: "Pull rib bones and dorsal intermuscular spines",
    desc: "Use forceps to pull each rib bone, then slit the dorsal muscle dent and remove intermuscular spines head-to-tail.",
  },
  {
    title: "Remove ventral spines and lateral Y-spines",
    desc: "Slit and pull ventral spines, then extract Y-shaped spines along the lateral line. Feel for fragments after each pass.",
  },
  {
    title: "Final wash and inspect",
    desc: "Rinse with cold water, feel both sides for remaining bones,.",
  },
];

// Error class labels for the Performance Analysis card.
// Keys are snake_case as stored in error_breakdown.
const ERROR_LABELS = {
  wrong_cut_path:      "Wrong Cut Path",
  excess_flesh_damage: "Excess Flesh Damage",
  missed_bone:         "Missed Bone",
};
const ERROR_ADVICE = {
  wrong_cut_path:      "focus on angle and path alignment when cutting",
  excess_flesh_damage: "use lighter pressure along the bone edges",
  missed_bone:         "check the lateral line carefully before finishing each step",
};

// Normalizes DB error_class values regardless of casing or spacing style.
const normalizeErrorClass = (cls) =>
  (cls ?? "").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z_]/g, "");

// Returns a CSS variable color string for inline style — no Tailwind dark: pairs.
function getScoreColor(score) {
  if (score == null) return 'var(--color-fg-subtle)';
  if (score >= 90)   return 'var(--color-accent)';
  if (score >= 75)   return 'var(--color-accent)';
  if (score >= 60)   return '#d97706';
  return 'var(--color-error)';
}

// Three-tier visual mapping for mastery progress bars.
// Returns CSS var strings for inline style — no Tailwind class strings.
function getMasteryTier(score) {
  if (score == null)              return { label: "No data",       barColor: 'var(--color-surface-3)', textColor: 'var(--color-fg-subtle)' };
  if (score >= MASTERY_THRESHOLD) return { label: "Mastered",     barColor: 'var(--color-accent)',    textColor: 'var(--color-accent)'    };
  if (score >= 50)                return { label: "Developing",   barColor: '#d97706',                textColor: '#d97706'                };
  return                               { label: "Needs Practice", barColor: 'var(--color-error)',     textColor: 'var(--color-error)'     };
}

// Renders the bangus mesh inside the dashboard preview Canvas. Cloning the
// GLTF scene once via useMemo (not on every render) prevents geometry/material
// leaks when the parent re-renders due to fetch state or sim toggles.
function BangusPreviewModel({ modelPath, ...props }) {
  const { scene } = useGLTF(modelPath);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={cloned} {...props} />;
}

// Repositions the R3F camera when the active tab changes. Must live inside
// <Canvas> because useThree() only works within the R3F context.
function CameraSync({ position, fov }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...position);
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }, [camera, position, fov]);
  return null;
}

// Full-viewport overlay shown while the lazy sim chunk loads or while the
// student is exiting back to the dashboard. Uses CSS vars so it respects
// the active theme without Tailwind dark: class pairs.
function SimTransitionOverlay({ label }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6"
      style={{ background: 'var(--color-bg)' }}
    >
      <div
        className="w-20 h-20 rounded-full animate-spin"
        style={{ border: '5px solid var(--color-surface-3)', borderTopColor: 'var(--color-accent)' }}
      />
      <p style={{ color: 'var(--color-fg-muted)', fontFamily: 'var(--font-ui)', fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        {label}
      </p>
    </div>
  );
}

// ── SimHero ───────────────────────────────────────────────────────────────────

function SimHero({ loading, hasAttempts, bestScore, avgScore, masteredCount, attemptsCount, passRatePct, passedCount, recentSessions, lastPracticed, onStart }) {
  const headline = !hasAttempts
    ? <>{`Start your first `}<span className="it">simulation.</span></>
    : bestScore != null && bestScore >= 90
      ? <>Mastery <span className="it">achieved.</span></>
      : <>{`Continue `}<span className="it">practicing.</span></>;

  return (
    <section className="sim-hero">
      <div className="sim-hero-top">
        <div>
          <div className="sim-hero-eyebrow">Practice · Bangus Deboning</div>
          <h2>{headline}</h2>
        </div>
        <button onClick={onStart} className="sim-hero-cta">
          {hasAttempts ? "Practice Again" : "Start Simulation"} <ArrowRight size={14} />
        </button>
      </div>

      <p className="sim-hero-desc">
        {SIMULATION.description}
      </p>

      <div className="sim-hero-meta">
        FPT 311 · Fish Processing Technology · {SIMULATION.difficulty}
        {lastPracticed && (
          <span style={{ marginLeft: 16, opacity: 0.65 }}>Last practiced {lastPracticed}</span>
        )}
      </div>

      {loading ? (
        <div className="sim-hero-empty">
          <div style={{ height: 14, width: '60%', background: 'var(--color-surface-3)', marginBottom: 8 }} />
          <div style={{ height: 14, width: '40%', background: 'var(--color-surface-3)' }} />
        </div>
      ) : hasAttempts ? (
        <>
          <div className="sim-stats">
            <div className="sim-stat">
              <div className="sim-stat-label">Best Score</div>
              <div className="sim-stat-val" style={{ color: getScoreColor(bestScore) }}>
                {bestScore != null
                  ? <>{Math.round(bestScore)}<span className="sub">%</span></>
                  : '—'}
              </div>
              <div className="sim-stat-meta">all time</div>
            </div>
            <div className="sim-stat">
              <div className="sim-stat-label">Average</div>
              <div className="sim-stat-val">
                {avgScore != null
                  ? <>{Math.round(avgScore)}<span className="sub">%</span></>
                  : '—'}
              </div>
              <div className="sim-stat-meta">across {attemptsCount} run{attemptsCount !== 1 ? 's' : ''}</div>
            </div>
            <div className="sim-stat">
              <div className="sim-stat-label">Mastered Steps</div>
              <div
                className="sim-stat-val"
                style={{ color: masteredCount >= MASTERY_STEPS_COUNT ? 'var(--color-accent)' : 'var(--color-fg)' }}
              >
                {masteredCount}<span className="sub">/{MASTERY_STEPS_COUNT}</span>
              </div>
              <div className="sim-stat-meta">skills ≥{MASTERY_THRESHOLD}%</div>
            </div>
          </div>

          {recentSessions.length > 0 && (
            <div className="sim-sessions">
              <span className="sim-sessions-label">
                <Activity size={10} />
                Recent
              </span>
              <div className="sim-session-chips">
                {recentSessions.map((s, i) => {
                  const score = Math.round(Number(s.score_percent));
                  return (
                    <div key={s.sim_attempt_id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      {i > 0 && <span className="sim-session-sep">›</span>}
                      <span className="sim-session-chip" style={{ color: getScoreColor(score) }}>
                        {score}%
                      </span>
                    </div>
                  );
                })}
              </div>
              {passRatePct != null && passedCount != null && (
                <span className="sim-sessions-pass">
                  {passedCount}/{attemptsCount} passed
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="sim-hero-empty">
          <p>No simulation runs yet. Start your first run to track your score, time, and mastery per step.</p>
        </div>
      )}
    </section>
  );
}

// ── SimPerformance ────────────────────────────────────────────────────────────

function SimPerformance({ errorBreakdown, boneCompletion }) {
  const hasError = errorBreakdown.length > 0;
  const hasBone  = !!boneCompletion;
  if (!hasError && !hasBone) return null;

  return (
    <div className="sim-perf">
      <div className="sim-perf-head">
        <div className="sim-perf-head-title">Performance Analysis</div>
        <div className="sim-perf-head-sub">Where you're losing points</div>
      </div>
      <div className="sim-perf-grid" style={!hasError || !hasBone ? { gridTemplateColumns: '1fr' } : {}}>
        {hasError && (
          <div className="sim-perf-col">
            <div className="sim-perf-col-label">Error Breakdown</div>
            {errorBreakdown.map(e => {
              const key      = normalizeErrorClass(e.error_class);
              const label    = ERROR_LABELS[key] ?? e.error_class;
              const barColor = key === 'missed_bone'         ? 'var(--color-error)'
                             : key === 'excess_flesh_damage' ? '#d97706'
                             : '#ea580c';
              return (
                <div key={e.error_class} className="sim-bar-item">
                  <div className="sim-bar-row">
                    <span className="sim-bar-name">{label}</span>
                    <span className="sim-bar-count">{e.barPct}%</span>
                  </div>
                  <div className="sim-bar-track">
                    <div className="sim-bar-fill" style={{ width: `${e.barPct}%`, background: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {hasBone && (
          <div className="sim-perf-col">
            <div className="sim-perf-col-label">Bone Removal Accuracy</div>
            {[
              { key: 'dorsal_pct',  label: 'Dorsal'  },
              { key: 'ventral_pct', label: 'Ventral' },
              { key: 'lateral_pct', label: 'Lateral' },
            ].map(({ key, label }) => {
              const raw = boneCompletion[key];
              // Normalize 0–1 fractions to 0–100, matching passRatePct logic.
              const pct = raw == null ? null
                : Number(raw) > 1
                  ? Math.max(0, Math.min(100, Math.round(Number(raw))))
                  : Math.max(0, Math.min(100, Math.round(Number(raw) * 100)));
              const barColor = pct == null ? 'var(--color-surface-3)'
                : pct >= 80 ? 'var(--color-accent)'
                : pct >= 50 ? '#d97706'
                : 'var(--color-error)';
              return (
                <div key={key} className="sim-bar-item">
                  <div className="sim-bar-row">
                    <span className="sim-bar-name">{label}</span>
                    <span className="sim-bar-count">{pct == null ? '—' : `${pct}%`}</span>
                  </div>
                  <div className="sim-bar-track">
                    <div className="sim-bar-fill" style={{ width: `${pct ?? 0}%`, background: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MasteryBlock (rail) ────────────────────────────────────────────────────────

function MasteryBlock({ loading, error, masteryRows, masteryAvg, onRetry }) {
  const tier = getMasteryTier(masteryAvg);

  return (
    <div className="sim-rail-block">
      <div className="sim-mastery-header">
        <div className="sim-rail-label" style={{ marginBottom: 0 }}>Mastery Progress</div>
        {!loading && masteryAvg != null && (
          <div style={{ textAlign: 'right' }}>
            <div className="sim-mastery-avg">
              <span className="sim-mastery-avg-val" style={{ color: tier.textColor }}>{masteryAvg}</span>
              <span className="sim-mastery-avg-sub">%</span>
            </div>
            <div className="sim-mastery-tier-label">{tier.label}</div>
          </div>
        )}
      </div>

      {loading ? (
        <div>
          {[80, 60, 90, 70, 50].map((w, i) => (
            <div key={i} className="sim-skeleton-line" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <p style={{ fontSize: 12, color: 'var(--color-error)', marginBottom: 8, fontFamily: 'var(--font-ui)' }}>
            {error}
          </p>
          <button
            onClick={onRetry}
            style={{ fontSize: 10, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-ui)', fontWeight: 600 }}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="sim-mastery-tiles">
            {masteryRows.map(({ step_id, title, mastery }) => {
              const t   = getMasteryTier(mastery);
              const pct = mastery == null ? 0 : Math.max(0, Math.min(100, Math.round(mastery)));
              return (
                <div
                  key={step_id}
                  className="sim-mastery-tile"
                  title={`${title}: ${mastery == null ? 'No data' : `${pct}%`}`}
                  style={{ background: `color-mix(in srgb, ${t.barColor} 12%, var(--color-surface-2))` }}
                >
                  <span className="sim-mastery-tile-id" style={{ color: t.textColor }}>{step_id}</span>
                  <span className="sim-mastery-tile-val" style={{ color: t.textColor, opacity: 0.85 }}>
                    {mastery == null ? '—' : `${pct}%`}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="sim-mastery-legend">
            {[
              { color: 'var(--color-accent)',    label: 'Mastered'  },
              { color: '#d97706',                label: 'Developing'},
              { color: 'var(--color-error)',     label: 'Needs Work'},
              { color: 'var(--color-surface-3)', label: 'No data'  },
            ].map(({ color, label }) => (
              <div key={label} className="sim-mastery-legend-item">
                <span className="sim-mastery-legend-dot" style={{ background: color }} />
                <span className="sim-mastery-legend-label">{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

const Simulations = () => {
  const { token } = useContext(AppContext);
  // Single analytics envelope so loading/error/data move together. Prevents
  // the UI from rendering inconsistent slices (e.g. loading=false while data
  // is still stale from a previous fetch).
  const [analytics, setAnalytics] = useState({ loading: true, error: null, data: null });
  const [simActive,     setSimActive]     = useState(false);
  const [exiting,       setExiting]       = useState(false);
  const [activePreview, setActivePreview] = useState('bangus');

  // Fetches /api/sim/analytics/me — the canonical source of dashboard data.
  // Response shape (per backend/src/routes/simulation.js):
  //   { attempts_count, best_score, avg_score, pass_rate,
  //     step_analytics:        [{ step_id, step_key, avg_accuracy, avg_time_seconds, avg_errors, mastery_score }, …],
  //     error_breakdown:       [{ error_class, count }, …],
  //     bone_completion_avg:   { dorsal_pct, ventral_pct, lateral_pct },
  //     recent_sessions:       [{ sim_attempt_id, attempt_number, score_percent, grade, … }, …] }
  // For brand-new students every aggregate is null and the arrays are empty;
  // the UI degrades to a clean empty state in that case.
  const fetchAnalytics = useCallback(async () => {
    if (!token) return;
    setAnalytics(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await axios.get(`${API_URL}/api/sim/analytics/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnalytics({ loading: false, error: null, data: res.data ?? null });
    } catch (err) {
      console.error("Failed to load simulation analytics:", err);
      setAnalytics({
        loading: false,
        error: err?.response?.data?.error ?? "Failed to load analytics",
        data: null,
      });
    }
  }, [token]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  // Derived display values. Memoized on analytics.data so unrelated state
  // changes (e.g. simActive toggling the overlay) don't recompute the rows.
  const {
    attemptsCount,
    bestScore,
    avgScore,
    masteryRows,
    masteredCount,
    masteryAvg,
    hasAttempts,
    recentSessions,
    errorBreakdown,
    boneCompletion,
    passRatePct,
    passedCount,
    topError,
    lastPracticed,
  } = useMemo(() => {
    const d = analytics.data ?? {};

    // Build a step_id → step_analytics row lookup so order is driven by
    // MASTERY_STEPS (display order), not by SQL ordering.
    const stepMap = Object.fromEntries(
      (d.step_analytics ?? []).map(s => [s.step_id, s])
    );

    const rows = MASTERY_STEPS.map(({ id, title }) => {
      const row = stepMap[id];
      // sim_mastery.mastery_score is DECIMAL(5,2) — mysql2 may return it as a
      // string depending on driver config. Number() normalizes both.
      const raw = row?.mastery_score;
      return {
        step_id: id,
        title,
        mastery: raw == null ? null : Number(raw),
      };
    });

    const scored = rows.filter(r => r.mastery != null);
    const avg = scored.length
      ? Math.round(scored.reduce((s, r) => s + r.mastery, 0) / scored.length)
      : null;
    const mastered = rows.filter(
      r => r.mastery != null && r.mastery >= MASTERY_THRESHOLD
    ).length;
    const attempts = Number(d.attempts_count ?? 0);

    // Recent sessions — take the 6 most recent (API returns newest-first),
    // then reverse so the timeline reads left (oldest) → right (newest).
    const sessions = d.recent_sessions ?? [];
    const recentSessions = [...sessions].slice(0, 6).reverse();

    // Error breakdown — bar width and label both reflect each type's share of
    // total errors so bars sum to 100% and the label reads as a true percentage.
    const errors = d.error_breakdown ?? [];
    const totalErrCnt = errors.reduce((s, e) => s + Number(e.count), 0) || 1;
    const errorBreakdown = errors.map(e => ({
      ...e,
      count:  Number(e.count),
      barPct: Math.round((Number(e.count) / totalErrCnt) * 100),
    }));
    const topError = errors.reduce(
      (max, e) => Number(e.count) > Number(max?.count ?? 0) ? e : max,
      null
    );

    const boneCompletion = d.bone_completion_avg ?? null;

    // pass_rate may come as 0–100 or 0–1 depending on driver version; normalise.
    const rawPassRate = d.pass_rate == null ? null : Number(d.pass_rate);
    const passRatePct = rawPassRate == null ? null
      : rawPassRate > 1 ? Math.round(rawPassRate)
      : Math.round(rawPassRate * 100);
    const passedCount = passRatePct != null && attempts > 0
      ? Math.round((passRatePct / 100) * attempts)
      : null;

    // "Last practiced X days ago" derived from the most recent session timestamp.
    const lastPracticed = (() => {
      const ts = sessions[0]?.created_at ?? sessions[0]?.started_at ?? null;
      if (!ts) return null;
      const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
      if (diff === 0) return "today";
      if (diff === 1) return "yesterday";
      return `${diff} days ago`;
    })();

    return {
      attemptsCount: attempts,
      bestScore:     d.best_score == null ? null : Number(d.best_score),
      avgScore:      d.avg_score  == null ? null : Number(d.avg_score),
      masteryRows:   rows,
      masteredCount: mastered,
      masteryAvg:    avg,
      hasAttempts:   attempts > 0,
      recentSessions,
      errorBreakdown,
      boneCompletion,
      passRatePct,
      passedCount,
      topError,
      lastPracticed,
    };
  }, [analytics.data]);

  // Launches the live simulation in a body-level portal overlay.
  const handleStart = useCallback(() => setSimActive(true), []);

  // Persists a fully completed run only. Incomplete exits are discarded — no DB writes.
  // Returns: { ok, partial }
  //   ok=true,  partial=false → both POSTs succeeded
  //   ok=true,  partial=true  → /api/attempts ok, /api/sim/sessions failed
  //   ok=false                → /api/attempts failed (nothing persisted)
  const handleSubmit = useCallback(async (sessionData) => {
    if (!sessionData?.completed) return { ok: true, partial: false };
    const headers = { Authorization: `Bearer ${token}` };
    const { sim_session, ...attemptPayload } = sessionData ?? {};

    let attemptOk   = false;
    let partial     = false;
    let attemptId   = null;
    let serverScore = null;

    try {
      const res = await axios.post(`${API_URL}/api/attempts`, attemptPayload, { headers });
      attemptId = res?.data?.id ?? res?.data?.attempt?.id ?? null;
      attemptOk = true;
    } catch (err) {
      console.error("Failed to save attempt:", err?.response?.data ?? err?.message);
      return { ok: false, partial: false };
    }

    if (attemptId && sim_session) {
      try {
        const simRes = await axios.post(
          `${API_URL}/api/sim/sessions`,
          { attempt_id: attemptId, ...sim_session },
          { headers }
        );
        serverScore = simRes?.data?.score_percent ?? null;
      } catch (err) {
        console.error("Failed to save sim session detail:", err?.response?.data ?? err?.message);
        partial = true;
      }
    }

    return { ok: attemptOk, partial, serverScore };
  }, [token]);

  // Pure navigation. No save logic. Refreshes analytics (which drives all
  // dashboard cards, including mastery) so the new run shows up immediately.
  const handleExitNavigate = useCallback(async () => {
    setExiting(true);
    await fetchAnalytics();
    setSimActive(false);
    setExiting(false);
  }, [fetchAnalytics]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="min-h-full">
        <div className="px-8 lg:px-10 py-8 lg:py-10">

          {/* Page header */}
          <header className="sim-ph">
            <div>
              <h1 className="sim-ph-title">Bangus <span className="it">Simulation.</span></h1>
              <p className="sim-ph-sub">
                Interactive 3D deboning practice — scored on yield, pin-bone retention, and time
              </p>
            </div>
          </header>

          {/* Two-column layout */}
          <div className="sim-layout">

            {/* ── Main column ── */}
            <main>

              {/* Hero — CTA + run stats (or empty state while loading) */}
              <SimHero
                loading={analytics.loading}
                hasAttempts={hasAttempts}
                bestScore={bestScore}
                avgScore={avgScore}
                masteredCount={masteredCount}
                attemptsCount={attemptsCount}
                passRatePct={passRatePct}
                passedCount={passedCount}
                recentSessions={recentSessions}
                lastPracticed={lastPracticed}
                onStart={handleStart}
              />

              {/* 3D preview canvas */}
              <div className="sim-canvas-block">
                <div className="sim-canvas-head">
                  {hasAttempts ? (
                    // Three model tabs — only unlocked after first completed run.
                    <div className="sim-preview-tabs">
                      <button
                        className={`sim-preview-tab${activePreview === 'bangus' ? ' active' : ''}`}
                        onClick={() => setActivePreview('bangus')}
                      >
                        Bangus · Whole
                      </button>
                      <button
                        className={`sim-preview-tab${activePreview === 'daing' ? ' active' : ''}`}
                        onClick={() => setActivePreview('daing')}
                      >
                        Bangus · Fins Cut
                      </button>
                      <button
                        className={`sim-preview-tab${activePreview === 'daing2' ? ' active' : ''}`}
                        onClick={() => setActivePreview('daing2')}
                      >
                        Daing · Cut
                      </button>
                    </div>
                  ) : (
                    <span className="sim-canvas-title">Bangus · 3D Preview</span>
                  )}
                  <span className="sim-canvas-tag">{SIMULATION.difficulty}</span>
                </div>
                <div className="sim-canvas-wrap">
                  {simActive ? (
                    // Skip rendering the preview Canvas while the live sim is
                    // running in the portal above — keeps the GPU free.
                    <div className="sim-canvas-placeholder">Simulation in progress…</div>
                  ) : (
                    <>
                      <Canvas camera={DEFAULT_CAMERA} dpr={[1, 1.5]}>
                        <Suspense fallback={null}>
                          <CameraSync
                            position={activePreview === 'daing2' ? DAING2_CAMERA.position : DEFAULT_CAMERA.position}
                            fov={activePreview === 'daing2' ? DAING2_CAMERA.fov : DEFAULT_CAMERA.fov}
                          />
                          <ambientLight intensity={2.5} />
                          <directionalLight position={[8, 12, 8]}  intensity={1.8} />
                          <directionalLight position={[0, 10, 12]} intensity={1.2} />
                          <directionalLight position={[12, 8, 0]}  intensity={0.8} />
                          <directionalLight position={[0, 8, -12]} intensity={0.6} />
                          <BangusPreviewModel
                            modelPath={
                              activePreview === 'daing'  ? DAING_PREVIEW_MODEL_PATH  :
                              activePreview === 'daing2' ? DAING2_PREVIEW_MODEL_PATH :
                              PREVIEW_MODEL_PATH
                            }
                            position={[0, 0.1, 0]}
                            scale={3.6}
                            rotation={[0, Math.PI / 5, 0]}
                          />
                          <OrbitControls
                            enablePan={false}
                            enableZoom
                            minDistance={2}
                            maxDistance={8}
                            autoRotate
                            autoRotateSpeed={2}
                          />
                        </Suspense>
                      </Canvas>
                      <span className="sim-canvas-hint">Drag to rotate · Scroll to zoom</span>
                    </>
                  )}
                </div>
              </div>

              {/* Performance analysis — only shown once the student has attempt data */}
              {!analytics.loading && hasAttempts && (errorBreakdown.length > 0 || boneCompletion) && (
                <div style={{ marginTop: 10 }}>
                  <SimPerformance errorBreakdown={errorBreakdown} boneCompletion={boneCompletion} />
                </div>
              )}

              {/* Sequential mastery approach */}
              <div style={{ marginTop: 10 }}>
                <div className="sim-approach">
                  <div className="sim-approach-title">Sequential Mastery Approach</div>
                  <p className="sim-approach-desc">
                    Complete each deboning stage correctly before advancing — this mirrors real lab conditions and builds procedural memory.
                  </p>
                  <div className="sim-approach-bullets">
                    <div className="sim-approach-bullet">
                      <span className="sim-approach-dot">·</span>
                      <span>Immediate feedback on technique and positioning</span>
                    </div>
                    <div className="sim-approach-bullet">
                      <span className="sim-approach-dot">·</span>
                      <span>Repeated guided practice builds muscle memory</span>
                    </div>
                    <div className="sim-approach-bullet">
                      <span className="sim-approach-dot">·</span>
                      <span>Aim for {MASTERY_THRESHOLD}%+ per step to demonstrate mastery</span>
                    </div>
                  </div>
                </div>
              </div>

            </main>

            {/* ── Right rail ── */}
            <aside className="sim-rail">

              <MasteryBlock
                loading={analytics.loading}
                error={analytics.error}
                masteryRows={masteryRows}
                masteryAvg={masteryAvg}
                masteredCount={masteredCount}
                onRetry={fetchAnalytics}
              />

              <div className="sim-rail-block">
                <div className="sim-rail-label">Deboning Procedure</div>
                <p style={{ fontSize: 13, color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)', marginBottom: 14, lineHeight: 1.5 }}>
                  Canonical milkfish deboning sequence
                </p>
                <ol className="sim-procedure-list">
                  {DEBONING_STEPS.map(({ title, desc }, i) => (
                    <li key={title} className="sim-procedure-item">
                      <span className="sim-procedure-num">{i + 1}</span>
                      <div>
                        <div className="sim-procedure-title">{title}</div>
                        <div className="sim-procedure-desc">{desc}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

            </aside>
          </div>
        </div>
      </div>

      {/* Full-viewport sim overlay — portaled to body so it escapes the
          dashboard sidebar/header chrome. Dashboard stays mounted underneath
          so scroll position and fetched stats survive the round trip. */}
      {(simActive || exiting) &&
        createPortal(
          <div className="fixed inset-0 z-50" style={{ background: 'var(--color-bg)' }}>
            {exiting ? (
              <SimTransitionOverlay label="Returning to dashboard…" />
            ) : (
              <Suspense fallback={<SimTransitionOverlay label="Loading simulation…" />}>
                <BangusDeboningSim onSubmit={handleSubmit} onExit={handleExitNavigate} />
              </Suspense>
            )}
          </div>,
          document.body
        )}
    </>
  );
};

export default Simulations;
