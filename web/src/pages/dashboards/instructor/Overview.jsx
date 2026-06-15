// file path: web/src/pages/dashboards/instructor/Overview.jsx

import './Overview.css';
import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AppContext } from '../../../context/AppContext';
import {
  Users, BookOpen, BarChart3, Settings,
  Gamepad2, AlertTriangle, TrendingUp, ArrowRight,
  CheckCircle2, Info, X,
} from 'lucide-react';
import gsap from 'gsap';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const STEP_LABELS = {
  step01: 'Trim Fins',    step02: 'Washing',       step03: 'Place Fish',
  step04: 'Dorsal Cut',   step05: 'Remove Organs',  step06: 'Rib Bones',
  step07: 'Dorsal Bones', step08: 'Ventral Bones',  step09: 'Lateral Bones',
  step10: 'Final Rinse',  step11: 'Inspect',
};

const MODAL_INFO = {
  total_students: {
    title: 'Total Students',
    description: 'The number of students who have been accepted into your courses.',
    purpose: 'Gives you an instant headcount of your active learner base across all courses you manage.',
    guide: 'A rising count indicates growing engagement. If this number is low, consider sharing your enrollment codes more broadly.',
  },
  simulation_attempts: {
    title: 'Simulation Attempts',
    description: 'Total completed simulation runs across all your enrolled students.',
    purpose: 'Tracks cumulative practice volume — more attempts generally correlate with better skill acquisition.',
    guide: 'High attempt counts with low average scores suggests students are persisting despite difficulty. Low counts with high scores may mean only top students are practicing.',
  },
  average_score: {
    title: 'Class Average Score',
    description: 'The mean simulation score (out of 100) across all completed attempts by your students.',
    purpose: 'The primary health indicator for your class — represents overall procedural accuracy in the deboning simulation.',
    guide: 'Scores above 75 indicate solid class-wide mastery. 60–74 is developing. Below 60 suggests the class needs targeted intervention on specific FSM steps.',
  },
  quiz_pass_rate: {
    title: 'Quiz Pass Rate',
    description: 'Percentage of quiz attempts that resulted in a passing score across all modules and students.',
    purpose: 'Measures theoretical knowledge retention alongside practical simulation performance.',
    guide: 'A high quiz pass rate paired with low simulation scores suggests students understand the theory but struggle with procedure. The inverse indicates practical intuition without conceptual grounding.',
  },
  need_attention: {
    title: 'Students Needing Attention',
    description: 'Count of students whose average simulation score is below 60%.',
    purpose: 'Flags at-risk learners who may need additional instructor support, re-demonstration, or remediation resources.',
    guide: 'Click "Review" to navigate to Student Management and identify these students by name. Reach out proactively to students with consecutive low-scoring attempts.',
  },
  quiz_performance: {
    title: 'Quiz Performance by Module',
    description: 'Per-module quiz pass rate across all students in your courses.',
    purpose: 'Identifies which modules students find hardest or easiest at the theoretical level.',
    guide: 'Modules with pass rates below 60% deserve attention — review quiz content for clarity. The simulation FSM maps directly to these modules, so a difficult quiz module often predicts a difficult simulation step.',
  },
  step_difficulty: {
    title: 'Simulation Step Difficulty',
    description: 'Total error count per FSM step across all simulation attempts, ranked from most to least errors.',
    purpose: 'Pinpoints which procedural steps in the deboning workflow students struggle with most.',
    guide: 'Steps at the top are candidates for targeted remediation. Consider adding hint resources, reviewing instructional videos for that step, or adjusting FSM tolerance in Rules Management if errors appear systemic.',
  },
  top_performers: {
    title: 'Top Performers',
    description: 'The three students with the highest average simulation scores among those who have completed at least one attempt.',
    purpose: 'Recognizes high achievers and gives you a benchmark for what excellent performance looks like in your class.',
    guide: 'Use top performers as reference points in class demonstrations. Consider peer-tutoring arrangements where high scorers mentor struggling students.',
  },
  recent_announcements: {
    title: 'Recent Announcements',
    description: 'The five most recent announcements posted across all your courses, in reverse chronological order.',
    purpose: 'Keeps you aware of recent communications sent to your students without navigating away from the overview.',
    guide: 'Go to Course Management to post new announcements. Announcements here span all your courses — the course name is shown on each item so you can tell them apart.',
  },
};

// ── Inline info modal ─────────────────────────────────────────────────────────
function InfoModal({ info, onClose }) {
  useEffect(() => {
    if (!info) return;
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [info, onClose]);

  if (!info) return null;
  return (
    <div className="io-modal-overlay" onClick={onClose}>
      <div className="io-modal" onClick={e => e.stopPropagation()}>
        <div className="io-modal-header">
          <span className="io-modal-title">{info.title}</span>
          <button className="io-modal-close" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <div className="io-modal-body">
          <div className="io-modal-section">
            <span className="io-modal-section-label">About</span>
            <p className="io-modal-text">{info.description}</p>
          </div>
          <div className="io-modal-section">
            <span className="io-modal-section-label">Purpose</span>
            <p className="io-modal-text">{info.purpose}</p>
          </div>
          <div className="io-modal-section">
            <span className="io-modal-section-label">How to read this</span>
            <p className="io-modal-text">{info.guide}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, iconColor, iconBg, warning, link, linkLabel, navigate, modalKey, onInfo }) {
  return (
    <div className={`io-kpi-card${warning ? ' io-kpi-card--warning' : ''}`}>
      <div className="io-kpi-top">
        <div className="io-kpi-icon" style={{ background: iconBg, color: iconColor }}>
          <Icon size={15} />
        </div>
        <button className="io-info-btn" onClick={() => onInfo(MODAL_INFO[modalKey])} aria-label="What is this?">
          <Info size={10} />
        </button>
      </div>
      <div className="io-kpi-value">{value ?? '—'}</div>
      <div className="io-kpi-label">{label}</div>
      {link && (
        <button className="io-stat-link" onClick={() => navigate(link)}>
          {linkLabel || 'View'} <ArrowRight size={10} />
        </button>
      )}
    </div>
  );
}

// ── Generic section panel ─────────────────────────────────────────────────────
function Panel({ title, modalKey, onInfo, children, noPad }) {
  return (
    <div className={`io-panel${noPad ? ' io-panel--nopad' : ''}`}>
      <div className="io-panel-head">
        <span className="io-panel-label">{title}</span>
        {modalKey && (
          <button className="io-info-btn" onClick={() => onInfo(MODAL_INFO[modalKey])} aria-label="Learn more">
            <Info size={10} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}


// ── Quiz performance by module ────────────────────────────────────────────────
function QuizPerformance({ data, onInfo }) {
  return (
    <Panel title="Quiz Performance by Module" modalKey="quiz_performance" onInfo={onInfo}>
      {(!data || data.length === 0) ? (
        <p className="io-empty">No quiz attempts recorded yet.</p>
      ) : (
        <div className="io-hbars">
          {data.map(row => {
            const pct = row.pass_rate_pct || 0;
            const fillColor = pct >= 70 ? 'var(--color-success)'
                            : pct >= 50 ? 'var(--color-warning)'
                            :              'var(--color-error)';
            return (
              <div key={row.module_id} className="io-hbar-row">
                <span className="io-hbar-label">Module {row.module_id}</span>
                <div className="io-hbar-track">
                  <div className="io-hbar-fill" style={{ width: `${pct}%`, background: fillColor }} />
                </div>
                <span className="io-hbar-pct">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ── FSM step difficulty (with inline student detail) ─────────────────────────
function StepDifficulty({ data, onInfo }) {
  const { token }                           = useContext(AppContext);
  const [activeStep,    setActiveStep]      = useState(null);
  const [students,      setStudents]        = useState([]);
  const [loadingDetail, setLoadingDetail]   = useState(false);

  if (!data || data.length === 0) return null;
  const totalErr = data.reduce((sum, d) => sum + Number(d.total_errors), 0) || 1;

  const handleRowClick = async (stepKey, stepLabel) => {
    if (activeStep?.key === stepKey) {
      setActiveStep(null);
      setStudents([]);
      return;
    }
    setActiveStep({ key: stepKey, label: stepLabel });
    setLoadingDetail(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/instructor/dashboard/step-students?step=${stepKey}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudents(res.data.students || []);
    } catch {
      setStudents([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const maxStudentErr = Math.max(...students.map(s => Number(s.total_errors)), 1);

  return (
    <Panel title="Simulation Step Difficulty" modalKey="step_difficulty" onInfo={onInfo}>
      <div className="io-hbars">
        {data.map(row => {
          const pct      = Math.round((Number(row.total_errors) / totalErr) * 100);
          const fillColor = pct > 66 ? 'var(--color-error)'
                          : pct > 33 ? 'var(--color-warning)'
                          :             'var(--color-success)';
          const label    = STEP_LABELS[row.step_key] || row.step_key;
          const isActive = activeStep?.key === row.step_key;
          return (
            <div
              key={row.step_key}
              className={`io-hbar-row io-hbar-row--clickable${isActive ? ' io-hbar-row--active' : ''}`}
              onClick={() => handleRowClick(row.step_key, label)}
            >
              <span className="io-hbar-label">{label}</span>
              <div className="io-hbar-track">
                <div className="io-hbar-fill" style={{ width: `${pct}%`, background: fillColor }} />
              </div>
              <span className="io-hbar-pct">{pct}%</span>
            </div>
          );
        })}
      </div>

      {activeStep && (
        <div className="io-step-detail">
          <div className="io-step-detail-head">
            <span className="io-step-detail-label">{activeStep.label} — students with errors</span>
          </div>
          {loadingDetail ? (
            <div className="io-step-detail-loading">
              <div className="w-5 h-5 rounded-full border-2 border-[color:var(--color-surface-3)] border-t-[color:var(--color-accent)] animate-spin" />
            </div>
          ) : students.length === 0 ? (
            <p className="io-step-detail-empty">No students have errors on this step.</p>
          ) : (
            <div className="io-step-student-list">
              {students.map((s, i) => {
                const pct = Math.round((Number(s.total_errors) / maxStudentErr) * 100);
                return (
                  <div key={s.id} className="io-step-student-row">
                    <span className="io-step-student-rank">#{i + 1}</span>
                    <div className="io-step-student-info">
                      <span className="io-step-student-name">{s.full_name}</span>
                      <div className="io-hbar-track io-step-student-bar">
                        <div className="io-hbar-fill" style={{ width: `${pct}%`, background: 'var(--color-error)' }} />
                      </div>
                    </div>
                    <div className="io-step-student-stats">
                      <span className="io-step-student-err">{s.total_errors} err</span>
                      <span className="io-step-student-att">{s.attempts} attempt{s.attempts !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

// ── Top performers ────────────────────────────────────────────────────────────
const MEDAL_COLORS = ['#f4b230', '#94a3b8', '#cd7f32'];

function TopPerformers({ data, onInfo }) {
  return (
    <Panel title="Top Performers" modalKey="top_performers" onInfo={onInfo}>
      {(!data || data.length === 0) ? (
        <p className="io-empty">No simulation data yet.</p>
      ) : (
        <div className="io-performer-list">
          {data.map((s, i) => (
            <div key={i} className="io-performer-row">
              <span className="io-performer-rank" style={{ color: MEDAL_COLORS[i] }}>#{i + 1}</span>
              <div className="io-performer-info">
                <span className="io-performer-name">{s.full_name}</span>
                <span className="io-performer-meta">{s.total_attempts} attempt{s.total_attempts !== 1 ? 's' : ''}</span>
              </div>
              <span className="io-performer-score">
                {s.avg_score}<span className="io-performer-unit">%</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Recent announcements ──────────────────────────────────────────────────────
const fmtAnnoDate = dt =>
  new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function RecentAnnouncements({ data, navigate, onInfo }) {
  return (
    <div className="io-panel io-panel--nopad">
      <div className="io-panel-head io-panel-head--padded">
        <span className="io-panel-label">Recent Announcements</span>
        <button className="io-info-btn" onClick={() => onInfo(MODAL_INFO.recent_announcements)} aria-label="Learn more">
          <Info size={10} />
        </button>
        <button className="io-stat-link" onClick={() => navigate('/instructor/dashboard/courses')}>
          Manage <ArrowRight size={10} />
        </button>
      </div>
      {(!data || data.length === 0) ? (
        <p className="io-empty io-announce-empty">No announcements posted yet.</p>
      ) : (
        <div className="io-announce-list">
          {data.map(item => (
            <div key={item.id} className="io-announce-item">
              <div className="io-announce-meta">
                <span className="io-announce-course">{item.course_name}</span>
                <span className="io-announce-date">{fmtAnnoDate(item.created_at)}</span>
              </div>
              <span className="io-announce-title">{item.title}</span>
              {item.body && <p className="io-announce-body">{item.body}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── At-risk panel ─────────────────────────────────────────────────────────────
function AtRiskPanel({ count, total, navigate, onInfo }) {
  const rate = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Panel title="At-Risk Students" modalKey="need_attention" onInfo={onInfo}>
      {count === 0 ? (
        <div className="io-atrisk-ok">
          <CheckCircle2 size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
          <span>All students on track</span>
        </div>
      ) : (
        <div className="io-atrisk-body">
          <div className="io-atrisk-count">
            <span className="io-atrisk-num">{count}</span>
            <span className="io-atrisk-label">of {total} below 60%</span>
          </div>
          <div className="io-health-track" style={{ marginTop: 8 }}>
            <div className="io-health-fill" style={{ width: `${rate}%`, background: 'var(--color-error)' }} />
          </div>
          <button className="io-atrisk-btn" onClick={() => navigate('/instructor/dashboard/students')}>
            Review students <ArrowRight size={10} />
          </button>
        </div>
      )}
    </Panel>
  );
}

// ── Quick navigation ──────────────────────────────────────────────────────────
const QUICK_NAV = [
  { icon: BookOpen,  label: 'Courses',   desc: 'Manage courses & codes',       path: '/instructor/dashboard/courses'   },
  { icon: Users,     label: 'Students',  desc: 'Enrollments & progress',        path: '/instructor/dashboard/students'  },
  { icon: BarChart3, label: 'Analytics', desc: 'Detailed performance reports',  path: '/instructor/dashboard/analytics' },
  { icon: Settings,  label: 'Settings',  desc: 'Profile & notifications',       path: '/instructor/dashboard/settings'  },
];

function QuickNav({ navigate }) {
  return (
    <div className="io-panel io-panel--nopad">
      <div className="io-panel-head io-panel-head--padded">
        <span className="io-panel-label">Quick Access</span>
      </div>
      <div className="io-qnav-list">
        {QUICK_NAV.map(item => (
          <button key={item.path} className="io-qnav-item" onClick={() => navigate(item.path)}>
            <div className="io-qnav-icon"><item.icon size={13} /></div>
            <div className="io-qnav-body">
              <span className="io-qnav-label">{item.label}</span>
              <span className="io-qnav-desc">{item.desc}</span>
            </div>
            <ArrowRight size={11} className="io-qnav-arrow" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
const Overview = () => {
  const { token, user } = useContext(AppContext);
  const navigate        = useNavigate();
  const contentRef      = useRef(null);

  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(false);
  const [modal,         setModal]         = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [stats,         setStats]         = useState({
    total_students: 0, pending_requests: 0, total_attempts: 0,
    average_score: 0,  students_need_attention: 0,
    total_courses: 0,  active_this_week: 0, quiz_pass_rate: 0,
    top_performers: [], weekly_sim_activity: [], quiz_by_module: [], step_errors: [],
  });

  useEffect(() => { fetchStats(); }, []);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/instructor/dashboard/announcements`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAnnouncements(res.data.announcements || []);
      } catch { /* non-critical — overview loads regardless */ }
    };
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    if (!contentRef.current || loading) return;
    gsap.fromTo(contentRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
    gsap.fromTo('.io-kpi-card',
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, stagger: 0.05, duration: 0.3, ease: 'power2.out', delay: 0.1 }
    );
  }, [loading]);

  const fetchStats = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await axios.get(`${API_URL}/api/instructor/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(res.data.stats);
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const openModal  = useCallback(info => setModal(info), []);
  const closeModal = useCallback(() => setModal(null), []);

  const firstName = user?.full_name?.split(' ')[0] || user?.email || 'Instructor';
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today     = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const needsAttn = stats.students_need_attention > 0;

  if (loading) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--color-surface-3)] border-t-[color:var(--color-accent)] animate-spin" />
        <p className="text-[12px] uppercase tracking-[0.16em] ink-faint">Loading overview…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3 p-8">
        <div className="w-12 h-12 flex items-center justify-center mb-1"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-error) 10%, transparent)' }}>
          <TrendingUp className="w-6 h-6" style={{ color: 'var(--color-error)' }} />
        </div>
        <p className="text-[14px] font-medium ink">Could not load overview</p>
        <p className="text-[13px] ink-muted text-center max-w-sm">
          There was a problem fetching your data. Check your connection and try again.
        </p>
        <button
          onClick={fetchStats}
          className="mt-2 px-4 py-2 bg-[color:var(--color-accent)] text-white text-[11px] uppercase tracking-[0.14em] font-medium hover:bg-[color:var(--color-accent-hover)] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <InfoModal info={modal} onClose={closeModal} />

      <div ref={contentRef} className="io-page" style={{ opacity: 0 }}>

        {/* ── Header ── */}
        <header className="io-header">
          <div>
            <h1 className="io-title">{greeting}, <span className="it">{firstName}.</span></h1>
            <p className="io-subtitle">{today} · Instructor overview across all your courses</p>
          </div>
          {stats.pending_requests > 0 && (
            <button className="io-pending-badge" onClick={() => navigate('/instructor/dashboard/students')}>
              <span className="io-pending-dot" />
              {stats.pending_requests} pending request{stats.pending_requests > 1 ? 's' : ''}
              <ArrowRight size={10} />
            </button>
          )}
        </header>

        {/* ── KPI strip ── */}
        <div className="io-kpi-strip">
          <KpiCard icon={Users}       label="Total Students"  value={stats.total_students}    iconColor="var(--color-accent)"    iconBg="color-mix(in srgb, var(--color-accent) 12%, transparent)"    modalKey="total_students"      onInfo={openModal} navigate={navigate} />
          <KpiCard icon={Gamepad2}    label="Sim Attempts"    value={stats.total_attempts}    iconColor="var(--color-accent)"    iconBg="color-mix(in srgb, var(--color-accent) 12%, transparent)"    modalKey="simulation_attempts" onInfo={openModal} navigate={navigate} />
          <KpiCard
            icon={TrendingUp} label="Class Avg Score"
            value={stats.average_score ? `${stats.average_score}%` : '—'}
            iconColor={stats.average_score >= 70 ? 'var(--color-success)' : stats.average_score >= 50 ? 'var(--color-warning)' : 'var(--color-error)'}
            iconBg={stats.average_score >= 70 ? 'color-mix(in srgb, var(--color-success) 12%, transparent)' : stats.average_score >= 50 ? 'color-mix(in srgb, var(--color-warning) 12%, transparent)' : 'color-mix(in srgb, var(--color-error) 12%, transparent)'}
            modalKey="average_score" onInfo={openModal} navigate={navigate}
          />
          <KpiCard
            icon={CheckCircle2} label="Quiz Pass Rate"
            value={stats.quiz_pass_rate ? `${stats.quiz_pass_rate}%` : '—'}
            iconColor="var(--color-accent)" iconBg="color-mix(in srgb, var(--color-accent) 12%, transparent)"
            modalKey="quiz_pass_rate" onInfo={openModal} navigate={navigate}
          />
          <KpiCard
            icon={AlertTriangle} label="Need Attention"
            value={stats.students_need_attention}
            iconColor={needsAttn ? 'var(--color-error)' : 'var(--color-fg-subtle)'}
            iconBg={needsAttn ? 'color-mix(in srgb, var(--color-error) 12%, transparent)' : 'color-mix(in srgb, var(--color-fg-subtle) 8%, transparent)'}
            warning={needsAttn}
            link={needsAttn ? '/instructor/dashboard/students' : null}
            linkLabel="Review"
            modalKey="need_attention" onInfo={openModal} navigate={navigate}
          />
        </div>

        {/* ── Body: main column + rail ── */}
        <div className="io-body-grid">
          <div className="io-body-main">
            <QuizPerformance data={stats.quiz_by_module} onInfo={openModal} />
            {stats.step_errors?.length > 0 && (
              <StepDifficulty data={stats.step_errors} onInfo={openModal} />
            )}
            <RecentAnnouncements data={announcements} navigate={navigate} onInfo={openModal} />
          </div>

          <div className="io-body-rail">
            <QuickNav navigate={navigate} />
            <TopPerformers data={stats.top_performers} onInfo={openModal} />
            <AtRiskPanel
              count={stats.students_need_attention}
              total={stats.total_students}
              navigate={navigate}
              onInfo={openModal}
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default Overview;
