// file path: web/src/pages/dashboards/student/Overview.jsx

import './Overview.css'; // page-scoped styles — do not import elsewhere
import { useState, useEffect, useContext, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import {
  ArrowRight, BookOpen, Brain,
  Award, Gamepad2, TrendingUp,
} from "lucide-react";
import { AppContext } from "../../../context/AppContext";
import { computeXP } from "../../../utils/xp";
import { MODULES_META } from "../../../data/modulesMeta";
import UserAvatar from "../../../components/UserAvatar";
import gsap from "gsap";

const API_URL       = import.meta.env.VITE_API_URL || "http://localhost:4000";
const TOTAL_MODULES = 5;
const RANK_PREV_KEY = 'cvsuhimay.rank.prev';
// FIX: extracted magic number — both filter and quizItems state derivation use this;
// if pass criteria change, update here only. Full fix requires the server to return
// a `passed` boolean so this constant can be removed entirely.
const QUIZ_PASS_THRESHOLD = 7; // out of 10

// ── Helpers ───────────────────────────────────────────────────────────────

/** Returns "Xm Xs" for a duration in seconds, or "—" for falsy/zero input. */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

/** Returns a human-readable relative date string (e.g. "Today", "3 days ago"). */
function formatRelativeDate(dateStr) {
  if (!dateStr) return "—";
  const now      = new Date();
  const date     = new Date(dateStr);
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Returns the Lucide icon component appropriate for a given achievement category. */
function getAchievementIcon(category) {
  switch (category) {
    case "simulation": return Gamepad2;
    case "quiz":       return Brain;
    case "learning":   return BookOpen;
    default:           return Award;
  }
}

/** Returns the CSS variable string for the rarity color tier. */
function getRarityColor(rarity) {
  const map = {
    legendary: 'var(--color-rarity-legendary)',
    epic:      'var(--color-rarity-epic)',
    rare:      'var(--color-rarity-rare)',
    uncommon:  'var(--color-rarity-uncommon)',
    common:    'var(--color-rarity-common)',
  };
  return map[rarity] ?? map.common;
}

/** Returns ink color for a simulation score — green ≥80, amber 60–79, red <60. */
function scoreColor(score) {
  if (score == null) return 'var(--color-fg)';
  if (score >= 80)   return 'var(--color-accent)';
  if (score >= 60)   return '#d97706';
  return 'var(--color-error)';
}

/**
 * Returns the supplemental CSS class name for the glow ring on legendary/epic
 * achievements. Common/uncommon/rare get no ring — only the tinted backing.
 */
function getMedalGlowClass(rarity) {
  if (rarity === 'legendary') return 'achv-medal-glow-legendary';
  if (rarity === 'epic')      return 'achv-medal-glow-epic';
  return ''; // rare, uncommon, common: tinted circle only, no ring
}


// ── HeroSimCompact ────────────────────────────────────────────────────────

/** Compact hero card for the simulator CTA — shows run stats and a start button. */
function HeroSimCompact({ simStats, lastAttempt, navigate }) {
  const hasAttempts = simStats.totalAttempts > 0;

  const prevAttempt = simStats.recentAttempts[1] || null;
  const trendDelta  = (lastAttempt?.score != null && prevAttempt?.score != null)
    ? lastAttempt.score - prevAttempt.score
    : null;

  return (
    <section className="continue solo">
      <div className="hero-top">
        <div>
          <div className="eyebrow">Practice · Bangus Deboning</div>
          <h2>Begin a new <span className="it">simulation.</span></h2>
        </div>
        <button onClick={() => navigate('/student/simulator')} className="hero-cta-btn">
          Start Deboning <ArrowRight size={14} />
        </button>
      </div>

      <p className="hero-desc">
        An eleven-step run on a freshly-iced bangus specimen. Each attempt is scored on yield,
        pin-bone retention, and time. There is no resume — every run starts at the specimen check.
      </p>

      <div className="hero-course">FPT 311 · Fish Processing Technology</div>

      {hasAttempts ? (
        <div className="run-stats">
          <div className="run-stat">
            <div className="run-stat-label">Last Run</div>
            <div className="run-stat-val font-num" style={{ color: scoreColor(lastAttempt?.score) }}>
              {lastAttempt
                ? <>{lastAttempt.score ?? '—'}<span className="sub">/100</span></>
                : '—'
              }
              {trendDelta !== null && trendDelta !== 0 && (
                <span
                  className="run-stat-delta"
                  style={{ color: trendDelta > 0 ? 'var(--color-accent)' : 'var(--color-error)' }}
                >
                  {trendDelta > 0 ? '▲' : '▼'}{Math.abs(trendDelta)}
                </span>
              )}
            </div>
            <div className="run-stat-meta">
              {/* FIX: removed hardcoded "—" placeholder — it was never backed by a data field */}
              {lastAttempt
                ? `${formatDuration(lastAttempt.duration_seconds)} · ${formatRelativeDate(lastAttempt.created_at)}`
                : 'No runs yet'
              }
            </div>
          </div>
          <div className="run-stat">
            <div className="run-stat-label">Personal Best</div>
            <div className="run-stat-val font-num" style={{ color: scoreColor(simStats.bestScore) }}>
              {simStats.bestScore}<span className="sub">/100</span>
            </div>
            <div className="run-stat-meta">All time</div>
          </div>
          <div className="run-stat">
            <div className="run-stat-label">Runs Completed</div>
            <div className="run-stat-val font-num">{simStats.totalAttempts}</div>
            <div className="run-stat-meta">all bangus specimens</div>
          </div>
        </div>
      ) : (
        <div className="hero-empty-state">
          <p>No simulation runs yet. Start your first run to track your score, time, and personal best.</p>
        </div>
      )}
    </section>
  );
}

// ── NextUpCard ────────────────────────────────────────────────────────────

/** Suggests the next logical action — first incomplete module, then first due quiz. */
function NextUpCard({ moduleItems, quizItems, navigate }) {
  const next = moduleItems.find(m => m.state !== 'done')
            ?? quizItems.find(q => q.state !== 'passed')
            ?? null;
  if (!next) return null;

  const kind = moduleItems.find(m => m.state !== 'done') ? 'Module' : 'Quiz';

  return (
    <div
      className="next-up-card"
      onClick={() => next.path && navigate(next.path)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && next.path && navigate(next.path)}
    >
      <div>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Next Up · {kind}</div>
        <div className="next-up-title">{next.title}</div>
      </div>
      <ArrowRight size={16} className="next-up-arrow" />
    </div>
  );
}

// ── LearningPanel ─────────────────────────────────────────────────────────

/**
 * Renders a single learning-progress panel (Modules or Quizzes).
 * Each item row now carries status-indicator dots in the code column and a
 * background tint for "due" quiz rows — both part of Option A accent injection.
 */
function LearningPanel({ label, completed, total, pct, inProgress, inProgressLabel, ctaLabel, onCta, items, kind, navigate }) {
  return (
    <div className="lp-panel">
      <div className="lp-head">
        <div className="lp-label">{label}</div>
        <div className="lp-counts">
          <span className="lp-num" style={{
            color: pct >= 100 ? 'var(--color-accent)' : pct >= 40 ? '#d97706' : 'var(--color-fg)'
          }}>{completed}</span>
          <span className="lp-of">/ {total}</span>
        </div>
      </div>
      <div className="lp-bar"><i style={{ width: `${pct}%` }} /></div>
      <div className="lp-meta">
        <span><b>{inProgress}</b> {inProgressLabel}</span>
        <span className="lp-meta-sep" />
        <span><b>{pct}%</b> complete</span>
      </div>

      {items && items.length > 0 && (
        <div className="lp-items">
          {items.map((it, i) => (
            <div
              key={i}
              className="lp-item lp-item-clickable"
              onClick={() => it.path && navigate(it.path)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && it.path && navigate(it.path)}
            >
              <div className="lp-item-head">
                <span className="lp-item-code">
                  {kind === 'modules' && it.state === 'done' && (
                    <span className="lp-item-dot lp-item-dot--done" />
                  )}
                  {kind === 'quizzes' && it.state === 'passed' && (
                    <span className="lp-item-dot lp-item-dot--done" />
                  )}
                  {!(kind === 'modules' && it.state === 'done') &&
                   !(kind === 'quizzes' && it.state === 'passed') &&
                    it.code
                  }
                </span>
                <span className="lp-item-title">{it.title}</span>
                {kind === 'quizzes' && it.score != null && (
                  <span className="lp-item-score" style={{ color: scoreColor(it.score) }}>{it.score}%</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={onCta} className="lp-cta">
        {ctaLabel} <ArrowRight size={12} />
      </button>
    </div>
  );
}

// ── GamRail ───────────────────────────────────────────────────────────────

/**
 * Right-rail gamification sidebar: standing (rank + XP), leaderboard mini,
 * and recent achievements. Option A and C changes are both applied here.
 */
function GamRail({ user, leaderboardData, rankDelta, recentAchievements, navigate }) {
  const xpInfo = computeXP(user?.xp_points || 0);
  const xpPct  = Math.min(100, xpInfo.progress * 100);
  // FIX: removed `xpInfo.isMaxLevel` branch — computeXP no longer returns that
  // field (levels are infinite via quadratic formula). The conditional was always
  // evaluating to true (undefined is falsy), making the branch semantically dead.

  const { currentUserEntry, entries = [] } = leaderboardData || {};
  const railEntries = entries.slice(0, 5);

  return (
    <aside className="atelier-rail">

      {/* ── Standing: Rank + XP in one block ──────────────────────────
          Both are player-progression stats; splitting them into separate
          equal-weight blocks gave them false independence.               */}
      <div className="rail-block">
        <div className="label">Global Rank</div>

        {/*
         * OPTION A: Rank number colored var(--color-accent) — it's the
         * highest-signal number in the rail and the strongest cue of
         * progress. The sub "of N" stays muted so the rank itself pops.
         */}
        <div className="display">
          {currentUserEntry ? (
            <>
              <span style={{ color: 'var(--color-accent)' }}>
                #{currentUserEntry.rank}
              </span>
              <span className="sub">of {entries.length}</span>
            </>
          ) : <span>—</span>}
        </div>

        {/* Rank movement note — only renders when there's a delta.
            OPTION A: positive delta (rank improved) → accent green;
            negative delta → error red (unchanged from before).        */}
        {rankDelta !== 0 && (
          <div className="note" style={{ fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
            <span style={{
              color: rankDelta > 0 ? 'var(--color-accent)' : 'var(--color-error)'
            }}>
              {rankDelta > 0 ? '▲ Up' : '▼ Down'}
            </span>{' '}
            {Math.abs(rankDelta)} places this week
          </div>
        )}

        {/* Hairline separating rank from XP within the same block */}
        <div className="rail-inner-sep" />

        {/* XP sub-section */}
        <div className="rail-sub-label">Level {xpInfo.level} · XP</div>
        <div className="display font-num" style={{ fontSize: 22 }}>
          <span style={{ color: 'var(--color-accent)' }}>{xpInfo.xpIntoLevel.toLocaleString()}</span>
          <span className="sub">/ {xpInfo.xpNeeded.toLocaleString()}</span>
        </div>
        {/* xp-bar > i fill is already var(--color-accent) in CSS — no change needed */}
        <div className="xp-bar"><i style={{ width: `${xpPct}%` }} /></div>
        <div className="xp-bar-meta">
          <span>{xpInfo.rank}</span>
          {/* FIX: removed dead `!xpInfo.isMaxLevel` guard — field no longer exists
              on computeXP return value; levels are infinite so always render next-level XP */}
          <span>{(xpInfo.xpNeeded - xpInfo.xpIntoLevel).toLocaleString()} to L{xpInfo.level + 1}</span>
        </div>
      </div>

      {/* ── Leaderboard ───────────────────────────────────────────── */}
      {railEntries.length > 0 && (
        <div className="rail-block">
          <div
            className="label label-link"
            onClick={() => navigate('/student/dashboard/leaderboard')}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && navigate('/student/dashboard/leaderboard')}
          >Leaderboard</div>
          <div className="lb-mini">
            {railEntries.map(entry => (
              <div
                key={entry.user_id}
                className={`lb-row ${entry.is_current_user ? 'me' : ''}`}
              >
                <span className="rank">#{entry.rank}</span>
                <span className="nm">{entry.is_current_user ? 'You' : entry.display_name}</span>
                <span className="xp font-num">{Math.round(entry.score || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Latest Achievements ────────────────────────────────────── */}
      {recentAchievements.length > 0 && (
        <div className="rail-block">
          <div className="label">Latest Achievements</div>
          <div className="achv-list">
            {recentAchievements.map(a => {
              const Icon      = getAchievementIcon(a.category);
              const colorVar  = getRarityColor(a.rarity);
              const glowClass = getMedalGlowClass(a.rarity);

              return (
                <div key={a.name} className="achv">
                  {/*
                   * OPTION C: Medal circle with rarity-tinted backing.
                   *
                   * The background uses color-mix so it can reference the
                   * dynamic CSS variable — 13% opacity of the rarity color
                   * against the card surface. The glow ring for legendary
                   * and epic is applied via a conditional CSS class.
                   *
                   * Icon size reduced to 16px (from 18px) so it doesn't
                   * crowd the 34px circle with the backing visible.
                   */}
                  <div
                    className={`achv-medal ${glowClass}`}
                    style={{
                      background: `color-mix(in srgb, ${colorVar} 13%, transparent)`,
                    }}
                  >
                    <Icon size={16} style={{ color: colorVar }} />
                  </div>
                  <div className="achv-body">
                    <div className="nm" style={{ color: colorVar }}>{a.name}</div>
                    <div className="when">{a.description} · {formatRelativeDate(a.unlocked_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </aside>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════

const Overview = () => {
  const navigate  = useNavigate();
  const { key: locationKey } = useLocation();
  const { user } = useContext(AppContext);

  const [loading,              setLoading]              = useState(true);
  const [primaryError,         setPrimaryError]         = useState(false);
  const [simStats,             setSimStats]             = useState({
    totalAttempts: 0, bestScore: 0, avgScore: 0,
    recentAttempts: [], enrolledCourses: 0,
  });
  const [passedQuizCount,      setPassedQuizCount]      = useState(0);
  const [completedModuleCount, setCompletedModuleCount] = useState(0);
  const [rawQuizData,          setRawQuizData]          = useState([]);
  const [rawModuleData,        setRawModuleData]        = useState([]);
  const [recentAchievements,   setRecentAchievements]   = useState([]);
  const [leaderboardData,      setLeaderboardData]      = useState(null);
  const [rankDelta,            setRankDelta]            = useState(0);
  const contentRef = useRef(null);

  // locationKey changes each time React Router navigates to this route,
  // so stats always reflect the latest run when returning from the simulator.
  useEffect(() => { fetchAllData(); }, [locationKey]);

  /** Fetches all dashboard data in a two-wave parallel strategy to minimize perceived load time. */
  const fetchAllData = async () => {
    setLoading(true);
    setPrimaryError(false);
    const token = localStorage.getItem("token");

    // FIX: localStorage returns null (missing key) or the string "null" (explicitly stored).
    // Both produce "Authorization: Bearer null" which is a malformed header. Redirect
    // to sign-in instead — if the user is here without a token, the session is invalid.
    if (!token || token === "null") {
      navigate('/signin');
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    try {
      const statsRes = await axios.get(`${API_URL}/api/student/dashboard/stats`, { headers });
      const s = statsRes.data.stats;
      setSimStats({
        totalAttempts:   s.total_attempts   ?? 0,
        bestScore:       s.best_score       ?? 0,
        avgScore:        s.average_score    ?? 0,
        recentAttempts:  s.recent_attempts  ?? [],
        enrolledCourses: s.enrolled_courses ?? 0,
      });
    } catch (err) {
      console.error("Failed to fetch dashboard stats:", err);
      setPrimaryError(true);
      setLoading(false);
      return;
    }

    const [secondaryResults, enrichmentResults] = await Promise.all([
      Promise.all([
        axios.get(`${API_URL}/api/quiz/progress`,          { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/module/module-progress`, { headers }).catch(() => ({ data: [] })),
      ]),
      Promise.all([
        axios.get(`${API_URL}/api/achievements`,              { headers }).catch(() => ({ data: { achievements: [] } })),
        axios.get(`${API_URL}/api/leaderboard/xp`,            { headers }).catch(() => ({ data: { entries: [], currentUserEntry: null } })),
      ]),
    ]);

    const [quizRes, moduleRes] = secondaryResults;
    const quizData   = Array.isArray(quizRes.data)   ? quizRes.data   : [];
    const moduleData = Array.isArray(moduleRes.data) ? moduleRes.data : [];
    // FIX: use QUIZ_PASS_THRESHOLD constant instead of magic number 7
    setPassedQuizCount(quizData.filter(q => q.best_score >= QUIZ_PASS_THRESHOLD).length);
    setCompletedModuleCount(moduleData.filter(p => p.completed).length);
    setRawQuizData(quizData);
    setRawModuleData(moduleData);

    const [achRes, lbRes] = enrichmentResults;
    const achievements = achRes.data.achievements || [];
    const unlocked = achievements
      .filter(a => a.unlocked)
      .sort((a, b) => {
        const dateA = a.unlocked_at ? new Date(a.unlocked_at).getTime() : 0;
        const dateB = b.unlocked_at ? new Date(b.unlocked_at).getTime() : 0;
        return dateB - dateA;
      });
    setRecentAchievements(unlocked.slice(0, 5));

    const lbData = lbRes.data;
    setLeaderboardData(lbData);
    const currentRank = lbData?.currentUserEntry?.rank;
    if (currentRank != null) {
      try {
        const prevRankStr = localStorage.getItem(RANK_PREV_KEY);
        if (prevRankStr !== null) {
          const prevRank = parseInt(prevRankStr, 10);
          if (!isNaN(prevRank) && prevRank > 0) setRankDelta(prevRank - currentRank);
        }
        localStorage.setItem(RANK_PREV_KEY, String(currentRank));
      } catch { /* storage blocked */ }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (contentRef.current && !loading) {
      gsap.fromTo(contentRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
    }
  }, [loading]);

  // ── Derived ───────────────────────────────────────────────────────────

  const firstName = user?.first_name || user?.name?.split(' ')[0] || user?.full_name?.split(' ')[0] || 'Student';
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const lastAttempt = simStats.recentAttempts[0] || null;
  const modulePct   = Math.round((completedModuleCount / TOTAL_MODULES) * 100);
  const quizPct     = Math.round((passedQuizCount / TOTAL_MODULES) * 100);

  const completedModuleIds = new Set(rawModuleData.filter(p => p.completed).map(p => p.module_id));
  const quizByModuleId = Object.fromEntries(rawQuizData.map(q => [q.module_id, q]));

  const moduleItems = MODULES_META.map(mod => ({
    title: mod.title,
    pct: completedModuleIds.has(mod.id) ? 100 : 0,
    state: completedModuleIds.has(mod.id) ? 'done' : 'remaining',
    path: `/student/modules/${mod.id}`,
  }));

  const quizItems = MODULES_META.map(mod => {
    const q = quizByModuleId[mod.id];
    return {
      title: mod.title,
      // FIX: q can exist with best_score: null (incomplete attempt record), which
      // produced Math.round(null / 10 * 100) = NaN, rendered visibly as "NaN%".
      // Null-check best_score before computing; scoreColor and LearningPanel
      // already handle score === null gracefully.
      score: q?.best_score != null ? Math.round((q.best_score / 10) * 100) : null,
      // FIX: use QUIZ_PASS_THRESHOLD constant instead of magic number 7
      state: !q ? 'due' : q.best_score >= QUIZ_PASS_THRESHOLD ? 'passed' : 'attempted',
      path: `/student/quizzes/${mod.id}`,
    };
  });

  // ── Loading ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--color-surface-3)] border-t-[color:var(--color-accent)] animate-spin" />
        <p className="text-[12px] uppercase tracking-[0.16em] ink-faint">Loading overview…</p>
      </div>
    );
  }

  if (primaryError) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3 p-8">
        <div
          className="w-12 h-12 flex items-center justify-center mb-1"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-error) 10%, transparent)' }}
        >
          <TrendingUp className="w-6 h-6" style={{ color: 'var(--color-error)' }} />
        </div>
        <p className="text-[14px] font-medium ink">Could not load overview</p>
        <p className="text-[13px] ink-muted text-center max-w-sm">
          There was a problem fetching your data. Check your connection and try again.
        </p>
        <button
          onClick={fetchAllData}
          className="mt-2 px-4 py-2 bg-[color:var(--color-accent)] text-white text-[11px] uppercase tracking-[0.14em] font-medium hover:bg-[color:var(--color-accent-hover)] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full">
      <div ref={contentRef} className="px-8 lg:px-10 py-8 lg:py-10" style={{ opacity: 0 }}>

        {/* Page header */}
        <header className="ph">
          <div className="ph-inner">
            <div>
              <h1 className="ph-title" style={{ fontWeight: 400, fontFamily: 'var(--font-ui)' }}>
                {greeting}, <span className="it">{firstName}.</span>
              </h1>
              {lastAttempt && (
                <p className="ph-subtitle">
                  Last run {lastAttempt.score ?? '—'}/100
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Atelier two-column */}
        <div className="atelier">

          {/* ── Main column ── */}
          <main>
            <HeroSimCompact
              simStats={simStats}
              lastAttempt={lastAttempt}
              navigate={navigate}
            />

            <NextUpCard
              moduleItems={moduleItems}
              quizItems={quizItems}
              navigate={navigate}
            />

            <div style={{ marginTop: 36 }}>
              <div className="section-head">
                <h3>Learning Progress</h3>
                <span className="rule" />
              </div>
              <div className="learning-grid">
                <LearningPanel
                  label="Modules"
                  completed={completedModuleCount}
                  total={TOTAL_MODULES}
                  pct={modulePct}
                  inProgress={TOTAL_MODULES - completedModuleCount}
                  inProgressLabel="remaining"
                  ctaLabel="View modules"
                  onCta={() => navigate('/student/modules')}
                  items={moduleItems}
                  kind="modules"
                  navigate={navigate}
                />
                <LearningPanel
                  label="Quizzes"
                  completed={passedQuizCount}
                  total={TOTAL_MODULES}
                  pct={quizPct}
                  inProgress={TOTAL_MODULES - passedQuizCount}
                  inProgressLabel="remaining"
                  ctaLabel="Take a quiz"
                  onCta={() => navigate('/student/quizzes')}
                  items={quizItems}
                  kind="quizzes"
                  navigate={navigate}
                />
              </div>
            </div>

          </main>

          {/* ── Gamification rail ── */}
          <GamRail
            user={user}
            leaderboardData={leaderboardData}
            rankDelta={rankDelta}
            recentAchievements={recentAchievements}
            navigate={navigate}
          />

        </div>
      </div>
    </div>
  );
};

export default Overview;
