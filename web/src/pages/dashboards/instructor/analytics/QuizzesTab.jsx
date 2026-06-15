import { useState } from "react";
import { BarChart3 } from "lucide-react";
import SectionHead from "./shared/SectionHead";
import StatCard    from "./shared/StatCard";
import { scoreBadge, fmtSeconds } from "./shared/chartHelpers";
import { MODULES_META } from "../../../../data/modulesMeta";

const MODULE_MODALS = {
  1: {
    title: "Module 1 — Fish Fundamentals",
    description: "Covers fish nutrition, anatomy, and muscle structure. Foundation knowledge for understanding why precise deboning matters.",
    purpose: "Assesses theoretical understanding of fish biology before students attempt the simulator.",
    guide: "A low pass rate here predicts difficulty understanding why certain cuts are required in the simulator. Re-teach the Fish Muscle Structure and White vs Dark Muscle sections.",
  },
  2: {
    title: "Module 2 — Fish Preparation Basics",
    description: "Covers preparation forms: drawn, dressed, fillets, steaks, sticks. Students learn what 'deboned' means as a product form.",
    purpose: "Ensures students understand the end-product goal of the deboning procedure.",
    guide: "Low pass rate suggests students cannot distinguish preparation forms. Re-teach the Fillets section and the Preparation Selection Guide.",
  },
  3: {
    title: "Module 3 — Filleting Techniques",
    description: "Step-by-step filleting and skinning procedures — the direct procedural precursor to the simulation.",
    purpose: "Core procedural knowledge module. Most directly linked to simulation performance.",
    guide: "Low pass rate here strongly predicts high wrong_cut_path errors in the simulator. Re-teach the Step-by-Step Filleting Procedure and Common Problems sections.",
  },
  4: {
    title: "Module 4 — Bangus Deboning Mastery",
    description: "Specialised bangus anatomy, bone structure, equipment selection, and the step-by-step deboning procedure.",
    purpose: "The most critical knowledge module for simulation readiness — covers the exact procedure the simulator tests.",
    guide: "Low pass rate directly predicts high missed_bone errors. Students who fail this module need one-on-one review of the Bone Structure and Step-by-Step Deboning Procedure sections.",
  },
  5: {
    title: "Module 5 — Quality & Safety",
    description: "Covers proper handling, storage techniques, and quality control standards post-deboning.",
    purpose: "Assesses whether students understand what happens after deboning — important for the complete workflow.",
    guide: "Low pass rate here is less critical for simulation performance but matters for the full deboning workflow. Re-teach the Proper Fish Handling and Storage Techniques sections.",
  },
};

const QUIZ_SECTION_MODALS = {
  overview: {
    title: "Module Overview",
    description: "Pass rate for each quiz module displayed as stat cards. Green = passing (≥75%), grey = below passing.",
    purpose: "Gives an immediate colour-coded signal of which modules the class is passing vs struggling with.",
    guide: "Any module with a pass rate below 75% should be reviewed with students before their next simulation session.",
  },
  passRateBars: {
    title: "Pass Rate by Module",
    description: "Horizontal bar chart showing the percentage of quiz attempts per module that received a passing score.",
    purpose: "Visualises the relative difficulty of each module's quiz.",
    guide: "Green bars (≥75%) indicate modules students have mastered. Focus teaching time on red/amber bars.",
  },
  avgScoreBars: {
    title: "Avg Score by Module",
    description: "Horizontal bar chart showing the mean score percentage per module across all attempts.",
    purpose: "Distinguishes modules where students score well from those where scores are low.",
    guide: "A high avg score with a low pass rate means the pass threshold is the barrier, not comprehension. Consider whether the threshold is correctly calibrated.",
  },
  firstPassBars: {
    title: "First-Pass Rate by Module",
    description: "Percentage of students who passed each module quiz on their very first attempt.",
    purpose: "Reveals true initial mastery — unaffected by retake inflation in the overall pass rate.",
    guide: "Compare first-pass rate to overall pass rate. A large gap means students need multiple tries. The modules with the widest gap need the most targeted teaching attention.",
  },
  streakBars: {
    title: "Avg Max Streak by Module",
    description: "Average of the longest consecutive correct-answer streaks students achieved per module.",
    purpose: "Measures knowledge consolidation — a high streak means students answered many questions confidently in a row.",
    guide: "Low streaks (below 3) in a module mean students are guessing rather than applying consistent knowledge. Re-teach systematically rather than reviewing individual questions.",
  },
  coverageBars: {
    title: "Student Coverage Rate",
    description: "Percentage of enrolled students who have attempted each module's quiz at least once.",
    purpose: "Shows which modules students are skipping entirely — a student can't pass a quiz they never take.",
    guide: "Low coverage on Module 4 is urgent — it is the prerequisite for safe simulation performance. Prompt uncovered students to attempt the quiz.",
  },
  timeBars: {
    title: "Time-on-Task by Module",
    description: "Average time students spend per quiz attempt for each module.",
    purpose: "Long time + low score = confused students. Short time + low score = guessing. Long time + high score = careful, thorough students.",
    guide: "Use alongside pass rate. If Module 4 has both long time-on-task and low pass rate, the content is genuinely difficult, not just poorly studied.",
  },
  detailTable: {
    title: "Module Detail Table",
    description: "Sortable table with all quiz metrics per module in one view: attempts, students, avg score, pass rate, first-pass rate, streak, coverage, and avg time.",
    purpose: "Allows side-by-side comparison of all metrics per module for a complete picture.",
    guide: "Click any column header to sort. The most actionable combination to look for: low First-Pass % + low Coverage % = students aren't studying the module before attempting the quiz.",
  },
  hardestQuestions: {
    title: "Hardest Quiz Questions",
    description: "The 10 questions with the highest miss rate across all modules and all student attempts.",
    purpose: "Pinpoints the specific knowledge gaps causing the most failures.",
    guide: "Address these questions in class directly. A miss rate above 60% on any question means more than half of students got it wrong — that question's concept needs explicit re-teaching.",
  },
};

const QuizzesTab = ({ quizData, hardestQuestions, onInfoClick }) => {
  const [tableSortKey, setTableSortKey] = useState("module_id");
  const [tableSortDir, setTableSortDir] = useState("asc");

  if (!quizData?.length && !hardestQuestions?.length) {
    return (
      <div className="ar-empty">
        <div className="ar-empty-icon"><BarChart3 size={34} /></div>
        <p className="ar-empty-title">No quiz data yet.</p>
        <p className="ar-empty-sub">Data will appear once students attempt quizzes.</p>
      </div>
    );
  }

  const handleTableSort = (key) => {
    if (tableSortKey === key) {
      setTableSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setTableSortKey(key);
      setTableSortDir("desc");
    }
  };

  const sortedQuizData = [...quizData].sort((a, b) => {
    const av = a[tableSortKey] ?? 0;
    const bv = b[tableSortKey] ?? 0;
    return tableSortDir === "asc" ? av - bv : bv - av;
  });

  const maxPassRate    = Math.max(...quizData.map(r => r.pass_rate_pct      || 0), 1);
  const maxAvgScore    = Math.max(...quizData.map(r => r.avg_score_pct      || 0), 1);
  const maxFirstPass   = Math.max(...quizData.map(r => r.first_pass_rate_pct || 0), 1);
  const maxStreak      = Math.max(...quizData.map(r => r.avg_max_streak     || 0), 1);
  const maxCoverage    = Math.max(...quizData.map(r => r.coverage_rate_pct  || 0), 1);
  const maxTime        = Math.max(...quizData.map(r => r.avg_time_seconds   || 0), 1);

  return (
    <div className="ar-content">

      {/* ── Module stat cards ──────────────────────────────────────── */}
      {quizData.length > 0 && (
        <div className="ar-section">
          <SectionHead label="Module Overview" info={QUIZ_SECTION_MODALS.overview} onInfoClick={onInfoClick} />
          <div className="ar-stat-grid" style={{ gridTemplateColumns: `repeat(${quizData.length}, 1fr)` }}>
            {quizData.map((row) => {
              const meta = MODULES_META.find(m => m.id === row.module_id);
              return (
                <StatCard
                  key={row.module_id}
                  value={row.pass_rate_pct != null ? `${row.pass_rate_pct}%` : "—"}
                  label={meta?.title || `Module ${row.module_id}`}
                  sub={`avg ${row.avg_score_pct ?? 0}% · ${row.total_attempts} attempts`}
                  accent={row.pass_rate_pct >= 75}
                  info={MODULE_MODALS[row.module_id]}
                  onInfoClick={onInfoClick}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pass Rate + Avg Score bars ─────────────────────────────── */}
      {quizData.length > 0 && (
        <div className="ar-section">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div>
              <SectionHead label="Pass Rate by Module" info={QUIZ_SECTION_MODALS.passRateBars} onInfoClick={onInfoClick} />
              <div className="ar-bars">
                {quizData.map((row) => {
                  const meta  = MODULES_META.find(m => m.id === row.module_id);
                  const label = meta?.title || `Module ${row.module_id}`;
                  const pct   = row.pass_rate_pct ?? 0;
                  const fill  = pct >= 75 ? "ar-bar-fill--accent" : "ar-bar-fill--muted";
                  return (
                    <div key={row.module_id} className="ar-bar-row">
                      <span className="ar-bar-label" title={label}>{label}</span>
                      <div className="ar-bar-track">
                        <div className={`ar-bar-fill ${fill}`} style={{ width: `${(pct / maxPassRate) * 100}%` }} />
                      </div>
                      <span className="ar-bar-value">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <SectionHead label="Avg Score by Module" info={QUIZ_SECTION_MODALS.avgScoreBars} onInfoClick={onInfoClick} />
              <div className="ar-bars">
                {quizData.map((row) => {
                  const meta  = MODULES_META.find(m => m.id === row.module_id);
                  const label = meta?.title || `Module ${row.module_id}`;
                  const pct   = row.avg_score_pct ?? 0;
                  return (
                    <div key={row.module_id} className="ar-bar-row">
                      <span className="ar-bar-label" title={label}>{label}</span>
                      <div className="ar-bar-track">
                        <div className="ar-bar-fill ar-bar-fill--accent" style={{ width: `${(pct / maxAvgScore) * 100}%` }} />
                      </div>
                      <span className="ar-bar-value">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── First-Pass Rate + Coverage bars ───────────────────────── */}
      {quizData.length > 0 && (
        <div className="ar-section">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div>
              <SectionHead label="First-Pass Rate by Module" info={QUIZ_SECTION_MODALS.firstPassBars} onInfoClick={onInfoClick} />
              <div className="ar-bars">
                {quizData.map((row) => {
                  const meta  = MODULES_META.find(m => m.id === row.module_id);
                  const label = meta?.title || `Module ${row.module_id}`;
                  const pct   = row.first_pass_rate_pct ?? 0;
                  const fill  = pct >= 75 ? "ar-bar-fill--accent" : "ar-bar-fill--muted";
                  return (
                    <div key={row.module_id} className="ar-bar-row">
                      <span className="ar-bar-label" title={label}>{label}</span>
                      <div className="ar-bar-track">
                        <div className={`ar-bar-fill ${fill}`} style={{ width: `${(pct / maxFirstPass) * 100}%` }} />
                      </div>
                      <span className="ar-bar-value">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <SectionHead label="Student Coverage Rate" info={QUIZ_SECTION_MODALS.coverageBars} onInfoClick={onInfoClick} />
              <div className="ar-bars">
                {quizData.map((row) => {
                  const meta  = MODULES_META.find(m => m.id === row.module_id);
                  const label = meta?.title || `Module ${row.module_id}`;
                  const pct   = row.coverage_rate_pct ?? 0;
                  const fill  = pct >= 80 ? "ar-bar-fill--accent" : "ar-bar-fill--muted";
                  return (
                    <div key={row.module_id} className="ar-bar-row">
                      <span className="ar-bar-label" title={label}>{label}</span>
                      <div className="ar-bar-track">
                        <div className={`ar-bar-fill ${fill}`} style={{ width: `${(pct / maxCoverage) * 100}%` }} />
                      </div>
                      <span className="ar-bar-value">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Streak + Time-on-Task bars ─────────────────────────────── */}
      {quizData.length > 0 && (
        <div className="ar-section">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div>
              <SectionHead label="Avg Max Streak by Module" info={QUIZ_SECTION_MODALS.streakBars} onInfoClick={onInfoClick} />
              <div className="ar-bars">
                {quizData.map((row) => {
                  const meta   = MODULES_META.find(m => m.id === row.module_id);
                  const label  = meta?.title || `Module ${row.module_id}`;
                  const streak = row.avg_max_streak ?? 0;
                  return (
                    <div key={row.module_id} className="ar-bar-row">
                      <span className="ar-bar-label" title={label}>{label}</span>
                      <div className="ar-bar-track">
                        <div className="ar-bar-fill ar-bar-fill--accent" style={{ width: `${(streak / maxStreak) * 100}%` }} />
                      </div>
                      <span className="ar-bar-value">{streak}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <SectionHead label="Time-on-Task by Module" info={QUIZ_SECTION_MODALS.timeBars} onInfoClick={onInfoClick} />
              <div className="ar-bars">
                {quizData.map((row) => {
                  const meta  = MODULES_META.find(m => m.id === row.module_id);
                  const label = meta?.title || `Module ${row.module_id}`;
                  const secs  = row.avg_time_seconds ?? 0;
                  return (
                    <div key={row.module_id} className="ar-bar-row">
                      <span className="ar-bar-label" title={label}>{label}</span>
                      <div className="ar-bar-track">
                        <div className="ar-bar-fill ar-bar-fill--muted" style={{ width: `${(secs / maxTime) * 100}%` }} />
                      </div>
                      <span className="ar-bar-value">{fmtSeconds(secs)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Module Detail table ────────────────────────────────────── */}
      {quizData.length > 0 && (
        <div className="ar-section">
          <SectionHead label="Module Detail" info={QUIZ_SECTION_MODALS.detailTable} onInfoClick={onInfoClick} />
          <div className="ar-table-wrap">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>Module</th>
                  {[
                    { key: "total_attempts",      label: "Attempts" },
                    { key: "distinct_students",   label: "Students" },
                    { key: "avg_score_pct",       label: "Avg Score" },
                    { key: "pass_rate_pct",       label: "Pass Rate" },
                    { key: "first_pass_rate_pct", label: "1st Pass" },
                    { key: "avg_max_streak",      label: "Avg Streak" },
                    { key: "coverage_rate_pct",   label: "Coverage" },
                    { key: "avg_time_seconds",    label: "Avg Time" },
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      style={{ cursor: "pointer", userSelect: "none" }}
                      onClick={() => handleTableSort(key)}
                    >
                      {label}{tableSortKey === key ? (tableSortDir === "asc" ? " ↑" : " ↓") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedQuizData.map((row) => {
                  const meta = MODULES_META.find(m => m.id === row.module_id);
                  return (
                    <tr key={row.module_id}>
                      <td>{meta?.title || `Module ${row.module_id}`}</td>
                      <td>{row.total_attempts}</td>
                      <td>{row.distinct_students}</td>
                      <td><span className={`ar-badge ${scoreBadge(row.avg_score_pct)}`}>{row.avg_score_pct ?? "—"}{row.avg_score_pct != null ? "%" : ""}</span></td>
                      <td><span className={`ar-badge ${scoreBadge(row.pass_rate_pct)}`}>{row.pass_rate_pct ?? "—"}{row.pass_rate_pct != null ? "%" : ""}</span></td>
                      <td><span className={`ar-badge ${scoreBadge(row.first_pass_rate_pct)}`}>{row.first_pass_rate_pct ?? "—"}{row.first_pass_rate_pct != null ? "%" : ""}</span></td>
                      <td>{row.avg_max_streak ?? "—"}</td>
                      <td><span className={`ar-badge ${scoreBadge(row.coverage_rate_pct)}`}>{row.coverage_rate_pct ?? "—"}{row.coverage_rate_pct != null ? "%" : ""}</span></td>
                      <td>{fmtSeconds(row.avg_time_seconds)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Hardest Questions ─────────────────────────────────────── */}
      {hardestQuestions?.length > 0 && (
        <div className="ar-section">
          <SectionHead label="Hardest Quiz Questions" info={QUIZ_SECTION_MODALS.hardestQuestions} onInfoClick={onInfoClick} />
          <div className="ar-table-wrap">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Module</th>
                  <th>Miss Rate</th>
                  <th>Timeouts</th>
                  <th>Avg Time</th>
                  <th>Answers</th>
                </tr>
              </thead>
              <tbody>
                {hardestQuestions.slice(0, 10).map((q) => (
                  <tr key={`${q.question_id}-${q.module_id}`}>
                    <td title={q.question_text || ""}>
                      {q.question_text
                        ? (q.question_text.length > 72 ? q.question_text.slice(0, 69) + "…" : q.question_text)
                        : `#${q.question_id}`}
                    </td>
                    <td>{MODULES_META.find(m => m.id === q.module_id)?.title || `Module ${q.module_id}`}</td>
                    <td>
                      <span className={`ar-badge ${
                        q.miss_rate_pct == null  ? "ar-badge--warn"
                        : q.miss_rate_pct >= 60  ? "ar-badge--fail"
                        : q.miss_rate_pct >= 40  ? "ar-badge--warn"
                        : "ar-badge--pass"
                      }`}>
                        {q.miss_rate_pct ?? "—"}{q.miss_rate_pct != null ? "%" : ""}
                      </span>
                    </td>
                    <td>{q.timeouts ?? 0}</td>
                    <td>{q.avg_time_ms != null ? `${(q.avg_time_ms / 1000).toFixed(1)}s` : "—"}</td>
                    <td>{q.total_answers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default QuizzesTab;
