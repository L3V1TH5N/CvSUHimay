// file path: web/src/pages/dashboards/student/CourseDetails.jsx

import './CourseDetails.css';
import { useState, useEffect, useContext, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";
import { AppContext } from "../../../context/AppContext";
import { computeXP } from "../../../utils/xp";
import { ArrowLeft, ArrowRight } from "lucide-react";
import gsap from "gsap";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function scoreColor(score) {
  if (score == null) return 'var(--color-fg)';
  if (score >= 80)   return 'var(--color-accent)';
  if (score >= 60)   return '#d97706';
  return 'var(--color-error, #dc2626)';
}

const CourseDetails = () => {
  const { courseId } = useParams();
  const navigate     = useNavigate();
  const [sp]         = useSearchParams();
  const { token, user } = useContext(AppContext);
  const contentRef   = useRef(null);

  const [courseData,         setCourseData]         = useState(null);
  const [classmates,         setClassmates]         = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [showWelcomeBanner,  setShowWelcomeBanner]  = useState(sp.get("focus") === "welcome");
  const [showAllProgress,    setShowAllProgress]    = useState(false);

  useEffect(() => {
    if (showWelcomeBanner) {
      const t = setTimeout(() => setShowWelcomeBanner(false), 6000);
      return () => clearTimeout(t);
    }
  }, [showWelcomeBanner]);

  useEffect(() => { fetchCourseDetails(); }, [courseId]);

  useEffect(() => {
    if (contentRef.current && !loading) {
      gsap.fromTo(contentRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
    }
  }, [loading]);

  const fetchCourseDetails = async () => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    const [courseRes, classmatesRes] = await Promise.allSettled([
      axios.get(`${API_URL}/api/courses/${courseId}`, { headers }),
      axios.get(`${API_URL}/api/courses/${courseId}/classmates`, { headers }),
    ]);
    if (courseRes.status === 'rejected') {
      toast.error("Failed to load course details");
      setLoading(false);
      navigate("/student/courses");
      return;
    }
    setCourseData(courseRes.value.data.course);
    setClassmates(
      classmatesRes.status === 'fulfilled' ? (classmatesRes.value.data.students || []) : []
    );
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--color-surface-3)] border-t-[color:var(--color-accent)] animate-spin" />
        <p className="text-[12px] uppercase tracking-[0.16em] ink-faint">Loading course…</p>
      </div>
    );
  }

  if (!courseData) return null;

  // ── Derived values ─────────────────────────────────────────────────────
  const myRank        = courseData.my_stats?.my_rank ?? null;
  const enrolledCount = courseData.student_count || 0;
  const bestPct       = courseData.my_stats?.best_score || 0;
  const totalAttempts = courseData.my_stats?.total_attempts || 0;
  const avgScore      = courseData.my_stats?.avg_score ?? null;
  const rawXP         = courseData.total_xp || user?.xp_points || 0;
  const xpInfo        = computeXP(rawXP);
  const xpPct         = xpInfo.isMaxLevel ? 100 : Math.min(100, xpInfo.progress * 100);

  const leaderboard       = courseData.leaderboard || [];
  const PROGRESS_LIMIT    = 7;
  const visibleClassmates = showAllProgress ? classmates : classmates.slice(0, PROGRESS_LIMIT);

  return (
    <div className="min-h-full">
      <div ref={contentRef} className="px-8 lg:px-10 py-8 lg:py-10" style={{ opacity: 0 }}>

        {/* Welcome banner */}
        {showWelcomeBanner && (
          <div className="cd-welcome">
            <div className="cd-welcome-body">
              <strong className="cd-welcome-strong">You're in.</strong>
              <p className="cd-welcome-text">
                You've been accepted into this class. Your progress will be tracked here — start practicing when you're ready.
              </p>
            </div>
            <button className="cd-welcome-dismiss" onClick={() => setShowWelcomeBanner(false)}>×</button>
          </div>
        )}

        {/* Page header */}
        <button className="course-back-btn" onClick={() => navigate("/student/courses")}>
          <ArrowLeft size={11} /> Courses
        </button>
        <header className="cd-ph">
          <h1 className="cd-ph-title"><span className="it">{courseData.name}.</span></h1>
          <p className="cd-ph-sub">
            {courseData.instructor_name} · {enrolledCount} student{enrolledCount !== 1 ? 's' : ''} enrolled
          </p>
        </header>

        {/* Atelier two-column layout */}
        <div className="cd-atelier">

          {/* ── Main column ── */}
          <main>

            {/* Practice CTA hero */}
            <div className="cd-hero">
              <div className="cd-hero-top">
                <div>
                  <div className="cd-hero-eyebrow">Simulator · Bangus Deboning</div>
                  <h2>Begin a new <span className="it">simulation.</span></h2>
                </div>
                <button className="cd-hero-cta" onClick={() => navigate('/student/simulator')}>
                  Start Simulator <ArrowRight size={14} />
                </button>
              </div>

              {totalAttempts > 0 ? (
                <div className="cd-run-stats">
                  <div className="cd-run-stat">
                    <div className="cd-run-stat-label">Best Score</div>
                    <div className="cd-run-stat-val" style={{ color: scoreColor(Math.round(bestPct)) }}>
                      {Math.round(bestPct)}<span className="cd-run-stat-sub">%</span>
                    </div>
                  </div>
                  <div className="cd-run-stat">
                    <div className="cd-run-stat-label">Runs Completed</div>
                    <div className="cd-run-stat-val">{totalAttempts}</div>
                  </div>
                  {avgScore != null && (
                    <div className="cd-run-stat">
                      <div className="cd-run-stat-label">Avg Score</div>
                      <div className="cd-run-stat-val" style={{ color: scoreColor(Math.round(avgScore)) }}>
                        {Math.round(avgScore)}<span className="cd-run-stat-sub">%</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="cd-hero-empty">
                  <p>No simulation runs yet. Start your first run to track your score and personal best.</p>
                </div>
              )}
            </div>

            {/* Class Progress */}
            <div style={{ marginTop: 32 }}>
              <div className="cd-section-head">
                <h3>Class Progress</h3>
                <span className="cd-rule" />
              </div>
              {classmates.length === 0 ? (
                <div className="cd-empty">No class progress data yet.</div>
              ) : (
                <div className="cd-progress-table">
                  {visibleClassmates.map((cm, idx) => {
                    const modTotal     = cm.modules_total ?? 5;
                    const modCompleted = cm.modules_completed ?? 0;
                    const allDone      = modTotal > 0 && modCompleted >= modTotal;
                    const inProg       = modCompleted > 0 && !allDone;
                    const statusKey    = allDone ? 'done' : inProg ? 'progress' : 'none';
                    const modPct       = modTotal > 0 ? Math.round((modCompleted / modTotal) * 100) : 0;
                    const isMe         = cm.is_me || (user?.id && cm.id === user.id) || false;
                    return (
                      <div key={cm.id || idx} className={`cd-progress-row${isMe ? ' me' : ''}`}>
                        <span className="cd-progress-name">
                          {isMe ? 'You' : (cm.full_name || cm.username || 'Student')}
                        </span>
                        <div className="cd-progress-modules">
                          <span className="cd-progress-modules-text">{modCompleted}/{modTotal}</span>
                          <div className="cd-progress-mini-bar"><i style={{ width: `${modPct}%` }} /></div>
                        </div>
                        <span
                          className="cd-progress-score"
                          style={{ color: cm.best_score != null ? scoreColor(Math.round(cm.best_score)) : 'var(--color-fg-subtle)' }}
                        >
                          {cm.best_score != null ? `${Math.round(cm.best_score)}%` : '—'}
                        </span>
                        <span className={`cd-status-dot cd-status-dot--${statusKey}`} />
                      </div>
                    );
                  })}
                </div>
              )}
              {classmates.length > PROGRESS_LIMIT && (
                <button className="cd-show-more" onClick={() => setShowAllProgress(v => !v)}>
                  {showAllProgress ? 'Show less' : `Show all ${classmates.length} students`}
                </button>
              )}
            </div>

            {/* Leaderboard */}
            {leaderboard.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <div className="cd-section-head">
                  <h3>Class Ranking</h3>
                  <span className="cd-rule" />
                </div>
                <div className="cd-lb-table">
                  {leaderboard.slice(0, 10).map((entry, idx) => (
                    <div key={entry.id || idx} className={`cd-lb-row${entry.is_me ? ' me' : ''}`}>
                      <span className="cd-lb-rank">#{idx + 1}</span>
                      <span className="cd-lb-name">
                        {entry.is_me ? 'You' : (entry.full_name || 'Student')}
                      </span>
                      <span
                        className="cd-lb-score"
                        style={{ color: scoreColor(Math.round(entry.best_score)) }}
                      >
                        {Math.round(entry.best_score)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </main>

          {/* ── Rail: personal stats ── */}
          <aside className="cd-rail">

            <div className="cd-rail-block">
              <div className="cd-rail-label">Your Standing</div>
              <div className="cd-display">
                {myRank != null ? (
                  <>
                    <span style={{ color: 'var(--color-accent)' }}>#{myRank}</span>
                    <span className="cd-display-sub">of {enrolledCount}</span>
                  </>
                ) : <span>—</span>}
              </div>

              <div className="cd-rail-sep" />

              <div className="cd-stat-row">
                <span className="cd-stat-label">Best Score</span>
                <span className="cd-stat-val" style={{ color: scoreColor(Math.round(bestPct)) }}>
                  {Math.round(bestPct)}%
                </span>
              </div>
              <div className="cd-stat-row">
                <span className="cd-stat-label">Attempts</span>
                <span className="cd-stat-val">{totalAttempts}</span>
              </div>
              {avgScore != null && (
                <div className="cd-stat-row">
                  <span className="cd-stat-label">Avg Score</span>
                  <span className="cd-stat-val" style={{ color: scoreColor(Math.round(avgScore)) }}>
                    {Math.round(avgScore)}%
                  </span>
                </div>
              )}
            </div>

            <div className="cd-rail-block">
              <div className="cd-rail-sub-label">Level {xpInfo.level} · XP</div>
              <div className="cd-display" style={{ fontSize: 22 }}>
                <span style={{ color: 'var(--color-accent)' }}>{xpInfo.xpIntoLevel.toLocaleString()}</span>
                <span className="cd-display-sub">/ {xpInfo.xpNeeded.toLocaleString()}</span>
              </div>
              <div className="cd-xp-bar"><i style={{ width: `${xpPct}%` }} /></div>
              <div className="cd-xp-meta">
                <span>{xpInfo.rank}</span>
                {!xpInfo.isMaxLevel && (
                  <span>{(xpInfo.xpNeeded - xpInfo.xpIntoLevel).toLocaleString()} to L{xpInfo.level + 1}</span>
                )}
              </div>
            </div>

          </aside>

        </div>
      </div>
    </div>
  );
};

export default CourseDetails;
