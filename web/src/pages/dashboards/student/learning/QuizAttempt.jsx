// File path: web/src/pages/dashboards/student/learning/QuizAttempt.jsx
//
// Handles the full quiz session (taking + results).
// Route: /student/quizzes/:moduleId
//
// Key behaviors:
//   - Questions are fetched from GET /api/quiz/modules/:moduleId/questions (no correct answers)
//   - Answers are collected and submitted at the end; server computes score
//   - Per-question reveal shows the correct tile immediately after the user answers
//     (server returns `correct` in POST /check after the pick is locked)
//   - Full review (correct answers + explanations) comes from the server response
//   - Session state persists to sessionStorage so refresh keeps the user in place
//
// Changes:
//   [fix #1] Client-side option shuffle removed. The server already shuffles options
//            in quiz_sessions; a second client-side shuffle created a double-indirection
//            that caused (a) the last question to always be submitted with the display
//            letter instead of the server-space letter, scoring it incorrectly ~75% of
//            the time, and (b) review option texts to mismatch correct-answer letters.
//            Display order is now A=option_a, B=option_b, C=option_c, D=option_d
//            exactly as the server returned them — no translation layer needed.
//   [fix #3] Network-failure fallback score changed from
//            "count of answered questions" → 0. The previous fallback counted any
//            non-null answer as correct, giving a student who answered all questions
//            wrong a local score of 10/10.
//   [fix #5] `correctLetter` is now populated from `res.data.correct` returned by
//            POST /check (restored server-side in fix #14). With the client shuffle
//            removed, the server-space letter IS the display letter, so no translation
//            is needed and the correct tile highlights immediately after answering.
//   [fix #22] Error handler for question fetch now displays the server's rate-limit
//            message (or any other server message) instead of a generic string, so
//            students know exactly why the request failed and how to recover.

import './QuizAttempt.css';
import { useState, useEffect, useRef, useCallback, useContext } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, CheckCircle, X, Clock, Award,
  TrendingUp, Flame, Zap, ChevronDown, ChevronUp, RotateCcw,
} from "lucide-react";
import { AppContext } from "../../../../context/AppContext";
import { ThemeContext } from "../../../../context/ThemeContext";
import { ACHIEVEMENT_ICONS } from "../../../../constants/achievements";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// ── Constants ─────────────────────────────────────────────────────────────────
const QUESTIONS_PER_QUIZ   = 10;
const SECONDS_PER_QUESTION = 60;
const XP_PER_CORRECT       = 5;   // display only; server is source of truth
const AUTO_ADVANCE_DELAY   = 600; // ms — color feedback is immediate; short pause lets the user register it

// ── Quiz module metadata (display only — questions come from the server) ──────
const QUIZ_META = {
  1: { id: 1, title: "Fish Fundamentals Quiz",       difficulty: "beginner"     },
  2: { id: 2, title: "Fish Preparation Basics Quiz", difficulty: "beginner"     },
  3: { id: 3, title: "Filleting Techniques Quiz",    difficulty: "intermediate" },
  4: { id: 4, title: "Bangus Deboning Quiz",          difficulty: "advanced"     },
  5: { id: 5, title: "Quality & Safety Quiz",         difficulty: "intermediate" },
};

// ── sessionStorage helpers ────────────────────────────────────────────────────
const STORAGE_KEY   = (id) => `quiz_session_v3_${id}`;
const readSession   = (id) => { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY(id))); } catch { return null; } };
const writeSession  = (id, data) => { try { sessionStorage.setItem(STORAGE_KEY(id), JSON.stringify(data)); } catch {} };
const clearSession  = (id) => { try { sessionStorage.removeItem(STORAGE_KEY(id)); } catch {} };

const formatTimer = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const SPRING = "cubic-bezier(0.34,1.4,0.64,1)";
const EXPO   = "cubic-bezier(0.16,1,0.3,1)";

/** Returns the CSS variable string for a rarity tier's color. */
function getRarityColorVar(rarity) {
  const map = {
    legendary: 'var(--color-rarity-legendary)',
    epic:      'var(--color-rarity-epic)',
    rare:      'var(--color-rarity-rare)',
    uncommon:  'var(--color-rarity-uncommon)',
    common:    'var(--color-rarity-common)',
  };
  return map[rarity] ?? map.common;
}

// ═════════════════════════════════════════════════════════════════════════════
// AchievementToast
// ═════════════════════════════════════════════════════════════════════════════
const AchievementToast = ({ achievement, onDone }) => {
  const Icon     = ACHIEVEMENT_ICONS[achievement.id] ?? Award;
  const colorVar = getRarityColorVar(achievement.rarity);
  useEffect(() => { const t = setTimeout(onDone, 4000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="qa-toast">
      <div
        className="qa-toast-icon"
        style={{ background: `color-mix(in srgb, ${colorVar} 14%, transparent)` }}
      >
        <Icon size={16} style={{ color: colorVar }} />
      </div>
      <div>
        <p className="qa-toast-eyebrow">Achievement Unlocked</p>
        <p className="qa-toast-name" style={{ color: colorVar }}>{achievement.name}</p>
        <p className="qa-toast-desc">{achievement.description}</p>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ResultsView — uses server-returned `review` array for question breakdown
// ═════════════════════════════════════════════════════════════════════════════
const ResultsView = ({
  quiz, score, total, percentage, passed, xpEarned,
  review, maxStreak, totalTime, toastQueue, setToastQueue,
  onBack, onRetake,
}) => {
  const [expandedQ, setExpandedQ] = useState(null);

  const radius     = 45;
  const circ       = 2 * Math.PI * radius;
  const dashOffset = circ - (circ * (percentage / 100));

  // Score color: accent for pass, amber for partial, error for fail
  const scoreColor = passed
    ? 'var(--color-accent)'
    : percentage >= 50
    ? '#d97706'
    : 'var(--color-error)';

  const correctXp = score * XP_PER_CORRECT;

  return (
    <>
      {toastQueue.length > 0 && toastQueue[0] && (
        <AchievementToast
          achievement={toastQueue[0]}
          onDone={() => setToastQueue((q) => q.slice(1))}
        />
      )}

      <div className="qa-results-page">
        <div className="qa-results-inner">

          {/* Back link */}
          <div className="qa-results-eyebrow">
            <button className="qa-back-link" onClick={onBack}>
              <ArrowLeft size={12} /> Back to Quizzes
            </button>
          </div>

          {/* Score hero */}
          <div className="qa-score-hero">
            <div className="qa-ring-wrap">
              <svg width="110" height="110" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r={radius} fill="none"
                  stroke="var(--color-surface-3)" strokeWidth="7" />
                <circle cx="50" cy="50" r={radius} fill="none"
                  stroke={scoreColor} strokeWidth="7" strokeLinecap="square"
                  strokeDasharray={circ} strokeDashoffset={dashOffset}
                  style={{ animation: 'qa-score-ring 1.2s cubic-bezier(0.16,1,0.3,1) both' }} />
              </svg>
              <div className="qa-ring-text">
                <span className="qa-ring-pct" style={{ color: scoreColor }}>
                  {percentage}%
                </span>
                <span className="qa-ring-frac">{score}/{total}</span>
              </div>
            </div>

            <div className="qa-hero-body">
              <h1 className="qa-hero-headline">
                {passed
                  ? percentage === 100 ? "Perfect Score." : "Quiz Passed."
                  : "Keep Trying."}
              </h1>
              <p className="qa-hero-sub">
                {passed
                  ? `You scored ${score} of ${total} and passed with ${percentage}%.`
                  : `You scored ${score} of ${total}. You need 70% to pass. Review below and retake.`}
              </p>
              <span className={`qa-pass-badge ${passed ? 'qa-pass-badge--pass' : 'qa-pass-badge--fail'}`}>
                {passed ? <CheckCircle size={11} /> : <X size={11} />}
                {passed ? "Passed" : "Failed"} — {percentage >= 70 ? "70%+" : "< 70%"}
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="qa-stats-row">
            {[
              { label: "Streak",    value: `${maxStreak}🔥`                                    },
              { label: "Time",      value: `${Math.floor(totalTime / 60)}m ${totalTime % 60}s` },
              { label: "Correct",   value: `${score}/${total}`                                  },
              { label: "XP Earned", value: `+${xpEarned}`, accent: true                        },
            ].map(({ label, value, accent }) => (
              <div key={label} className={`qa-stat-tile${accent ? ' qa-stat-tile--accent' : ''}`}>
                <p className="qa-stat-val">{value}</p>
                <p className="qa-stat-label">{label}</p>
              </div>
            ))}
          </div>

          {/* XP breakdown */}
          {xpEarned > 0 && (
            <div className="qa-xp-block">
              <div className="qa-xp-head">
                <Zap size={13} style={{ color: '#d97706' }} />
                XP Earned
              </div>
              <div className="qa-xp-rows">
                <div className="qa-xp-row">
                  <span className="qa-xp-row-label">Correct answers ({score} × {XP_PER_CORRECT})</span>
                  <span className="qa-xp-row-val">+{correctXp} XP</span>
                </div>
                {passed && xpEarned > correctXp && (
                  <div className="qa-xp-row">
                    <span className="qa-xp-row-label">Pass bonus</span>
                    <span className="qa-xp-row-val qa-xp-row-val--accent">+{xpEarned - correctXp} XP</span>
                  </div>
                )}
                <div className="qa-xp-row" style={{ fontWeight: 600 }}>
                  <span className="qa-xp-row-label" style={{ color: 'var(--color-fg)', fontWeight: 600 }}>Total earned</span>
                  <span className="qa-xp-row-val qa-xp-row-val--accent">+{xpEarned} XP</span>
                </div>
              </div>
            </div>
          )}

          {/* Question review */}
          {review && review.length > 0 && (
            <div className="qa-review-section">
              <p className="qa-review-head">Question Review</p>
              <div className="qa-review-list">
                {review.map((item, idx) => (
                  <div key={item.questionId} className="qa-review-item">
                    <button
                      className="qa-review-btn"
                      onClick={() => setExpandedQ(expandedQ === idx ? null : idx)}
                    >
                      <span className={`qa-review-num ${item.isCorrect ? 'qa-review-num--correct' : 'qa-review-num--wrong'}`}>
                        {idx + 1}
                      </span>
                      <p className="qa-review-q-text">{item.question}</p>
                      <div className="flex items-center flex-shrink-0">
                        {item.isCorrect
                          ? <CheckCircle size={14} className="qa-review-icon-correct" />
                          : <X size={14} className="qa-review-icon-wrong" />}
                        {expandedQ === idx
                          ? <ChevronUp size={14} className="qa-review-chevron" />
                          : <ChevronDown size={14} className="qa-review-chevron" />}
                      </div>
                    </button>

                    {expandedQ === idx && (
                      <div className="qa-review-expand">
                        {item.picked === null && (
                          <div className="qa-review-timeout-note">
                            Time ran out on this question.
                          </div>
                        )}
                        {!item.isCorrect && item.picked !== null && (
                          <div className="qa-review-answer qa-review-answer--wrong">
                            <p className="qa-review-answer-label qa-review-answer-label--wrong">Your answer</p>
                            <p className="qa-review-answer-text">
                              {item.picked}. {item[`option${item.picked}`] ?? item[`option${item.picked?.toLowerCase()}`] ?? ""}
                            </p>
                          </div>
                        )}
                        <div className="qa-review-answer qa-review-answer--correct">
                          <p className="qa-review-answer-label qa-review-answer-label--correct">Correct answer</p>
                          <p className="qa-review-answer-text">
                            {item.correct}. {item[`option${item.correct}`] ?? item[`option${item.correct?.toLowerCase()}`] ?? ""}
                          </p>
                        </div>
                        {item.explanation && (
                          <p className="qa-review-explanation">{item.explanation}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="qa-actions">
            <button onClick={onBack} className="qa-btn">
              <ArrowLeft size={13} /> Back to Quizzes
            </button>
            <button onClick={onRetake} className="qa-btn qa-btn--primary">
              <RotateCcw size={13} /> Retake Quiz
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// QuizAttempt — main component
// ═════════════════════════════════════════════════════════════════════════════
const QuizAttempt = () => {
  const { moduleId }    = useParams();
  const navigate        = useNavigate();
  const location        = useLocation();
  const { refreshUser } = useContext(AppContext);
  const { setReaderMode } = useContext(ThemeContext);

  // Hide the dashboard shell (sidebar/navbar) for the full-viewport quiz experience
  useEffect(() => {
    setReaderMode(true);
    return () => setReaderMode(false);
  }, [setReaderMode]);

  // freshStart=true when arriving from the quiz list with intent to retake.
  // Overrides any saved session so the results screen is not shown again.
  const freshStart = location.state?.freshStart === true;

  const quizMeta = QUIZ_META[Number(moduleId)];

  useEffect(() => {
    if (!quizMeta) navigate("/student/quizzes", { replace: true });
  }, [quizMeta, navigate]);

  // ── Clear stale session on explicit retake + scrub nav state ──────────────
  useEffect(() => {
    if (freshStart) {
      clearSession(moduleId);
      // Remove the flag from history so a page refresh mid-quiz doesn't re-fire
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restore session from sessionStorage ───────────────────────────────────
  // freshStart=true means ignore any saved state — treat as brand new session.
  const saved = freshStart ? null : readSession(moduleId);

  // ── Loading state for question fetch ─────────────────────────────────────
  const [loadingQuestions, setLoadingQuestions] = useState(
    // Skip fetch if restoring a session that already has questions
    !(saved?.phase === "quiz" && saved?.questions?.length > 0)
  );
  const [fetchError, setFetchError] = useState(null);

  // ── Session key — increments on retake so timer re-fires ──────────────────
  const [sessionKey, setSessionKey] = useState(0);

  // ── Questions (client-safe, no correct_answer) ────────────────────────────
  // [fix #1] No client-side shuffle — display order is A=option_a … D=option_d
  // exactly as returned by the server (server already shuffled in quiz_sessions).
  const [questions, setQuestions] = useState(
    saved?.phase === "quiz" && saved?.questions?.length ? saved.questions : []
  );

  const [currentIdx, setCurrentIdx] = useState(
    saved?.phase === "quiz" ? (saved?.currentIdx ?? 0) : 0
  );

  // Per-question UI state — always reset fresh by the timer effect
  const [selected,  setSelected]  = useState(null);
  const [revealed,  setRevealed]  = useState(false);
  const [timedOut,  setTimedOut]  = useState(false);

  // Running tallies persisted across questions in this session
  const [streak,    setStreak]    = useState(saved?.phase === "quiz" ? (saved?.streak    ?? 0) : 0);
  const [maxStreak, setMaxStreak] = useState(saved?.phase === "quiz" ? (saved?.maxStreak ?? 0) : 0);

  // answers: array of picked option letters ('A'|'B'|'C'|'D'|null)
  const [pickedAnswers, setPickedAnswers] = useState(
    saved?.phase === "quiz" ? (saved?.pickedAnswers ?? []) : []
  );

  // Per-question outcome from /check: 'correct' | 'wrong' | 'timeout' | 'unknown'
  const [feedback, setFeedback] = useState(
    saved?.phase === "quiz" ? (saved?.feedback ?? []) : []
  );
  // [fix #5] Server letter for the correct option on the current question;
  // populated from res.data.correct returned by POST /check.
  // Since the client-side shuffle is removed, server-space letter === display letter.
  const [correctLetter, setCorrectLetter] = useState(null);

  // perQuestionTimeMs: elapsed ms per question for analytics
  const perQuestionTimeMsRef = useRef(
    saved?.phase === "quiz" ? (saved?.perQuestionTimeMs ?? []) : []
  );
  const questionStartMsRef = useRef(Date.now()); // resets on each question advance

  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [totalTime, setTotalTime] = useState(() => {
    if (!saved) return 0;
    if (saved.phase === "results") return saved.totalTime ?? 0;
    return saved.startTimestamp
      ? Math.round((Date.now() - saved.startTimestamp) / 1000)
      : (saved.totalTime ?? 0);
  });

  const [sliding,       setSliding]       = useState(null);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [submitError,   setSubmitError]   = useState(null);
  const [phase,         setPhase]         = useState(saved?.phase ?? "quiz");
  const [results,    setResults]    = useState(
    saved?.phase === "results" ? (saved?.results ?? null) : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [toastQueue, setToastQueue] = useState([]);

  // Refs for results-page restore after refresh
  const restoredMaxStreak = useRef(saved?.phase === "results" ? (saved?.maxStreak ?? 0)  : null);
  const restoredTotalTime = useRef(saved?.phase === "results" ? (saved?.totalTime ?? 0)  : null);

  const sessionTokenRef = useRef(saved?.sessionToken ?? null);
  const lastAnswersRef  = useRef(null);

  const timerRef    = useRef(null);
  const totalRef    = useRef(null);
  const answeredRef = useRef(false);
  const startTimeRef = useRef(
    saved?.phase === "quiz" && saved?.startTimestamp ? saved.startTimestamp : Date.now()
  );

  const question = questions[currentIdx];
  const isLastQ  = currentIdx === questions.length - 1;
  const progress = ((currentIdx + (revealed ? 1 : 0)) / (questions.length || QUESTIONS_PER_QUIZ)) * 100;

  // ── Fetch questions from server ───────────────────────────────────────────
  useEffect(() => {
    if (!loadingQuestions || !quizMeta) return; // skip if restoring from session

    const token = localStorage.getItem("token");
    axios
      .get(`${API_URL}/api/quiz/modules/${quizMeta.id}/questions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        // [fix #1] Server questions are used as-is; no client-side shuffle applied.
        setQuestions(res.data.questions);
        sessionTokenRef.current      = res.data.session_token ?? null; // [fix E] echo on submit
        startTimeRef.current         = Date.now();
        perQuestionTimeMsRef.current = [];
        questionStartMsRef.current   = Date.now();
      })
      .catch((err) => {
        // [fix #22] Display server error message (e.g., rate limit) instead of a generic string
        const serverMsg = err.response?.data?.message;
        setFetchError(serverMsg || 'Failed to load questions. Please try again.');
      })
      .finally(() => setLoadingQuestions(false));
  }, [quizMeta, loadingQuestions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist quiz session ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "quiz" || !quizMeta || questions.length === 0) return;
    // [fix #1] shuffleMaps removed from persisted session — no longer used.
    writeSession(moduleId, {
      phase:            "quiz",
      questions,
      currentIdx,
      pickedAnswers,
      feedback,
      perQuestionTimeMs: perQuestionTimeMsRef.current,
      streak,
      maxStreak,
      startTimestamp:   startTimeRef.current,
      sessionToken:     sessionTokenRef.current, // [fix E] persist so refresh mid-quiz still submits correctly
    });
  }, [currentIdx, pickedAnswers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist results ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "results" || !results) return;
    writeSession(moduleId, {
      phase:      "results",
      results,
      maxStreak:  restoredMaxStreak.current ?? maxStreak,
      totalTime:  restoredTotalTime.current ?? totalTime,
    });
  }, [phase, results]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-question timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "quiz" || questions.length === 0) return;

    answeredRef.current    = false;
    questionStartMsRef.current = Date.now();
    setTimeLeft(SECONDS_PER_QUESTION);
    setTimedOut(false);
    setRevealed(false);
    setSelected(null);
    setCorrectLetter(null);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleAnswer(null, true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [currentIdx, sessionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Total elapsed time tracker ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "quiz") return;
    totalRef.current = setInterval(() => setTotalTime((t) => t + 1), 1000);
    return () => clearInterval(totalRef.current);
  }, [sessionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Answer handler ─────────────────────────────────────────────────────────
  // Calls /check to learn whether the pick is correct, then renders truthful
  // green/red feedback before advancing. Streak only advances on actual correct.
  const handleAnswer = useCallback(async (option, isTimeout = false) => {
    if (answeredRef.current) return;
    answeredRef.current = true;

    clearInterval(timerRef.current);

    const elapsedMs = Math.min(Date.now() - questionStartMsRef.current, SECONDS_PER_QUESTION * 1000);
    perQuestionTimeMsRef.current = [...perQuestionTimeMsRef.current, elapsedMs];

    // [fix #1] No client-side shuffle — `option` is already in server space
    // (display A = server option_a = the letter the server expects). No translation.
    setRevealed(true);
    setSelected(option); // store letter for tile highlight
    if (isTimeout) setTimedOut(true);
    setPickedAnswers((prev) => [...prev, option]);

    // Ask the server whether this pick is correct.
    // [fix #5] Server now returns `correct` (the correct letter) so the tile
    // can be highlighted immediately. No reverse-translation needed since
    // display order === server order after removing the client shuffle.
    let outcome = 'wrong';
    let correct = null;
    try {
      const res = await axios.post(
        `${API_URL}/api/quiz/modules/${quizMeta.id}/check`,
        { questionIndex: currentIdx, picked: option },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      outcome = isTimeout ? 'timeout' : (res.data.isCorrect ? 'correct' : 'wrong');
      correct = res.data.correct ?? null; // [fix #5] direct — no translation needed
    } catch {
      // Network / server failure — degrade to neutral reveal, leave streak alone.
      outcome = isTimeout ? 'timeout' : 'unknown';
    }

    setFeedback((prev) => [...prev, outcome]);
    setCorrectLetter(correct); // display letter for tile highlight

    // Streak now reflects truth: only +1 on confirmed correct, otherwise reset.
    const newStreak = outcome === 'correct' ? streak + 1 : 0;
    setStreak(newStreak);
    setMaxStreak((prev) => Math.max(prev, newStreak));

    setTimeout(() => {
      // [fix #1] `option` is already the correct server-space letter; pass directly.
      if (isLastQ) submitQuiz([...pickedAnswers, option]);
      else         advanceQuestion();
    }, AUTO_ADVANCE_DELAY);
  }, [streak, isLastQ, pickedAnswers, currentIdx, quizMeta]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Advance to next question ───────────────────────────────────────────────
  const advanceQuestion = () => {
    setSliding("out-left");
    setTimeout(() => {
      setCurrentIdx((i) => i + 1);
      setSliding("in-right");
      setTimeout(() => setSliding(null), 350);
    }, 250);
  };

  // ── Submit all answers to the backend ─────────────────────────────────────
  const submitQuiz = async (finalAnswers) => {
    lastAnswersRef.current = finalAnswers;
    setSubmitError(null);
    setSubmitting(true);
    clearInterval(totalRef.current);
    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);

    try {
      const res = await axios.post(
        `${API_URL}/api/quiz/modules/${quizMeta.id}/submit`,
        {
          answers:          finalAnswers,
          timeSpent,
          perQuestionTimeMs: perQuestionTimeMsRef.current,
          session_token:    sessionTokenRef.current, // [fix E] echo token from GET /questions
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      // Update streak displays with server-computed values
      restoredMaxStreak.current = res.data.maxStreak;
      restoredTotalTime.current = timeSpent;

      setResults(res.data);
      if (res.data.newlyUnlocked?.length > 0) setToastQueue(res.data.newlyUnlocked);
      if (refreshUser) refreshUser();
      setPhase("results");
    } catch (err) {
      const errCode = err.response?.data?.error;
      const errMsg  = err.response?.data?.message;
      console.error("Quiz submit error:", errCode ?? err.message);
      setSubmitError(errMsg || 'Could not save your results. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Retake: refetch fresh questions from server ────────────────────────────
  const handleRetake = () => {
    clearInterval(timerRef.current);
    clearInterval(totalRef.current);
    clearSession(moduleId);

    // Reset all state
    setPhase("quiz");
    setResults(null);
    setCurrentIdx(0);
    setStreak(0);
    setMaxStreak(0);
    setPickedAnswers([]);
    setFeedback([]);
    setCorrectLetter(null);
    perQuestionTimeMsRef.current = [];
    setTotalTime(0);
    setSliding(null);
    setToastQueue([]);
    answeredRef.current  = false;
    startTimeRef.current = Date.now();
    restoredMaxStreak.current = null;
    restoredTotalTime.current = null;

    // Trigger a fresh question fetch
    setLoadingQuestions(true);
    setSessionKey((k) => k + 1);
  };

  // ── Back to quiz list (from results / error screens) ─────────────────────
  const handleBack = () => {
    clearInterval(timerRef.current);
    clearInterval(totalRef.current);
    clearSession(moduleId);
    navigate("/student/quizzes");
  };

  // ── Cancel mid-attempt — shows themed modal instead of window.confirm ────
  const handleCancelAttempt = () => setShowQuitModal(true);

  const handleQuitConfirmed = () => {
    setShowQuitModal(false);
    clearInterval(timerRef.current);
    clearInterval(totalRef.current);
    clearSession(moduleId);
    navigate("/student/quizzes");
  };

  // ── Retry a failed submit with the same answers ───────────────────────────
  const handleRetrySubmit = () => {
    if (lastAnswersRef.current) submitQuiz(lastAnswersRef.current);
  };

  // ── Warn on accidental tab close / refresh mid-quiz ───────────────────────
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (phase !== "quiz") return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  if (!quizMeta) return null;

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loadingQuestions) {
    return (
      <div className="qa-overlay">
        <div className="qa-spinner" />
        <p className="qa-overlay-label">Loading questions…</p>
      </div>
    );
  }

  // ── Error screen ───────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div className="qa-overlay">
        <div className="qa-error-box">
          <div className="qa-error-icon">
            <X size={20} />
          </div>
          <p className="qa-error-title">Cannot Start Quiz</p>
          <p className="qa-error-sub">{fetchError}</p>
          <button onClick={handleBack} className="qa-btn qa-btn--primary" style={{ flex: 'none', width: '100%' }}>
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  // ── Submitting overlay ─────────────────────────────────────────────────────
  if (submitting) {
    return (
      <div className="qa-overlay">
        <div className="qa-spinner" />
        <p className="qa-overlay-label">Saving your results…</p>
      </div>
    );
  }

  // ── Submit error screen ───────────────────────────────────────────────────
  if (submitError) {
    return (
      <div className="qa-overlay">
        <div className="qa-error-box">
          <div className="qa-error-icon"><X size={20} /></div>
          <p className="qa-error-title">Couldn't Save Results</p>
          <p className="qa-error-sub">{submitError}</p>
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button onClick={handleBack} className="qa-btn" style={{ flex: 1 }}>
              <ArrowLeft size={13} /> Back
            </button>
            <button onClick={handleRetrySubmit} className="qa-btn qa-btn--primary" style={{ flex: 1 }}>
              <RotateCcw size={13} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Results screen ─────────────────────────────────────────────────────────
  if (phase === "results" && results) {
    return (
      <ResultsView
        quiz={quizMeta}
        score={results.score ?? 0}
        total={results.totalQuestions ?? QUESTIONS_PER_QUIZ}
        percentage={results.percentage ?? 0}
        passed={results.passed}
        xpEarned={results.xpEarned ?? 0}
        review={results.review ?? []}
        maxStreak={restoredMaxStreak.current ?? maxStreak}
        totalTime={restoredTotalTime.current ?? totalTime}
        toastQueue={toastQueue}
        setToastQueue={setToastQueue}
        onBack={handleBack}
        onRetake={handleRetake}
      />
    );
  }

  // ── Quiz HUD + question card ───────────────────────────────────────────────
  if (!question) return null;

  const timerDanger  = timeLeft <= 15;
  const timerWarning = timeLeft <= 30 && !timerDanger;

  const timerClass = timerDanger ? 'qa-timer qa-timer--danger'
    : timerWarning ? 'qa-timer qa-timer--warning'
    : 'qa-timer';

  return (
    <div
      className="flex flex-col"
      style={{ height: '100dvh', overflow: 'hidden', background: 'var(--color-paper)' }}
    >
      {/* Achievement toast */}
      {toastQueue.length > 0 && toastQueue[0] && (
        <AchievementToast
          achievement={toastQueue[0]}
          onDone={() => setToastQueue((q) => q.slice(1))}
        />
      )}

      {/* Quit confirmation modal */}
      {showQuitModal && (
        <div className="qa-modal-backdrop" onClick={() => setShowQuitModal(false)}>
          <div className="qa-modal" onClick={e => e.stopPropagation()}>
            <p className="qa-modal-title">Leave this quiz?</p>
            <p className="qa-modal-body">
              {pickedAnswers.some(a => a != null)
                ? 'Your progress on this attempt will be discarded.'
                : 'This attempt will be discarded.'}
            </p>
            <div className="qa-modal-actions">
              <button className="qa-btn" onClick={() => setShowQuitModal(false)}>Keep Going</button>
              <button className="qa-btn qa-btn--danger" onClick={handleQuitConfirmed}>Leave Quiz</button>
            </div>
          </div>
        </div>
      )}

      {/* Top HUD */}
      <div className="qa-hud">
        <div className="qa-hud-inner">
          {/* Row 1: quit | title | stats */}
          <div className="qa-hud-row">
            <button className="qa-quit-btn" onClick={handleCancelAttempt}>
              <X size={13} /> Quit
            </button>
            <span className="qa-hud-title">{quizMeta.title}</span>
            <div className="qa-hud-stats">
              <div className={`qa-streak${streak >= 3 ? ' qa-streak--active' : ''}`}>
                <Flame size={14} />
                <span>{streak}</span>
              </div>
              <div className="qa-answered">
                <TrendingUp size={14} />
                <span>{pickedAnswers.length}</span>
              </div>
            </div>
          </div>
          {/* Row 2: progress bar */}
          <div className="qa-progress-row">
            <div className="qa-progress-track">
              <div className="qa-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="qa-progress-count">{currentIdx + 1}/{questions.length}</span>
          </div>
        </div>
      </div>

      {/* Question body — flex-1 so it fills remaining height */}
      <div className="qa-body">
        <div
          className="qa-q-wrap"
          style={{
            animation: sliding === "out-left" ? `qa-slide-out-left 250ms ${EXPO} forwards`
                     : sliding === "in-right" ? `qa-slide-in-right 350ms ${SPRING} forwards`
                     : undefined,
          }}
        >
          {/* Header: label + timer */}
          <div className="qa-q-header">
            <span className="qa-q-label">Question {String(currentIdx + 1).padStart(2, '0')}</span>
            <span className={timerClass}>
              <Clock size={12} style={timerDanger ? { animation: 'qa-spin 1s linear infinite' } : undefined} />
              {formatTimer(timeLeft)}
            </span>
          </div>

          {/* Card */}
          <div
            className={`qa-card${timedOut && revealed ? ' qa-card--timeout' : ''}`}
            style={timedOut && revealed ? { animation: 'qa-pulse-timeout 0.6s ease-out' } : undefined}
          >
            <p className="qa-question">{question.question}</p>

            <div className="qa-options">
              {["A", "B", "C", "D"].map((opt) => {
                // [fix #1] Display order === server order; option A = question.option_a.
                // No shuffle map lookup needed.
                const text    = question[`option_${opt.toLowerCase()}`];
                const isChosen     = opt === selected;
                const isTheCorrect = opt === correctLetter;
                const outcome      = feedback[currentIdx]; // 'correct'|'wrong'|'timeout'|'unknown'|undefined

                // Compute the visual variant for this tile
                let variant;
                if (!revealed) {
                  variant = 'idle';
                } else if (isChosen && outcome === 'correct') {
                  variant = 'correct';
                } else if (isChosen && outcome === 'wrong') {
                  variant = 'wrong';
                } else if (isChosen && outcome === 'unknown') {
                  variant = 'unknown';
                } else if (isTheCorrect && (outcome === 'wrong' || outcome === 'timeout')) {
                  // Surface correct answer in green when user was wrong or timed out
                  variant = 'correct';
                } else {
                  variant = 'dim';
                }

                // One-shot animations attached as inline styles (not CSS class) so
                // they play exactly once when the tile transitions to its outcome state.
                let animStyle = {};
                if (revealed && isChosen && outcome === 'correct') {
                  animStyle = { animation: 'qa-pulse-correct 0.5s ease-out' };
                } else if (revealed && isChosen && outcome === 'wrong') {
                  animStyle = { animation: 'qa-shake 0.4s ease-out' };
                }

                return (
                  <button
                    key={opt}
                    onClick={() => !revealed && handleAnswer(opt)}
                    disabled={revealed}
                    style={animStyle}
                    className={`qa-option qa-option--${variant}`}
                  >
                    <span className="qa-letter">{opt}</span>
                    <span className="qa-option-text">{text}</span>
                  </button>
                );
              })}
            </div>

            {/* Timeout banner */}
            {revealed && timedOut && (
              <div
                className="qa-timeout-banner"
                style={{ animation: `qa-slide-in-right 350ms ${SPRING}` }}
              >
                <Clock size={13} />
                Time&rsquo;s up — moving on.
              </div>
            )}

            {/* Unknown outcome — thin progress bar instead of misleading color */}
            {revealed && !timedOut && feedback[currentIdx] === 'unknown' && (
              <div className="qa-unknown-bar"
                style={{ animation: `qa-expand-width ${AUTO_ADVANCE_DELAY}ms linear forwards` }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizAttempt;
