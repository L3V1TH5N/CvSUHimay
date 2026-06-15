// file path: web/src/pages/dashboards/student/profile/ProfileProgress.jsx

import { CheckCircle, Clock, Target, TrendingUp, BookOpen, FlaskConical } from "lucide-react";

const getProgressColor = (p) =>
  p >= 80 ? "var(--color-accent)" : p >= 60 ? "#2e7d32" : p >= 40 ? "#d97706" : p > 0 ? "var(--color-error, #ef4444)" : "var(--color-surface-3)";

const getLevel = (p, attempted) => {
  if (!attempted) return "Not Started";
  if (p >= 80)    return "Expert";
  if (p >= 60)    return "Advanced";
  if (p >= 40)    return "Intermediate";
  return "Beginner";
};

const getScoreColor = (s) =>
  s >= 90 ? "var(--color-accent)"
  : s >= 80 ? "#2e7d32"
  : s >= 70 ? "#d97706"
  : "var(--color-error, #ef4444)";

// ── Recent quiz scores ────────────────────────────────────────────────

const RecentScores = ({ recentScores }) => (
  <div className="prof-block">
    <div className="prof-block-head">
      <div className="prof-block-title">Recent Quiz Scores</div>
    </div>
    {recentScores.length === 0 ? (
      <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)' }}>
        No quiz attempts yet.
      </div>
    ) : (
      recentScores.map((s, i) => (
        <div key={i} className="prof-score-row">
          <div>
            <div className="prof-score-module">{s.module_name}</div>
            <div className="prof-score-date">{s.date}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="prof-score-pct" style={{ color: getScoreColor(s.percentage) }}>
              {s.percentage}%
            </span>
            {s.improvement !== null && (
              <span className={`prof-score-delta prof-score-delta--${s.improvement >= 0 ? 'pos' : 'neg'}`}>
                {s.improvement >= 0 ? `+${s.improvement}` : s.improvement}
              </span>
            )}
          </div>
        </div>
      ))
    )}
  </div>
);

// ── Skill development ─────────────────────────────────────────────────

const SkillDevelopment = ({ skillProgress }) => (
  <div className="prof-block">
    <div className="prof-block-head">
      <div className="prof-block-title">Skill Development</div>
      <div className="prof-block-sub">Based on best quiz score per module</div>
    </div>
    <div className="prof-block-body">
      {skillProgress.map((sk, i) => {
        const level = getLevel(sk.progress, sk.attempted);
        return (
          <div key={i} className="prof-skill-row">
            <div className="prof-skill-label-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <span className="prof-skill-name">{sk.name}</span>
                <span className="prof-skill-badge">{level}</span>
              </div>
              <span className="prof-skill-pct">{sk.attempted ? `${sk.progress}%` : "—"}</span>
            </div>
            <div className="prof-skill-bar">
              <i style={{ width: `${sk.progress}%`, background: getProgressColor(sk.progress) }} />
            </div>
            <div className="prof-skill-meta">
              <span className="prof-skill-desc">
                {sk.attempted ? sk.description : "No quiz attempts yet for this module."}
              </span>
              {sk.lastPracticed && (
                <span className="prof-skill-time">
                  <Clock style={{ width: 10, height: 10 }} />
                  {sk.lastPracticed}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ── Milestones ────────────────────────────────────────────────────────

const MILESTONE_XP = [25, 50, 75, 100, 150, 200];

const MilestoneTimeline = ({ milestones }) => {
  const nextIndex = milestones.findIndex(m => !m.completed);

  return (
    <div className="prof-block">
      <div className="prof-block-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="prof-block-title">Your Journey</div>
        {nextIndex !== -1 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706', border: '1px solid #d97706', padding: '2px 8px', fontFamily: 'var(--font-ui)', letterSpacing: '0.08em' }}>
            +{MILESTONE_XP[nextIndex] ?? 50} XP up next
          </span>
        )}
      </div>
      <div className="prof-block-body">
        <div className="prof-milestones">
          <div className="prof-milestone-line" />
          {milestones.map((m, i) => {
            const isNext   = i === nextIndex;
            const isFuture = !m.completed && !isNext;
            const xp       = MILESTONE_XP[i] ?? 50;

            return (
              <div key={i} className="prof-milestone-row">
                <div className={`prof-milestone-node${m.completed ? ' prof-milestone-node--done' : isNext ? ' prof-milestone-node--next' : ''}`}>
                  {m.completed
                    ? <CheckCircle style={{ width: 16, height: 16 }} />
                    : <span>{m.icon}</span>
                  }
                  {isNext && (
                    <span style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '1.5px solid var(--color-accent)', opacity: 0.3, animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
                  )}
                </div>
                <div className="prof-milestone-content" style={{ opacity: isFuture ? 0.45 : 1 }}>
                  <div className="prof-milestone-title-row">
                    <span className={`prof-milestone-title${isFuture ? ' prof-milestone-title--future' : ''}`}>
                      {m.title}
                    </span>
                    <span className={`prof-milestone-xp${m.completed ? ' prof-milestone-xp--done' : isNext ? ' prof-milestone-xp--next' : ''}`}>
                      {m.completed ? `✓ +${xp} XP` : `+${xp} XP`}
                    </span>
                    {isNext && <span className="prof-milestone-up-next">Up next</span>}
                  </div>
                  <div className="prof-milestone-desc">{m.description}</div>
                  {m.date && (
                    <div className={`prof-milestone-date${m.completed ? ' prof-milestone-date--done' : ''}`}>
                      {m.date}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Performance summary ───────────────────────────────────────────────

const PerformanceSummary = ({ stats }) => {
  const modulePct = stats.total_modules > 0
    ? Math.round((stats.lessons_done / stats.total_modules) * 100) : 0;
  const quizPct = stats.avg_score || 0;
  const simPct  = Math.round(Math.min(stats.sim_count / 10, 1) * 100);
  const overall = Math.min(100, Math.round(modulePct * 0.4 + quizPct * 0.3 + simPct * 0.3));

  const breakdown = [
    { label: "Modules read",   pct: modulePct, value: `${stats.lessons_done}/${stats.total_modules}`, icon: BookOpen,     color: "var(--color-accent)" },
    { label: "Avg quiz score", pct: quizPct,   value: quizPct ? `${quizPct}%` : "—",                  icon: Target,       color: "#2e7d32" },
    { label: "Simulations",    pct: simPct,    value: `${stats.sim_count}/10`,                         icon: FlaskConical, color: "#0d9488" },
  ];

  return (
    <div className="prof-perf-block">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 0 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)', fontWeight: 500, marginBottom: 4 }}>
            Overall Score
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span className="prof-perf-overall">{overall}%</span>
            <span className="prof-perf-sub">weighted avg</span>
          </div>
        </div>
        <TrendingUp style={{ width: 28, height: 28, color: 'var(--color-accent)', opacity: 0.15 }} />
      </div>

      <div className="prof-perf-divider" />

      {breakdown.map(({ label, pct, value, icon: Icon, color }) => (
        <div key={label} className="prof-perf-row">
          <div className="prof-perf-row-label">
            <div className="prof-perf-label">
              <Icon style={{ width: 11, height: 11, color }} />
              {label}
            </div>
            <span className="prof-perf-val">{value}</span>
          </div>
          <div className="prof-perf-bar">
            <i style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────

const ProfileProgress = ({ data, loading, error }) => {
  if (loading) {
    return (
      <div className="prof-spinner">
        <div className="prof-spinner-ring" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', fontSize: 13, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-ui)' }}>
        Failed to load progress data.
      </div>
    );
  }

  const { stats, recentScores, skillProgress, milestones } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PerformanceSummary stats={stats} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        <RecentScores     recentScores={recentScores} />
        <SkillDevelopment skillProgress={skillProgress} />
      </div>
      <MilestoneTimeline milestones={milestones} />
    </div>
  );
};

export default ProfileProgress;
