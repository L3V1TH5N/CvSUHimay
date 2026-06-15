import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { BarChart3 } from "lucide-react";
import SectionHead    from "./shared/SectionHead";
import StatCard       from "./shared/StatCard";
import { getCSSVar, fmtSeconds, scoreBadge } from "./shared/chartHelpers";

const SCORE_BUCKETS = Array.from({ length: 10 }, (_, i) => i * 10);

const ERROR_COLS = [
  { key: "wrong_cut_path",      label: "Wrong Cut" },
  { key: "excess_flesh_damage", label: "Excess Flesh" },
  { key: "missed_bone",         label: "Missed Bone" },
];

const ERROR_MODALS = {
  wrong_cut_path: {
    title: "Wrong Cut Path",
    description: "Number of times a student's gesture fell outside the acceptable spatial or orientation tolerance for the current step.",
    purpose: "Measures procedural positioning accuracy — whether students know WHERE to cut.",
    guide: "High counts on dorsal or rib steps indicate students need a re-demonstration of knife angle and starting position. Check the Step Difficulty table to see which steps have the highest wrong-cut rates.",
  },
  excess_flesh_damage: {
    title: "Excess Flesh Damage",
    description: "Number of times a student's cut removed more flesh than the step's allowed extent.",
    purpose: "Measures how controlled and precise the cuts are.",
    guide: "Consistently high counts suggest students are rushing or applying too much force. Target remediation at the specific steps shown in the Error Heatmap.",
  },
  missed_bone: {
    title: "Missed Bone",
    description: "Number of bone extraction steps that were skipped or incompletely performed, detected at end-of-session.",
    purpose: "The most critical error class — missed bones directly affect the product quality and are the central learning outcome of the course.",
    guide: "Any avg-per-session value above 0 warrants direct remediation. Cross-reference with the Step Difficulty table — missed_bone errors are concentrated in the lateral Y-spine and rib steps.",
  },
};

const SIM_SECTION_MODALS = {
  scoreDistribution: {
    title: "Score Distribution",
    description: "A histogram of all simulation session scores grouped into 10-point buckets (0–10%, 10–20%, etc.).",
    purpose: "Shows where the class clusters — whether most students are passing, borderline, or failing.",
    guide: "A bimodal distribution (peaks at low and high ends) means the class is split between strong and weak students. A left-heavy distribution means most students are failing and broad intervention is needed.",
  },
  avgTimePerStep: {
    title: "Avg Time Per Step",
    description: "Average time students spend on each of the 11 deboning steps.",
    purpose: "Identifies which steps slow students down the most.",
    guide: "Steps with long average times are either procedurally complex or poorly understood. Cross-reference with Step Difficulty — a slow step with high errors points to content that needs re-teaching.",
  },
  stepDifficulty: {
    title: "Step Difficulty",
    description: "Average error count and accuracy factor per step, across all completed sessions.",
    purpose: "Ranks steps by how much students struggle with them.",
    guide: "Focus remediation on the top-3 highest average-error steps. Accuracy below 60% on any step signals a gap in procedure understanding for that specific action.",
  },
  errorHeatmap: {
    title: "Error Heatmap",
    description: "A matrix of total errors by step (rows) and error class (columns): Wrong Cut, Excess Flesh, Missed Bone.",
    purpose: "Shows which step–error combinations are the most common.",
    guide: "Red cells are the priority. Missed Bone errors in lateral steps (Step 08-09) are the most critical — they are the core learning outcome of the course.",
  },
  errorBreakdown: {
    title: "Error Breakdown",
    description: "Total error counts by class (Wrong Cut Path, Excess Flesh Damage, Missed Bone) across all sessions. Click each cell for a detailed explanation.",
    purpose: "Provides a class-wide aggregate of error types to prioritize remediation.",
    guide: "Any missed-bone avg above 0 per session warrants direct remediation. Wrong cut path errors respond well to re-demonstration of knife angle and position.",
  },
  hintUsage: {
    title: "Hint Usage Trend",
    description: "Average number of hints used per session, tracked across attempt numbers.",
    purpose: "Shows whether students are relying less on hints as they practice more — a sign of growing independence.",
    guide: "A declining trend is positive. A flat or rising trend means students are not internalizing the procedure. Consider reducing hint availability after session 3.",
  },
  boneCompletion: {
    title: "Bone Completion",
    description: "Class-average extraction rate for each bone group (Dorsal, Ventral, Lateral/Y-spine) as a percentage of the target bone count.",
    purpose: "Shows whether students are extracting enough bones in each anatomical region.",
    guide: "The Lateral/Y-spine target (42) is the hardest to hit — it corresponds to the most pedagogically significant step. Low completion here means students need more practice on Step 09.",
  },
  toolUsage: {
    title: "Tool Usage by Step",
    description: "For each step, which tool was selected and how often it was triggered incorrectly.",
    purpose: "Identifies wrong-tool habits — students using the knife where forceps are needed, for example.",
    guide: "Wrong rates above 60% indicate students do not know which tool to use for that step. Re-teach the tool-selection section of Module 4.",
  },
  stepMastery: {
    title: "Step Mastery Overview",
    description: "Aggregate mastery score per step, computed from the sim_mastery table which tracks each student's best and average accuracy across all their attempts at each step.",
    purpose: "Shows where the class has built reliable muscle memory vs where performance is still inconsistent.",
    guide: "Steps with low mastery but high attempt counts suggest students are practicing the step but not improving — a signal that they need corrective feedback, not more repetition.",
  },
  sessionDuration: {
    title: "Session Duration by Attempt",
    description: "Average time (minutes:seconds) students spend per simulation session, tracked across attempt numbers.",
    purpose: "Shows whether students are becoming more efficient as they practice.",
    guide: "Decreasing duration alongside increasing scores = students are mastering the procedure. Decreasing duration with flat or falling scores = students are rushing. Increasing duration may indicate students are being more careful or are struggling more.",
  },
  repeatLearner: {
    title: "Repeat Learner Breakdown",
    description: "How many students have completed exactly 1 simulation session, 2–3 sessions, or 4 or more sessions.",
    purpose: "Measures whether students are engaging in deliberate practice beyond the first attempt.",
    guide: "A large 'Never' or '1 session' bucket means most students are not repeating practice. Encourage or require multiple simulation runs before the practical exam.",
  },
  learningCurves: {
    title: "Student Learning Curves",
    description: "Individual score trajectories per student (thin lines) with the class average (bold line) across attempt numbers.",
    purpose: "Reveals which students are improving, plateauing, or declining across sessions.",
    guide: "Students whose lines are flat or declining after 3+ attempts may need one-on-one review rather than more unguided simulation time.",
  },
};

// ── Score Distribution Histogram ──────────────────────────────────────────────
const ScoreHistogram = ({ scoreDistribution, onInfoClick }) => {
  if (!scoreDistribution?.length) return null;
  const data = SCORE_BUCKETS.map((b) => ({
    label: `${b}–${b + 10}`,
    count: scoreDistribution.find((r) => Number(r.bucket_min) === b)?.count ?? 0,
  }));
  if (!data.some((d) => d.count > 0)) return null;
  const accent = getCSSVar("--color-accent", "#16a34a");
  const grid   = getCSSVar("--color-hairline", "#e5e7eb");
  const muted  = getCSSVar("--color-fg-subtle", "#9ca3af");
  return (
    <div className="ar-section">
      <SectionHead label="Score Distribution" info={SIM_SECTION_MODALS.scoreDistribution} onInfoClick={onInfoClick} />
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: muted, fontFamily: "inherit" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: muted, fontFamily: "inherit" }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} contentStyle={{ fontFamily: "inherit", fontSize: 12, border: `1px solid ${grid}` }} formatter={(val) => [`${val} session${val !== 1 ? "s" : ""}`, "Count"]} />
          <Bar dataKey="count" fill={accent} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── Hint Usage Trend ──────────────────────────────────────────────────────────
const HintTrendLine = ({ cohortProgress, onInfoClick }) => {
  const accent = getCSSVar("--color-accent", "#16a34a");
  const grid   = getCSSVar("--color-hairline", "#e5e7eb");
  const muted  = getCSSVar("--color-fg-subtle", "#9ca3af");
  if (!cohortProgress?.length || cohortProgress.length < 2) {
    return (
      <div className="ar-section">
        <SectionHead label="Hint Usage Trend" info={SIM_SECTION_MODALS.hintUsage} onInfoClick={onInfoClick} />
        <p className="ar-note">Not enough sessions to show a trend yet.</p>
      </div>
    );
  }
  const data = cohortProgress.map((pt) => ({
    session: `S${pt.attempt_number}`,
    avg_hints: pt.avg_hints ?? 0,
    student_count: pt.student_count,
  }));
  return (
    <div className="ar-section">
      <SectionHead label="Hint Usage Trend" info={SIM_SECTION_MODALS.hintUsage} onInfoClick={onInfoClick} />
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
          <XAxis dataKey="session" tick={{ fontSize: 10, fill: muted, fontFamily: "inherit" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: muted, fontFamily: "inherit" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontFamily: "inherit", fontSize: 12, border: `1px solid ${grid}` }} formatter={(val, _n, props) => [`${val} hints · ${props.payload.student_count} student${props.payload.student_count !== 1 ? "s" : ""}`, "Avg Hints Used"]} />
          <Line type="monotone" dataKey="avg_hints" stroke={accent} strokeWidth={2} dot={{ r: 4, fill: accent, strokeWidth: 0 }} activeDot={{ r: 6, fill: accent }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── Step Error Heatmap ────────────────────────────────────────────────────────
const StepHeatmap = ({ errorHeatmap, stepDifficulty, onInfoClick }) => {
  if (!errorHeatmap?.length || !stepDifficulty?.length) return null;
  const lookup = {};
  errorHeatmap.forEach(({ step_id, error_class, count }) => {
    if (!lookup[step_id]) lookup[step_id] = {};
    lookup[step_id][error_class] = count;
  });
  const maxCount = Math.max(...errorHeatmap.map((r) => r.count), 1);
  return (
    <div className="ar-section">
      <SectionHead label="Error Heatmap" info={SIM_SECTION_MODALS.errorHeatmap} onInfoClick={onInfoClick} />
      <div className="ar-heatmap">
        <div className="ar-heatmap-row ar-heatmap-header">
          <div className="ar-heatmap-step-label" />
          {ERROR_COLS.map((ec) => (
            <div key={ec.key} className="ar-heatmap-cell ar-heatmap-cell--header">{ec.label}</div>
          ))}
        </div>
        {stepDifficulty.map((step) => (
          <div key={step.step_id} className="ar-heatmap-row">
            <div className="ar-heatmap-step-label">{step.step_key || `Step ${step.step_id}`}</div>
            {ERROR_COLS.map((ec) => {
              const count   = lookup[step.step_id]?.[ec.key] ?? 0;
              const opacity = count === 0 ? 0 : 0.1 + (count / maxCount) * 0.85;
              return (
                <div key={ec.key} className="ar-heatmap-cell" style={{ backgroundColor: `rgba(220, 38, 38, ${opacity.toFixed(3)})` }} title={`${step.step_key || `Step ${step.step_id}`} · ${ec.label}: ${count}`}>
                  {count > 0 ? count : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Student Learning Curves ───────────────────────────────────────────────────
const StudentLearningCurve = ({ students, hasMoreBackend, onInfoClick }) => {
  if (!students?.length) return null;
  const maxAttempts = Math.max(...students.map(s => s.attempts.length), 0);
  if (maxAttempts < 2) {
    return (
      <div className="ar-section">
        <SectionHead label="Student Learning Curves" info={SIM_SECTION_MODALS.learningCurves} onInfoClick={onInfoClick} />
        <p className="ar-note">Not enough attempts yet to show learning curves.</p>
      </div>
    );
  }
  const DISPLAY_LIMIT = 20;
  const display   = students.slice(0, DISPLAY_LIMIT);
  const truncated = students.length > DISPLAY_LIMIT;
  const attemptNums = [...new Set(display.flatMap(s => s.attempts.map(a => a.attempt_number)))].sort((a, b) => a - b);
  const data = attemptNums.map(n => {
    const row = { attempt: n };
    const scores = [];
    display.forEach(s => {
      const pt = s.attempts.find(a => a.attempt_number === n);
      if (pt != null) { row[`s_${s.user_id}`] = pt.score; scores.push(pt.score); }
    });
    if (scores.length) row.avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return row;
  });
  const accent = getCSSVar("--color-accent", "#16a34a");
  const grid   = getCSSVar("--color-hairline", "#e5e7eb");
  const muted  = getCSSVar("--color-fg-subtle", "#9ca3af");
  return (
    <div className="ar-section">
      <SectionHead label="Student Learning Curves" info={SIM_SECTION_MODALS.learningCurves} onInfoClick={onInfoClick} />
      <p className="ar-note">
        {students.length} student{students.length !== 1 ? "s" : ""} · thin lines = individual · bold = class avg
        {truncated && ` · showing first ${DISPLAY_LIMIT}`}
        {hasMoreBackend && " · backend data capped at 2 000 sessions — use course filter for full data"}
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
          <XAxis dataKey="attempt" tick={{ fontSize: 10, fill: muted, fontFamily: "inherit" }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tickCount={5} tick={{ fontSize: 10, fill: muted, fontFamily: "inherit" }} axisLine={false} tickLine={false} unit="%" />
          <Tooltip contentStyle={{ fontFamily: "inherit", fontSize: 11, border: `1px solid ${grid}` }} formatter={(val, name) => name === "avg" ? [`${val}%`, "Class Avg"] : false} />
          {display.map(s => (
            <Line key={s.user_id} type="monotone" dataKey={`s_${s.user_id}`} stroke={muted} strokeWidth={1} strokeOpacity={0.35} dot={false} activeDot={false} connectNulls isAnimationActive={false} legendType="none" />
          ))}
          <Line type="monotone" dataKey="avg" stroke={accent} strokeWidth={2.5} dot={{ r: 3, fill: accent, strokeWidth: 0 }} activeDot={{ r: 5, fill: accent }} connectNulls legendType="none" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── Step Mastery Overview ─────────────────────────────────────────────────────
const StepMasteryOverview = ({ stepMastery, onInfoClick }) => {
  if (!stepMastery?.length) return null;
  const maxMastery = Math.max(...stepMastery.map(s => s.avg_mastery || 0), 1);
  return (
    <div className="ar-section">
      <SectionHead label="Step Mastery Overview" info={SIM_SECTION_MODALS.stepMastery} onInfoClick={onInfoClick} />
      <div className="ar-bars">
        {stepMastery.map(s => {
          const pct  = s.avg_mastery ?? 0;
          const fill = pct >= 75 ? "ar-bar-fill--accent" : pct >= 50 ? "ar-bar-fill--warn" : "ar-bar-fill--danger";
          return (
            <div key={s.step_id} className="ar-bar-row">
              <span className="ar-bar-label">Step {String(s.step_id).padStart(2, "0")}</span>
              <div className="ar-bar-track">
                <div className={`ar-bar-fill ${fill}`} style={{ width: `${(pct / maxMastery) * 100}%` }} />
              </div>
              <span className="ar-bar-value">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Session Duration by Attempt ───────────────────────────────────────────────
const SessionDurationTrend = ({ sessionDurationTrend, onInfoClick }) => {
  if (!sessionDurationTrend?.length) return null;
  const maxDur = Math.max(...sessionDurationTrend.map(r => r.avg_duration || 0), 1);
  return (
    <div className="ar-section">
      <SectionHead label="Session Duration by Attempt" info={SIM_SECTION_MODALS.sessionDuration} onInfoClick={onInfoClick} />
      <div className="ar-bars">
        {sessionDurationTrend.map(r => (
          <div key={r.attempt_number} className="ar-bar-row">
            <span className="ar-bar-label">
              Session {r.attempt_number}
              <span className="ar-bar-label-sub"> · {r.student_count} student{r.student_count !== 1 ? "s" : ""}</span>
            </span>
            <div className="ar-bar-track">
              <div className="ar-bar-fill ar-bar-fill--muted" style={{ width: `${((r.avg_duration || 0) / maxDur) * 100}%` }} />
            </div>
            <span className="ar-bar-value">{fmtSeconds(r.avg_duration)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Repeat Learner Breakdown ──────────────────────────────────────────────────
const RepeatLearnerBreakdown = ({ repeatLearnerBuckets, studentCount, onInfoClick }) => {
  if (!repeatLearnerBuckets) return null;
  const total = studentCount || 1;
  const { one = 0, few = 0, many = 0 } = repeatLearnerBuckets;
  return (
    <div className="ar-section">
      <SectionHead label="Repeat Learner Breakdown" info={SIM_SECTION_MODALS.repeatLearner} onInfoClick={onInfoClick} />
      <div className="ar-repeat-grid">
        {[
          { label: "1 Session",    count: one,  desc: "attempted once" },
          { label: "2–3 Sessions", count: few,  desc: "some repeat practice" },
          { label: "4+ Sessions",  count: many, desc: "deliberate practice" },
        ].map(({ label, count, desc }) => (
          <div key={label} className="ar-engage-cell">
            <span className="ar-engage-cell-count">{count}</span>
            <span className="ar-engage-cell-label">{label}</span>
            <span className="ar-engage-cell-pct">{total > 0 ? Math.round((count / total) * 100) : 0}% of class</span>
            <span className="ar-engage-cell-pct" style={{ opacity: 0.7 }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main SimulationTab ────────────────────────────────────────────────────────
const SimulationTab = ({ simData, scoreDistribution, learningCurveData, learningCurveHasMore, onInfoClick }) => {
  if (!simData || !simData.total_sessions) {
    return (
      <div className="ar-empty">
        <div className="ar-empty-icon"><BarChart3 size={34} /></div>
        <p className="ar-empty-title">No simulation data yet.</p>
        <p className="ar-empty-sub">Data will appear once students complete simulation sessions.</p>
      </div>
    );
  }

  const maxSeconds = Math.max(...(simData.avg_time_per_step || []).map((s) => s.avg_seconds || 0), 1);
  const totalSessions = simData.total_sessions || 1;

  const errorTotals = { wrong_cut_path: 0, excess_flesh_damage: 0, missed_bone: 0 };
  (simData.error_heatmap || []).forEach((row) => {
    if (row.error_class in errorTotals) errorTotals[row.error_class] += row.count;
  });

  return (
    <div className="ar-content">

      <ScoreHistogram scoreDistribution={scoreDistribution} onInfoClick={onInfoClick} />

      {simData.avg_time_per_step?.length > 0 && (
        <div className="ar-section">
          <SectionHead label="Avg Time Per Step" info={SIM_SECTION_MODALS.avgTimePerStep} onInfoClick={onInfoClick} />
          <div className="ar-bars">
            {simData.avg_time_per_step.map((step) => (
              <div key={step.step_id} className="ar-bar-row">
                <span className="ar-bar-label">{step.step_key || `Step ${step.step_id}`}</span>
                <div className="ar-bar-track">
                  <div className="ar-bar-fill ar-bar-fill--muted" style={{ width: `${((step.avg_seconds || 0) / maxSeconds) * 100}%` }} />
                </div>
                <span className="ar-bar-value">{fmtSeconds(step.avg_seconds)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {simData.step_difficulty?.length > 0 && (
        <div className="ar-section">
          <SectionHead label="Step Difficulty" info={SIM_SECTION_MODALS.stepDifficulty} onInfoClick={onInfoClick} />
          <div className="ar-table-wrap">
            <table className="ar-table">
              <thead>
                <tr><th>Step</th><th>Avg Errors</th><th>Accuracy</th></tr>
              </thead>
              <tbody>
                {simData.step_difficulty.map((step) => {
                  const accPct   = Math.round((step.avg_accuracy || 0) * 100);
                  const errBadge = step.avg_errors > 3 ? "ar-badge--fail" : step.avg_errors > 1 ? "ar-badge--warn" : "ar-badge--pass";
                  return (
                    <tr key={step.step_id}>
                      <td>{step.step_key || `Step ${step.step_id}`}</td>
                      <td><span className={`ar-badge ${errBadge}`}>{step.avg_errors}</span></td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div className="ar-bar-track ar-bar-track--sm" style={{ flex: 1 }}>
                            <div className="ar-bar-fill ar-bar-fill--accent" style={{ width: `${accPct}%` }} />
                          </div>
                          <span className="ar-bar-value">{accPct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <StepHeatmap errorHeatmap={simData.error_heatmap} stepDifficulty={simData.step_difficulty} onInfoClick={onInfoClick} />

      {/* Error Breakdown — clickable cells with modals */}
      <div className="ar-section">
        <SectionHead label="Error Breakdown" info={SIM_SECTION_MODALS.errorBreakdown} onInfoClick={onInfoClick} />
        <div className="ar-error-grid">
          {[
            { key: "wrong_cut_path",      cls: "high" },
            { key: "excess_flesh_damage", cls: "medium" },
            { key: "missed_bone",         cls: "critical" },
          ].map(({ key, cls }) => (
            <div
              key={key}
              className="ar-error-cell"
              onClick={() => onInfoClick?.(ERROR_MODALS[key])}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onInfoClick?.(ERROR_MODALS[key])}
              style={{ cursor: "pointer" }}
            >
              <span className="ar-error-cell-label">{ERROR_MODALS[key].title}</span>
              <span className={`ar-error-cell-count ar-error-cell-count--${cls}`}>{errorTotals[key]}</span>
              <span className="ar-error-cell-sub">{(errorTotals[key] / totalSessions).toFixed(1)} avg per session</span>
            </div>
          ))}
        </div>
      </div>

      <HintTrendLine cohortProgress={simData.cohort_progress} onInfoClick={onInfoClick} />

      {/* Bone Completion */}
      {simData.bone_completion && (
        <div className="ar-section">
          <SectionHead label="Bone Completion (Class Avg)" info={SIM_SECTION_MODALS.boneCompletion} onInfoClick={onInfoClick} />
          <div className="ar-bars">
            {[
              { label: "Dorsal Bones",       key: "dorsal_pct",  target: 87 },
              { label: "Ventral Bones",      key: "ventral_pct", target: 48 },
              { label: "Lateral / Y-spine",  key: "lateral_pct", target: 42 },
            ].map(({ label, key, target }) => (
              <div key={key} className="ar-bar-row">
                <span className="ar-bar-label">
                  {label}
                  <span className="ar-bar-label-sub"> · target {target}</span>
                </span>
                <div className="ar-bar-track">
                  <div className="ar-bar-fill ar-bar-fill--accent" style={{ width: `${simData.bone_completion[key] || 0}%` }} />
                </div>
                <span className="ar-bar-value">{simData.bone_completion[key] ?? 0}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tool Usage by Step */}
      {simData.tool_usage?.length > 0 && (
        <div className="ar-section">
          <SectionHead label="Tool Usage by Step" info={SIM_SECTION_MODALS.toolUsage} onInfoClick={onInfoClick} />
          <div className="ar-table-wrap">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Tool</th>
                  <th>Total Uses</th>
                  <th>Wrong Triggers</th>
                  <th>Wrong Rate</th>
                </tr>
              </thead>
              <tbody>
                {simData.tool_usage.map((row, i) => {
                  const wrongBadge =
                    row.wrong_rate_pct >= 60 ? "ar-badge--fail"
                    : row.wrong_rate_pct >= 30 ? "ar-badge--warn"
                    : "ar-badge--pass";
                  return (
                    <tr key={i}>
                      <td>{row.step_key || `Step ${row.step_id}`}</td>
                      <td>{row.tool_name}</td>
                      <td>{row.total_uses}</td>
                      <td>{row.total_wrong}</td>
                      <td>
                        {row.wrong_rate_pct != null
                          ? <span className={`ar-badge ${wrongBadge}`}>{row.wrong_rate_pct}%</span>
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <StepMasteryOverview stepMastery={simData.step_mastery} onInfoClick={onInfoClick} />
      <SessionDurationTrend sessionDurationTrend={simData.session_duration_trend} onInfoClick={onInfoClick} />
      <RepeatLearnerBreakdown repeatLearnerBuckets={simData.repeat_learner_buckets} studentCount={simData.student_count} onInfoClick={onInfoClick} />
      <StudentLearningCurve students={learningCurveData} hasMoreBackend={learningCurveHasMore} onInfoClick={onInfoClick} />

    </div>
  );
};

export default SimulationTab;
