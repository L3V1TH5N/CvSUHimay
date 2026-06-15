import { BarChart3 } from "lucide-react";
import SectionHead  from "./shared/SectionHead";
import StatCard     from "./shared/StatCard";
import { fmtSeconds } from "./shared/chartHelpers";
import { MODULES_META } from "../../../../data/modulesMeta";

const CLASS_SUMMARY_MODALS = {
  students: {
    title: "Enrolled Students",
    description: "Total number of students with an accepted enrollment in your courses.",
    purpose: "Track your active class size across all courses.",
    guide: "A drop in this number means students withdrew or were rejected. Check Student Management for pending enrollment changes.",
  },
  avgSimScore: {
    title: "Avg Simulation Score",
    description: "Mean simulation score across all completed sessions by your students.",
    purpose: "Measures the overall procedural skill level of the class.",
    guide: "≥75% indicates the class is passing. 60–74% means many students are borderline. Below 60% suggests the class needs remediation on the deboning procedure.",
  },
  simPassRate: {
    title: "Simulation Pass Rate",
    description: "Percentage of completed simulation sessions that achieved a passing score (≥75%).",
    purpose: "Shows how many sessions result in a passing performance.",
    guide: "Below 50% means more sessions fail than pass. Check the Simulation tab's Error Heatmap to find which steps are causing failures.",
  },
  avgQuizScore: {
    title: "Avg Quiz Score",
    description: "Weighted average quiz score across all modules and all student attempts.",
    purpose: "Reflects the class's overall theoretical knowledge level.",
    guide: "A high average with a low pass rate means scores cluster just below the threshold. Check the Quizzes tab for which module is dragging the class down.",
  },
  quizPassRate: {
    title: "Quiz Pass Rate",
    description: "Percentage of quiz attempts that received a passing score.",
    purpose: "Measures how well students are mastering the theoretical content.",
    guide: "Below 60% is a signal to review and re-teach. Visit the Quizzes tab to see which module has the lowest pass rate.",
  },
  weakestModule: {
    title: "Weakest Module",
    description: "The quiz module with the lowest pass rate among your students.",
    purpose: "Identifies the specific knowledge gap most likely to affect simulation readiness.",
    guide: "Visit the Quizzes tab → Hardest Questions section for this module to find which specific questions students are missing most.",
  },
};

const SECTION_MODALS = {
  summary: {
    title: "Class Performance Summary",
    description: "Six key metrics giving an at-a-glance picture of your class's theoretical knowledge and procedural skill.",
    purpose: "Quickly identify whether your class is on track across both quiz knowledge and simulation performance.",
    guide: "Cross-reference Sim Pass Rate with Quiz Pass Rate — a large gap between them suggests students understand theory but struggle with practical execution.",
  },
  moduleCompletion: {
    title: "Module Completion Rates",
    description: "Percentage of enrolled students who have fully read each of the 5 learning modules.",
    purpose: "Shows how much of the theory content your students are consuming before the simulator.",
    guide: "Module 4 (Bangus Deboning Mastery) has the most direct link to simulation performance. Low completion there is the most urgent gap to address. Compare with the First-Pass Quiz section — students who didn't read the module almost always fail the quiz on the first try.",
  },
  firstPass: {
    title: "First-Pass Quiz Performance",
    description: "For each module, the percentage of students who passed the quiz on their very first attempt vs the overall pass rate (which includes retakes).",
    purpose: "Reveals whether low pass rates are due to genuinely hard content (low first-pass) or whether students eventually master it through retakes (high overall pass despite low first-pass).",
    guide: "A large gap between first-pass and overall pass rate means many students needed retakes. Target remediation at the specific module showing the widest gap.",
  },
  engagement: {
    title: "Student Engagement Distribution",
    description: "Classifies enrolled students by when they last completed a simulation session: Active (within 14 days), Moderate (15–30 days), Inactive (over 30 days), Never (no sessions).",
    purpose: "Identifies students who may be falling behind or disengaging from practice.",
    guide: "Students in Inactive or Never buckets are high-risk for poor simulation scores. Contact them directly or schedule a remediation lab session.",
  },
  cohortProgress: {
    title: "Cohort Progress by Session",
    description: "Average simulation score per attempt number across all enrolled students. Each bar represents all students on their Nth simulation session.",
    purpose: "Shows whether the class score is improving as students practice more — the learning curve at class level.",
    guide: "A flat or declining trend means students are not benefiting from repeat attempts. Review feedback clarity in the Simulation tab's Error Heatmap.",
  },
  struggling: {
    title: "Struggling Students",
    description: "Students whose average simulation score is below 60% across all their completed sessions.",
    purpose: "Identifies the students who need the most attention and intervention.",
    guide: "Click on any student in the Students tab to see their individual score trend, error breakdown, and which steps they struggle with most.",
  },
};

const ClassSummaryTab = ({ simData, quizData, onInfoClick }) => {
  const hasSimData  = simData && simData.total_sessions > 0;
  const hasQuizData = quizData.length > 0;

  if (!hasSimData && !hasQuizData) {
    return (
      <div className="ar-empty">
        <div className="ar-empty-icon"><BarChart3 size={34} /></div>
        <p className="ar-empty-title">No data yet.</p>
        <p className="ar-empty-sub">Data will appear once students complete sessions and quizzes.</p>
      </div>
    );
  }

  const totalQuizAttempts = quizData.reduce((s, r) => s + (r.total_attempts || 0), 0);
  const overallQuizScore  = totalQuizAttempts > 0
    ? Math.round(quizData.reduce((s, r) => s + (r.avg_score_pct || 0) * (r.total_attempts || 0), 0) / totalQuizAttempts)
    : null;
  const overallQuizPassRate = totalQuizAttempts > 0
    ? Math.round(quizData.reduce((s, r) => s + (r.pass_rate_pct || 0) * (r.total_attempts || 0), 0) / totalQuizAttempts)
    : null;
  const weakestModule = quizData.length > 0
    ? quizData.reduce((min, r) => ((r.pass_rate_pct ?? 101) < (min.pass_rate_pct ?? 101)) ? r : min, quizData[0])
    : null;
  const weakestModuleName = weakestModule
    ? (MODULES_META.find(m => m.id === weakestModule.module_id)?.title || `Module ${weakestModule.module_id}`)
    : null;

  const maxModuleCompletion = Math.max(...quizData.map(r => r.module_completion_pct || 0), 1);
  const maxFirstPass        = Math.max(...quizData.map(r => r.first_pass_rate_pct  || 0), 1);
  const maxPassRate         = Math.max(...quizData.map(r => r.pass_rate_pct        || 0), 1);

  const totalEnrolled = simData?.student_count ?? 0;
  const eng           = simData?.engagement_distribution || {};

  return (
    <div className="ar-content">

      {/* ── Summary stat cards ──────────────────────────────────── */}
      <div className="ar-section">
        <SectionHead label="Summary" info={SECTION_MODALS.summary} onInfoClick={onInfoClick} />
        <div className="ar-stat-grid ar-stat-grid--6">
          <StatCard value={simData?.student_count ?? "—"} label="Students"      info={CLASS_SUMMARY_MODALS.students}     onInfoClick={onInfoClick} />
          <StatCard value={simData?.avg_score  != null ? `${simData.avg_score}%`  : "—"} label="Avg Sim Score"  accent info={CLASS_SUMMARY_MODALS.avgSimScore}  onInfoClick={onInfoClick} />
          <StatCard value={simData?.pass_rate  != null ? `${simData.pass_rate}%`  : "—"} label="Sim Pass Rate"        info={CLASS_SUMMARY_MODALS.simPassRate}   onInfoClick={onInfoClick} />
          <StatCard value={overallQuizScore    != null ? `${overallQuizScore}%`   : "—"} label="Avg Quiz Score" accent={hasQuizData} info={CLASS_SUMMARY_MODALS.avgQuizScore}  onInfoClick={onInfoClick} />
          <StatCard value={overallQuizPassRate != null ? `${overallQuizPassRate}%`: "—"} label="Quiz Pass Rate"       info={CLASS_SUMMARY_MODALS.quizPassRate}  onInfoClick={onInfoClick} />
          <StatCard value={weakestModule ? `${weakestModule.pass_rate_pct ?? 0}%` : "—"} label="Weakest Module" sub={weakestModuleName} info={CLASS_SUMMARY_MODALS.weakestModule} onInfoClick={onInfoClick} />
        </div>
      </div>

      {/* ── Module Completion Rates ──────────────────────────────── */}
      {hasQuizData && (
        <div className="ar-section">
          <SectionHead label="Module Completion Rates" info={SECTION_MODALS.moduleCompletion} onInfoClick={onInfoClick} />
          <div className="ar-bars">
            {quizData.map(row => {
              const meta  = MODULES_META.find(m => m.id === row.module_id);
              const label = meta?.title || `Module ${row.module_id}`;
              const pct   = row.module_completion_pct ?? 0;
              const fill  = pct >= 80 ? "ar-bar-fill--accent" : pct >= 50 ? "ar-bar-fill--warn" : "ar-bar-fill--danger";
              return (
                <div key={row.module_id} className="ar-bar-row">
                  <span className="ar-bar-label" title={label}>{label}</span>
                  <div className="ar-bar-track">
                    <div className={`ar-bar-fill ${fill}`} style={{ width: `${(pct / maxModuleCompletion) * 100}%` }} />
                  </div>
                  <span className="ar-bar-value">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── First-Pass vs Overall Quiz Performance ──────────────── */}
      {hasQuizData && (
        <div className="ar-section">
          <SectionHead label="First-Pass Quiz Performance" info={SECTION_MODALS.firstPass} onInfoClick={onInfoClick} />
          <p className="ar-note" style={{ marginBottom: 10 }}>Green bar = first-pass rate · Grey bar = overall pass rate (including retakes)</p>
          <div className="ar-bars">
            {quizData.map(row => {
              const meta      = MODULES_META.find(m => m.id === row.module_id);
              const label     = meta?.title || `Module ${row.module_id}`;
              const fp        = row.first_pass_rate_pct ?? 0;
              const overall   = row.pass_rate_pct ?? 0;
              const maxVal    = Math.max(maxFirstPass, maxPassRate, 1);
              return (
                <div key={row.module_id}>
                  <div className="ar-bar-row">
                    <span className="ar-bar-label" title={label}>{label} — 1st pass</span>
                    <div className="ar-bar-track">
                      <div className="ar-bar-fill ar-bar-fill--accent" style={{ width: `${(fp / maxVal) * 100}%` }} />
                    </div>
                    <span className="ar-bar-value">{fp}%</span>
                  </div>
                  <div className="ar-bar-row" style={{ marginTop: -6, marginBottom: 6 }}>
                    <span className="ar-bar-label" style={{ opacity: 0.55 }}>— overall</span>
                    <div className="ar-bar-track">
                      <div className="ar-bar-fill ar-bar-fill--muted" style={{ width: `${(overall / maxVal) * 100}%` }} />
                    </div>
                    <span className="ar-bar-value" style={{ opacity: 0.55 }}>{overall}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Engagement Distribution ──────────────────────────────── */}
      {hasSimData && (
        <div className="ar-section">
          <SectionHead label="Student Engagement Distribution" info={SECTION_MODALS.engagement} onInfoClick={onInfoClick} />
          <div className="ar-engage-grid">
            {[
              { key: "active",   label: "Active",    sub: "sim in last 14d",  color: "#16a34a" },
              { key: "moderate", label: "Moderate",  sub: "15–30 days ago",   color: "#f59e0b" },
              { key: "inactive", label: "Inactive",  sub: "over 30 days ago", color: "#ef4444" },
              { key: "none",     label: "Never",     sub: "no sim sessions",  color: "#9ca3af" },
            ].map(({ key, label, sub, color }) => {
              const count = eng[key] ?? 0;
              const pct   = totalEnrolled > 0 ? Math.round((count / totalEnrolled) * 100) : 0;
              return (
                <div key={key} className="ar-engage-cell">
                  <span className="ar-engage-cell-count" style={{ color }}>{count}</span>
                  <span className="ar-engage-cell-label">{label}</span>
                  <span className="ar-engage-cell-pct">{pct}% of class</span>
                  <span className="ar-engage-cell-pct" style={{ opacity: 0.7 }}>{sub}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Cohort Progress by Session ───────────────────────────── */}
      {hasSimData && simData.cohort_progress?.length > 0 && (
        <div className="ar-section">
          <SectionHead label="Cohort Progress by Session" info={SECTION_MODALS.cohortProgress} onInfoClick={onInfoClick} />
          <div className="ar-bars">
            {simData.cohort_progress.map((pt) => (
              <div key={pt.attempt_number} className="ar-bar-row">
                <span className="ar-bar-label">
                  Session {pt.attempt_number}
                  <span className="ar-bar-label-sub"> · {pt.student_count} student{pt.student_count !== 1 ? "s" : ""}</span>
                </span>
                <div className="ar-bar-track">
                  <div className="ar-bar-fill ar-bar-fill--accent" style={{ width: `${pt.avg_score || 0}%` }} />
                </div>
                <span className="ar-bar-value">{pt.avg_score ?? 0}%</span>
              </div>
            ))}
          </div>
          {simData.cohort_progress_has_more && (
            <p className="ar-note">Showing first 30 sessions. Use course filter to narrow results.</p>
          )}
        </div>
      )}

      {/* ── Struggling Students ──────────────────────────────────── */}
      {hasSimData && (
        <div className="ar-section">
          <SectionHead label="Struggling Students" info={SECTION_MODALS.struggling} onInfoClick={onInfoClick} />
          {!simData.struggling_students?.length ? (
            <p className="ar-note">No students need attention — everyone is averaging above 60%.</p>
          ) : (
            <>
              <div className="ar-student-list">
                {simData.struggling_students.map((s) => (
                  <div key={s.id} className="ar-student-row">
                    <div className="ar-student-avatar">
                      {(s.full_name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <span className="ar-student-name">{s.full_name || "—"}</span>
                    <span className="ar-badge ar-badge--fail">{s.avg_score}%</span>
                    <span className="ar-student-attempts">
                      {s.total_attempts} attempt{s.total_attempts !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
              {simData.struggling_students_has_more && (
                <p className="ar-note">Showing 50 of more struggling students. Use course filter to narrow.</p>
              )}
            </>
          )}
        </div>
      )}

    </div>
  );
};

export default ClassSummaryTab;
