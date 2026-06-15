// File path: web/src/pages/dashboards/student/Quizzes.jsx
//
// Quiz lobby — shows one card per module with progress stats and a start button.
// Quiz-taking and results logic live entirely in QuizAttempt.jsx.

import './Quizzes.css';
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Brain, ArrowLeft, ArrowRight, Clock, Hash, AlertTriangle, X,
} from "lucide-react";
import gsap from "gsap";

const API_URL            = import.meta.env.VITE_API_URL || "http://localhost:4000";
const QUESTIONS_PER_QUIZ = 10;
const TIME_PER_QUESTION  = 60;  // must match SECONDS_PER_QUESTION in QuizAttempt
const PASS_PERCENT       = 70;
const PASS_THRESHOLD     = Math.ceil(QUESTIONS_PER_QUIZ * PASS_PERCENT / 100);

// ── QuizConfirmModal — expanding panel (mirrors Modules ExpandingCard) ────
const QuizConfirmModal = ({ quiz, originRect, onConfirm, onClose, onReadModule }) => {
  const [phase, setPhase] = useState("enter");
  const vw         = window.innerWidth;
  const vh         = window.innerHeight;
  const expandedW  = Math.min(420, vw - 32);
  const expandedH  = Math.min(260, vh - 64);
  const expandedT  = Math.max(16, (vh - expandedH) / 2);
  const expandedL  = (vw - expandedW) / 2;
  const contentDelay = Math.round(460 * 0.38);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("open")));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = () => { setPhase("closing"); setTimeout(onClose, 300); };
  const atOrigin    = phase === "enter" || phase === "closing";
  const isOpen      = phase === "open";

  const panelStyle = {
    position: "fixed", zIndex: 50,
    top:    atOrigin ? originRect.top    : expandedT,
    left:   atOrigin ? originRect.left   : expandedL,
    width:  atOrigin ? originRect.width  : expandedW,
    height: atOrigin ? originRect.height : expandedH,
    overflow: "hidden",
    background: 'var(--color-surface)',
    border: '1px solid var(--color-hairline)',
    transition: phase === "enter" ? "none" : phase === "open"
      ? `top 460ms cubic-bezier(0.16,1,0.3,1), left 460ms cubic-bezier(0.16,1,0.3,1), width 460ms cubic-bezier(0.16,1,0.3,1), height 460ms cubic-bezier(0.16,1,0.3,1), box-shadow 460ms cubic-bezier(0.16,1,0.3,1)`
      : `top 300ms cubic-bezier(0.4,0,0.2,1), left 300ms cubic-bezier(0.4,0,0.2,1), width 300ms cubic-bezier(0.4,0,0.2,1), height 300ms cubic-bezier(0.4,0,0.2,1), box-shadow 300ms cubic-bezier(0.4,0,0.2,1)`,
    boxShadow: isOpen
      ? "0 25px 60px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)"
      : "0 4px 16px -4px rgba(0,0,0,0.12)",
  };

  const contentStyle = {
    transition: isOpen
      ? `opacity 220ms ease-out ${contentDelay}ms, transform 320ms cubic-bezier(0.16,1,0.3,1) ${contentDelay}ms`
      : "opacity 90ms ease-in, transform 90ms ease-in",
    opacity:   isOpen ? 1 : 0,
    transform: isOpen ? "translateY(0)" : "translateY(7px)",
  };

  return (
    <>
      <div
        style={{ transition: `opacity ${isOpen ? 253 : 300}ms cubic-bezier(0.16,1,0.3,1)`, opacity: isOpen ? 1 : 0 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={handleClose}
      />
      <div style={panelStyle}>
        <div style={contentStyle} className="h-full flex flex-col">

          {/* Header */}
          <div className="flex items-start justify-between p-6 pb-4 flex-shrink-0">
            <div>
              <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)', fontWeight: 500, marginBottom: 6 }}>
                Module not completed
              </p>
              <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--color-fg)', lineHeight: 1.3 }}>
                {quiz.title}
              </h2>
            </div>
            <button onClick={handleClose}
              style={{ padding: 6, color: 'var(--color-fg-muted)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, marginLeft: 8, lineHeight: 0, transition: 'color 120ms ease' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--color-fg)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-fg-muted)'}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ height: 1, background: 'var(--color-hairline)', margin: '0 24px', flexShrink: 0 }} />

          {/* Warning */}
          <div style={{
            margin: '14px 24px',
            padding: '12px 14px',
            borderLeft: '3px solid #d97706',
            background: 'color-mix(in srgb, #d97706 5%, transparent)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
            flexShrink: 0,
          }}>
            <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 13, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 }}>
              You haven't completed this module's reading material. Read the module first for better quiz results.
            </p>
          </div>

          <div className="flex-1" />

          {/* Actions */}
          <div style={{ height: 1, background: 'var(--color-hairline)', flexShrink: 0 }} />
          <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
            <button
              onClick={onReadModule}
              style={{ padding: '10px 20px', background: 'none', border: '1px solid var(--color-hairline)', cursor: 'pointer', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'var(--font-ui)', color: 'var(--color-fg-muted)', transition: 'border-color 140ms ease, color 140ms ease' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-fg)'; e.currentTarget.style.color = 'var(--color-fg)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-hairline)'; e.currentTarget.style.color = 'var(--color-fg-muted)'; }}
            >
              Read module
            </button>
            <button
              onClick={onConfirm}
              style={{ padding: '10px 20px', background: 'var(--color-fg)', color: '#ffffff', border: 'none', cursor: 'pointer', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'var(--font-ui)', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'background-color 200ms ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#d97706'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-fg)'; }}
            >
              Take anyway <ArrowRight size={12} />
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

// ── Skeleton ──────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="quiz-skeleton">
    <div className="quiz-skeleton-bar" />
    <div className="quiz-skeleton-body">
      <div className="quiz-skeleton-line" style={{ height: 11, width: '20%' }} />
      <div className="quiz-skeleton-line" style={{ height: 18, width: '78%', marginTop: 4 }} />
      <div className="quiz-skeleton-line" style={{ height: 13, width: '100%', marginTop: 6 }} />
      <div className="quiz-skeleton-line" style={{ height: 13, width: '65%' }} />
      <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
        <div className="quiz-skeleton-line" style={{ height: 22, width: 68 }} />
        <div className="quiz-skeleton-line" style={{ height: 22, width: 55 }} />
        <div className="quiz-skeleton-line" style={{ height: 22, width: 55 }} />
      </div>
      <div className="quiz-skeleton-line" style={{ height: 52, width: '100%', marginTop: 8 }} />
    </div>
    <div className="quiz-skeleton-footer">
      <div className="quiz-skeleton-line" style={{ height: 44, width: '100%' }} />
    </div>
  </div>
);

// ── QuizCard ──────────────────────────────────────────────────────────────
const QuizCard = ({ quiz, progress, moduleCompleted, onStart }) => {
  const cardRef    = useRef(null);
  const contentRef = useRef(null);
  const bestScore    = progress?.best_score ?? null;
  const avgPct       = progress ? Number(progress.avg_percentage ?? 0) : null;
  const attemptCount = progress?.attempt_count ?? 0;
  // [fix] Use best_score to determine passed: best_score >= 7 (70% of 10) means at least
  // one passing attempt exists — matches server-side definition.
  const passed = bestScore !== null && bestScore >= PASS_THRESHOLD;

  const handleStart = () => {
    const el = cardRef.current, content = contentRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (content) {
      content.style.transition = "none";
      content.style.opacity    = "0";
      content.style.transform  = "translateY(5px)";
    }
    el.style.visibility = "hidden";
    onStart(quiz, rect, () => {
      el.style.visibility = "";
      requestAnimationFrame(() => {
        if (content) {
          content.style.transition = `opacity 180ms ease-out, transform 180ms cubic-bezier(0.16,1,0.3,1)`;
          content.style.opacity    = "1";
          content.style.transform  = "translateY(0)";
        }
      });
    });
  };

  return (
    <div ref={cardRef} className="quiz-card">
      <div ref={contentRef} className="quiz-card-inner">
      <div className="quiz-card-body">
        {/* Number + title + module-done badge */}
        <div className="quiz-card-head">
          <div>
            <p className="quiz-card-num">{String(quiz.id).padStart(2, '0')}</p>
            <h2 className="quiz-card-title">{quiz.title}</h2>
          </div>
          <div className={`quiz-module-badge ${moduleCompleted ? 'quiz-module-badge--done' : 'quiz-module-badge--pending'}`}>
            <span className={`quiz-badge-dot ${moduleCompleted ? 'quiz-badge-dot--done' : 'quiz-badge-dot--pending'}`} />
            {moduleCompleted ? 'Module done' : 'Read first'}
          </div>
        </div>

        <p className="quiz-card-desc">{quiz.description}</p>

        <div className="quiz-card-tags">
          <span className="quiz-card-tag">
            {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
          </span>
          <span className="quiz-card-tag"><Hash size={10} />{QUESTIONS_PER_QUIZ} questions</span>
          <span className="quiz-card-tag"><Clock size={10} />10 min</span>
        </div>

        {progress ? (
          <div className="quiz-stats">
            <div className="quiz-stat">
              <span className="quiz-stat-label">Best</span>
              <span className="quiz-stat-val" style={{ color: passed ? 'var(--color-accent)' : 'var(--color-fg)' }}>
                {bestScore}<span className="quiz-stat-sub">/10</span>
              </span>
            </div>
            <div className="quiz-stat">
              <span className="quiz-stat-label">Avg</span>
              <span className="quiz-stat-val" style={{ color: avgPct >= 70 ? 'var(--color-accent)' : '#d97706' }}>
                {avgPct}<span className="quiz-stat-sub">%</span>
              </span>
            </div>
            <div className="quiz-stat">
              <span className="quiz-stat-label">Tries</span>
              <span className="quiz-stat-val">{attemptCount}</span>
            </div>
          </div>
        ) : (
          <div className="quiz-no-attempt">
            <Brain size={14} style={{ color: 'var(--color-fg-subtle)', flexShrink: 0 }} />
            <p className="quiz-no-attempt-text">No attempts yet — take this quiz to track your score.</p>
          </div>
        )}
      </div>

      <div className="quiz-card-footer">
        <button className="quiz-cta" onClick={handleStart}>
          {progress ? "Retake Quiz" : "Start Quiz"}
          <ArrowRight size={13} />
        </button>
      </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────
const Quizzes = ({ onBack }) => {
  const navigate = useNavigate();

  // [fix] questions field removed — it shipped full question objects (with correct_answer)
  // into the bundle. QuizAttempt fetches from the server API which strips correct answers.
  const quizModules = [
    { id: 1, title: "Fish Fundamentals Quiz",       description: "Test your knowledge on fish nutrition and anatomy",         difficulty: "beginner"     },
    { id: 2, title: "Fish Preparation Basics Quiz", description: "Assess your understanding of fish preparation methods",    difficulty: "beginner"     },
    { id: 3, title: "Filleting Techniques Quiz",    description: "Evaluate your filleting knowledge and skills",             difficulty: "intermediate" },
    { id: 4, title: "Bangus Deboning Quiz",          description: "Challenge yourself on milkfish deboning techniques",       difficulty: "advanced"     },
    { id: 5, title: "Quality & Safety Quiz",         description: "Test your knowledge on fish quality and safety practices", difficulty: "intermediate" },
  ];

  const [quizProgress,    setQuizProgress]    = useState({});
  const [moduleProgress,  setModuleProgress]  = useState({});
  const [progressLoading, setProgressLoading] = useState(true);
  const [confirmQuiz,     setConfirmQuiz]     = useState(null); // { quiz, rect }

  const contentRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => { fetchProgress(); }, []);

  useEffect(() => {
    if (contentRef.current && !progressLoading) {
      gsap.fromTo(contentRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
    }
  }, [progressLoading]);

  const fetchProgress = async () => {
    setProgressLoading(true);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
      const [quizRes, moduleRes] = await Promise.all([
        axios.get(`${API_URL}/api/quiz/progress`,          { headers }),
        axios.get(`${API_URL}/api/module/module-progress`, { headers }),
      ]);
      const quizMap = {};
      quizRes.data.forEach(q => { quizMap[q.module_id] = q; });
      setQuizProgress(quizMap);
      const moduleMap = {};
      moduleRes.data.forEach(m => { moduleMap[m.module_id] = m.completed; });
      setModuleProgress(moduleMap);
    } catch (err) {
      console.error("Error fetching quiz progress:", err);
    } finally {
      setProgressLoading(false);
    }
  };

  // If a completed results session is saved, pass freshStart so QuizAttempt clears it
  // and starts a genuine new attempt (mirrors what QuizPreviewModal used to do).
  const getSavedPhase = (id) => {
    try { return JSON.parse(sessionStorage.getItem(`quiz_session_v3_${id}`))?.phase ?? null; }
    catch { return null; }
  };

  const startQuiz = (quiz, rect, restore) => {
    if (!moduleProgress[quiz.id]) {
      restoreRef.current = restore;
      setConfirmQuiz({ quiz, rect });
    } else {
      const savedPhase = getSavedPhase(quiz.id);
      navigate(`/student/quizzes/${quiz.id}`, savedPhase === "results" ? { state: { freshStart: true } } : {});
    }
  };

  const handleConfirmClose = () => {
    restoreRef.current?.();
    restoreRef.current = null;
    setConfirmQuiz(null);
  };

  const handleConfirmStart = () => {
    const { quiz } = confirmQuiz;
    const savedPhase = getSavedPhase(quiz.id);
    handleConfirmClose();
    navigate(`/student/quizzes/${quiz.id}`, savedPhase === "results" ? { state: { freshStart: true } } : {});
  };

  const handleReadModule = () => {
    const { quiz } = confirmQuiz;
    handleConfirmClose();
    navigate(`/student/modules/${quiz.id}`);
  };

  const passedCount = Object.values(quizProgress)
    .filter(q => (q.best_score ?? 0) >= PASS_THRESHOLD).length;

  if (progressLoading) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--color-surface-3)] border-t-[color:var(--color-accent)] animate-spin" />
        <p className="text-[12px] uppercase tracking-[0.16em] ink-faint">Loading quizzes…</p>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div ref={contentRef} className="px-8 lg:px-10 py-8 lg:py-10" style={{ opacity: 0 }}>

        <header className="quiz-ph">
          <div>
            <h1 className="quiz-ph-title">Module <span className="it">Quizzes.</span></h1>
            <p className="quiz-ph-sub">
              {passedCount} of {quizModules.length} passed · 1 min per question · Instant feedback
            </p>
          </div>
          {onBack && (
            <button className="quiz-back-btn" onClick={onBack}>
              <ArrowLeft size={12} /> Back
            </button>
          )}
        </header>

        <div className="quiz-grid">
          {quizModules.map(quiz => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              progress={quizProgress[quiz.id] ?? null}
              moduleCompleted={!!moduleProgress[quiz.id]}
              onStart={startQuiz}
            />
          ))}
        </div>

      </div>

      {confirmQuiz && (
        <QuizConfirmModal
          quiz={confirmQuiz.quiz}
          originRect={confirmQuiz.rect}
          onConfirm={handleConfirmStart}
          onClose={handleConfirmClose}
          onReadModule={handleReadModule}
        />
      )}
    </div>
  );
};

export default Quizzes;
