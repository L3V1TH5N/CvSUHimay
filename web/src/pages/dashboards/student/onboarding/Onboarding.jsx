// file path: web/src/pages/dashboards/student/onboarding/Onboarding.jsx

import './Onboarding.css';
import { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { AppContext } from '../../../../context/AppContext';
import {
  Fish, BarChart3, BookOpen, Gamepad2, User, Trophy,
  GraduationCap, ClipboardList, Settings,
  Bell, Moon, LogOut, ChevronLeft, Zap, Compass,
  Check, Sparkles, ArrowRight,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/* ── Tour step definitions — ordered top→bottom, left→right ─────────────── */
// Sidebar: profile block → Study group → Practice group → Progress group → bottom nav
// Navbar: notifications → theme
// Main content last
const TOUR_STEPS = [
  { tourId: 'profile',        title: 'Your Profile',       desc: 'Quick access to your avatar, level, and XP progress.',                              icon: User         },
  { tourId: 'overview',       title: 'Dashboard Overview', desc: 'At-a-glance view of XP, announcements, and recent activity.',                       icon: BarChart3    },
  { tourId: 'courses',        title: 'Courses',            desc: 'Join classes and view course materials.',                                            icon: GraduationCap},
  { tourId: 'modules',        title: 'Modules',            desc: 'Open learning modules and follow guided procedures.',                                icon: BookOpen     },
  { tourId: 'quizzes',        title: 'Quizzes',            desc: 'Take short quizzes to test knowledge and gain points.',                             icon: ClipboardList},
  { tourId: 'deboning-guide', title: 'Deboning Guide',     desc: 'Reference the step-by-step deboning guide and learning resources.',                 icon: Fish         },
  { tourId: 'simulations',    title: 'Simulator',          desc: 'Practice fish deboning in an interactive 3D simulation.',                           icon: Gamepad2     },
  { tourId: 'leaderboard',    title: 'Leaderboard',        desc: 'See how your XP ranks against classmates.',                                         icon: Trophy       },
  { tourId: 'settings',       title: 'Settings',           desc: 'Manage account settings and replay the tour.',                                      icon: Settings     },
  { tourId: 'signout',        title: 'Sign Out',           desc: 'Use this to end your session safely.',                                              icon: LogOut       },
  { tourId: 'notifications',  title: 'Notifications',      desc: 'Check important updates and messages from instructors.',                            icon: Bell         },
  { tourId: 'theme',          title: 'Theme Toggle',       desc: 'Switch between light and dark themes to suit your environment.',                    icon: Moon         },
  { tourId: 'main',           title: 'Main Content',       desc: 'This is where modules, the simulator, and your course content appear.',             icon: Compass      },
];

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Irregular'];

const EXP_LEVELS = [
  { value: 'beginner',     label: 'Beginner',     desc: 'Never deboned a fish'    },
  { value: 'some',         label: 'Some',         desc: 'Watched it done before'  },
  { value: 'intermediate', label: 'Intermediate', desc: 'Done it once or twice'   },
  { value: 'advanced',     label: 'Advanced',     desc: 'Done it many times'      },
];

const DEPARTMENTS = [
  'Fisheries and Aquatic Sciences Department (FASD)',
  'Other',
];

/* ── Step progress segments ─────────────────────────────────────────────── */
const StepSegments = ({ total, current }) => (
  <div className="onb-steps">
    {Array.from({ length: total }, (_, i) => (
      <div key={i} className={`onb-step-seg${i <= current ? ' onb-step-seg--done' : ''}`} />
    ))}
  </div>
);

/* ── Form field wrapper ─────────────────────────────────────────────────── */
const Field = ({ label, children, error }) => (
  <div className="onb-form-field">
    {label && <label className="onb-field-label">{label}</label>}
    {children}
    {error && <p className="onb-field-error" role="alert">{error}</p>}
  </div>
);

/* ══════════════════════════════════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════════════════════════════════ */

/**
 * OnboardingWizard: 3-step modal (Welcome → Profile → Tour → Done).
 *
 * Props:
 *  onComplete          — called when the wizard should close entirely.
 *  onForceSidebarOpen  — expands the sidebar so tour spotlights are visible.
 *  initialStep         — 'welcome' (default) or 'tour' (resume mid-tour on re-login).
 */
const OnboardingWizard = ({ onComplete, onForceSidebarOpen, initialStep = 'welcome' }) => {
  const { user, refreshUser } = useContext(AppContext);

  const [step,       setStep]       = useState(initialStep);
  const [tourIdx,    setTourIdx]    = useState(0);
  const [spotlight,  setSpotlight]  = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [xpEarned,  setXpEarned]   = useState(0);

  const [form, setForm] = useState({
    full_name:        user?.full_name        || '',
    username:         user?.username         || '',
    student_id:       user?.student_id       || '',
    department:       user?.department       || '',
    year_level:       user?.year_level       || '',
    experience_level: user?.experience_level || 'beginner',
    bio:              user?.bio              || '',
  });

  const [formErrors, setFormErrors] = useState({});
  const modalRef = useRef(null);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  /* ── Spotlight positioning ── */
  const positionSpotlight = (idx) => {
    const el = document.querySelector(`[data-tour="${TOUR_STEPS[idx].tourId}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSpotlight({ top: r.top, left: r.left, width: r.width, height: r.height });
  };

  useEffect(() => {
    if (step !== 'tour') return;
    onForceSidebarOpen?.();
    const t = setTimeout(() => positionSpotlight(tourIdx), 380);
    return () => clearTimeout(t);
  }, [step]);

  /* Focus trap & keyboard handling for modal accessibility */
  useEffect(() => {
    const node = modalRef.current;
    if (!node) return;
    const focusable = Array.from(node.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.hasAttribute('disabled'));
    if (focusable.length) focusable[0].focus();

    const onKey = (e) => {
      if (e.key === 'Tab') {
        if (!focusable.length) { e.preventDefault(); return; }
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
        }
      }
      if (e.key === 'Escape') onComplete?.();
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, [step, modalRef]);

  useEffect(() => {
    if (step !== 'tour') return;
    const t = setTimeout(() => positionSpotlight(tourIdx), 200);
    return () => clearTimeout(t);
  }, [tourIdx]);

  /* ── Tour card position ── */
  const tourCardStyle = spotlight
    ? (() => {
        const CARD_W = 308;
        const MARGIN = 18;
        const left   = Math.min(spotlight.left + spotlight.width + MARGIN, window.innerWidth - CARD_W - 12);
        const rawTop = spotlight.top + spotlight.height / 2 - 130;
        const top    = Math.max(12, Math.min(rawTop, window.innerHeight - 310));
        return { left, top };
      })()
    : { left: 280, top: '28%' };

  /* ── Submit profile ── */
  const submitOnboarding = async () => {
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/onboarding/complete`, form);
      setXpEarned(data.xp_earned ?? 0);
      await refreshUser();
      setStep('tour');
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors && typeof data.errors === 'object') {
        setFormErrors(data.errors);
        setSubmitting(false);
        return;
      }
      if (data?.details) {
        const details = Array.isArray(data.details) ? data.details : [data.details];
        const mapped  = {};
        details.forEach(d => {
          const msg = String(d);
          if (/name|full_name/i.test(msg))       mapped.full_name  = msg;
          else if (/username/i.test(msg))         mapped.username   = msg;
          else if (/student[_ ]?id/i.test(msg))  mapped.student_id = msg;
          else mapped.submit = mapped.submit ? `${mapped.submit}; ${msg}` : msg;
        });
        setFormErrors(mapped);
        setSubmitting(false);
        return;
      }
      if (err.response?.status === 409) {
        const freshUser = await refreshUser();
        if (!freshUser?.tour_completed) setStep('tour');
        else onComplete();
      } else {
        toast.error(err.response?.data?.error || 'Failed to save. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Submit tour completion ── */
  async function submitTourComplete() {
    try {
      axios.post(`${API_URL}/api/onboarding/tour-complete`).catch(() => {});
      await refreshUser();
      onComplete?.();
    } catch {
      onComplete?.();
    }
  }

  /* ════════════ TOUR ════════════ */
  if (step === 'tour') {
    const ts   = TOUR_STEPS[tourIdx];
    const Icon = ts.icon;
    return (
      <>
        <div className="fixed inset-0 z-[9985]" />
        {spotlight && (
          <div
            className="fixed pointer-events-none"
            style={{
              top:        spotlight.top  - 6,
              left:       spotlight.left - 6,
              width:      spotlight.width  + 12,
              height:     spotlight.height + 12,
              zIndex:     9992,
              boxShadow:  '0 0 0 9999px rgba(0,0,0,0.72)',
              border:     '1px solid var(--color-accent)',
              background: 'transparent',
              transition: 'top 300ms cubic-bezier(0.16,1,0.3,1), left 300ms cubic-bezier(0.16,1,0.3,1), width 300ms cubic-bezier(0.16,1,0.3,1), height 300ms cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        )}

        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onb-tour-title"
          className="onb-tour-card"
          style={{ ...tourCardStyle }}
        >
          <div className="onb-tour-progress-track">
            <div
              className="onb-tour-progress-fill"
              style={{ width: `${((tourIdx + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>

          <div className="onb-tour-body">
            <p className="onb-tour-step-label">Step {tourIdx + 1} of {TOUR_STEPS.length}</p>
            <h3 id="onb-tour-title" className="onb-tour-title">{ts.title}</h3>
            <p className="onb-tour-desc">{ts.desc}</p>
            <button
              className="onb-tour-skip"
              onClick={() => {
                if (window.confirm('Skip the tour? You can replay it later from Settings.')) {
                  submitTourComplete();
                }
              }}
            >
              Skip tour
            </button>
          </div>

          <div className="onb-tour-footer">
            <button
              className="onb-btn-text"
              onClick={() => setTourIdx(i => i - 1)}
              disabled={tourIdx === 0}
            >
              <ChevronLeft size={13} /> Back
            </button>

            <div className="onb-tour-dots">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`onb-tour-dot${i === tourIdx ? ' onb-tour-dot--active' : ''}`}
                  style={{ width: i === tourIdx ? 14 : 4 }}
                />
              ))}
            </div>

            <button
              className="onb-btn-primary"
              style={{ padding: '8px 16px' }}
              onClick={() => tourIdx < TOUR_STEPS.length - 1 ? setTourIdx(i => i + 1) : submitTourComplete()}
            >
              {tourIdx < TOUR_STEPS.length - 1
                ? <>Next <ArrowRight size={11} /></>
                : <>Done <Check size={11} /></>
              }
            </button>
          </div>
        </div>
      </>
    );
  }

  /* ════════════ MODAL STEPS ════════════ */
  return (
    <div className="onb-overlay">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onb-title"
        className="onb-modal"
        style={{ maxWidth: step === 'profile' ? 560 : 440 }}
      >

        {/* ── WELCOME ── */}
        {step === 'welcome' && (
          <div className="onb-welcome-body">
            <div className="onb-logo-box">
              <Fish size={26} />
            </div>
            <p className="onb-eyebrow">Getting Started</p>
            <h1 id="onb-title" className="onb-title">
              Welcome to <span className="it">CvSUHimay.</span>
            </h1>
            <p className="onb-subtitle">
              Hi, <strong>{user?.full_name || user?.email}</strong> — let's set up your profile and show you around. Takes about 2–3 minutes.
            </p>
            <div className="onb-checklist">
              {[
                { Icon: User,    text: 'Set up your student profile'        },
                { Icon: Compass, text: 'Quick tour of the dashboard'        },
                { Icon: Zap,     text: 'Earn up to 45 XP + unlock a badge' },
              ].map(({ Icon, text }) => (
                <div key={text} className="onb-checklist-item">
                  <Icon size={14} className="onb-checklist-icon" />
                  {text}
                </div>
              ))}
            </div>
            <StepSegments total={3} current={0} />
            <button
              className="onb-btn-primary onb-btn-primary--full"
              onClick={() => setStep('profile')}
              style={{ marginTop: 16 }}
            >
              Set Up Profile <ArrowRight size={11} />
            </button>
          </div>
        )}

        {/* ── PROFILE ── */}
        {step === 'profile' && (
          <>
            <div className="onb-header">
              <p className="onb-eyebrow">Step 2 of 3</p>
              <h2 id="onb-title" className="onb-title onb-title--sm">
                Set Up Your <span className="it">Profile.</span>
              </h2>
              <p className="onb-subtitle">
                Fill more fields to earn more XP — up to 45 XP for a complete profile.
              </p>
            </div>

            <div className="onb-body onb-form-space" style={{ maxHeight: '52vh' }}>
              <div className="onb-form-grid-2">
                <Field label="Full Name" error={formErrors.full_name}>
                  <input
                    className="onb-input"
                    placeholder="Juan Dela Cruz"
                    value={form.full_name}
                    onChange={e => set('full_name', e.target.value)}
                  />
                </Field>
                <Field label="Username" error={formErrors.username}>
                  <div className="onb-input-wrap">
                    <span className="onb-input-prefix">@</span>
                    <input
                      className="onb-input onb-input--prefix"
                      placeholder="juandelacruz"
                      value={form.username}
                      onChange={e => set('username', e.target.value)}
                    />
                  </div>
                </Field>
              </div>

              <div className="onb-form-grid-2">
                <Field label="Student ID" error={formErrors.student_id}>
                  <input
                    className="onb-input"
                    placeholder="2024-00001"
                    value={form.student_id}
                    onChange={e => set('student_id', e.target.value)}
                  />
                </Field>
                <Field label="Department" error={formErrors.department}>
                  <select
                    className="onb-input"
                    value={form.department}
                    onChange={e => set('department', e.target.value)}
                  >
                    <option value="">Select department</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Year Level">
                <div className="onb-chip-row">
                  {YEAR_LEVELS.map(y => (
                    <button
                      key={y}
                      className={`onb-chip${form.year_level === y ? ' onb-chip--active' : ''}`}
                      onClick={() => set('year_level', y)}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="How comfortable are you with fish deboning?">
                <div className="onb-exp-grid">
                  {EXP_LEVELS.map(({ value, label, desc }) => (
                    <button
                      key={value}
                      className={`onb-exp-card${form.experience_level === value ? ' onb-exp-card--active' : ''}`}
                      onClick={() => set('experience_level', value)}
                    >
                      <p className="onb-exp-card-label">{label}</p>
                      <p className="onb-exp-card-desc">{desc}</p>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Bio (optional)">
                <textarea
                  className="onb-input onb-textarea"
                  rows={2}
                  placeholder="Tell your classmates a bit about yourself..."
                  value={form.bio}
                  onChange={e => set('bio', e.target.value)}
                />
              </Field>
            </div>

            <div className="onb-footer">
              <button className="onb-btn-text" onClick={() => setStep('welcome')}>
                <ChevronLeft size={13} /> Back
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <StepSegments total={3} current={1} />
                <button
                  className="onb-btn-primary"
                  onClick={submitOnboarding}
                  disabled={submitting}
                >
                  {submitting
                    ? <div className="onb-spinner" />
                    : <>Save &amp; Continue <ArrowRight size={11} /></>
                  }
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── DONE ── */}
        {step === 'done' && (
          <>
            <div className="onb-done-bar" />
            <div className="onb-done-body">
              <div className="onb-done-check">
                <Check size={22} strokeWidth={2.5} />
              </div>
              <p className="onb-eyebrow">Setup Complete</p>
              <h2 id="onb-title" className="onb-title">
                You're all <span className="it">set.</span>
              </h2>
              <p className="onb-subtitle">
                Your profile is ready. Start exploring and level up your fisheries knowledge.
              </p>

              <div className="onb-done-stats">
                <div className="onb-done-stat">
                  <p className="onb-done-stat-label">XP Earned</p>
                  <p className="onb-done-stat-val" aria-live="polite">+{xpEarned}</p>
                  <p className="onb-done-stat-sub">from profile setup</p>
                </div>
                <div className="onb-done-stat">
                  <p className="onb-done-stat-label">Badge Unlocked</p>
                  <p className="onb-done-stat-val" style={{ fontFamily: 'var(--font-ui)', fontSize: 14, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                    Getting Started
                  </p>
                  <p className="onb-done-stat-sub">Common · Unlocked</p>
                </div>
              </div>

              {xpEarned < 45 && (
                <p className="onb-done-hint">
                  Complete your profile in Settings to earn the remaining {45 - xpEarned} XP.
                </p>
              )}

              <StepSegments total={3} current={2} />
              <button
                className="onb-btn-primary onb-btn-primary--full"
                onClick={onComplete}
                style={{ marginTop: 16 }}
              >
                <Sparkles size={12} /> Start Learning
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default OnboardingWizard;
