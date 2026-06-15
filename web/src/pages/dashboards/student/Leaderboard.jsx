// file path: web/src/pages/dashboards/student/Leaderboard.jsx
//
// [fix 4]  user_id retained in leaderboard entries for reliable modal lookup.
//          username is optional in the DB — most students have username: null.
//          Using username as the modal key breaks the feature for those students.
//          user_id is always non-null and the reliable lookup key.
// [fix 10] 60-second client-side TTL on cached tab data.
//          Tab data older than 60 s is re-fetched on next tab switch.
//          Refresh button forces immediate re-fetch of the active tab.

import './Leaderboard.css';
import { useState, useEffect, useContext } from "react";
import axios from "axios";
// [fix 10] RefreshCw added for the refresh button icon.
import { Trophy, Medal, Search, RefreshCw } from "lucide-react";
import { AppContext } from "../../../context/AppContext";
import { computeXP, rankFor } from "../../../utils/xp";
import { PublicProfileModal } from "./profile/ProfileModals";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// ── Tab configuration ─────────────────────────────────────────────────
// Simulation tab removed until real sim scoring ships (§6.4).
const TABS = [
  {
    key:         "xp",
    label:       "XP Rankings",
    endpoint:    "/api/leaderboard/xp",
    scoreSuffix: " XP",
    description: "Total experience points earned — all students",
  },
  {
    key:         "quiz",
    label:       "Quiz Avg",
    endpoint:    "/api/leaderboard/quiz",
    scoreSuffix: "%",
    description: "Average quiz score — students with 3+ attempts",
  },
  {
    key:         "achievements",
    label:       "Achievements",
    endpoint:    "/api/leaderboard/achievements",
    scoreSuffix: " unlocked",
    description: "Total achievements earned — all students",
  },
];

// Rarity dot colors — inline hex, no Tailwind dark: pairs.
const RARITY_COLORS = {
  common:    '#a1a1aa',
  uncommon:  '#4ade80',
  rare:      '#60a5fa',
  epic:      '#c084fc',
  legendary: '#fbbf24',
};

// Minimal inline rarity lookup so we don't need to import the full
// achievements constant just for badge dot colors.
const BADGE_RARITY = {
  1: "common", 2: "uncommon", 3: "uncommon", 4: "common",
  5: "rare",   6: "common",   7: "common",   8: "common",
  9: "common", 10: "epic",    11: "rare",    12: "uncommon",
  13: "uncommon", 14: "rare", 15: "epic",    16: "uncommon",
  17: "rare",  18: "epic",    19: "legendary", 20: "uncommon",
  21: "uncommon", 22: "common", 23: "common", 24: "rare",
  25: "uncommon", 26: "epic",  27: "rare",
};

// Top-3 row background and score colors — CSS-var-safe, no Tailwind dark: pairs.
const MEDAL_COLORS = {
  1: { rowBg: 'rgba(251, 191, 36, 0.07)', scoreColor: '#d97706' },
  2: { rowBg: 'var(--color-surface-2)',   scoreColor: 'var(--color-fg-muted)' },
  3: { rowBg: 'rgba(234, 88, 12, 0.07)', scoreColor: '#ea580c' },
};

// ── Rank chip ─────────────────────────────────────────────────────────
const RankChip = ({ xpPoints }) => {
  const name = rankFor(xpPoints);
  return <span className="lb-rank-chip">{name}</span>;
};

// ── Equipped badges ───────────────────────────────────────────────────
const EquippedBadges = ({ badgeIds }) => {
  if (!badgeIds?.length) return null;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4, flexShrink: 0 }}>
      {badgeIds.slice(0, 3).map(id => {
        const rarity = BADGE_RARITY[id] || "common";
        return (
          <span
            key={id}
            title={`Achievement #${id}`}
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: RARITY_COLORS[rarity],
              flexShrink: 0, display: 'inline-block',
            }}
          />
        );
      })}
    </span>
  );
};

// ── Avatar ────────────────────────────────────────────────────────────
const Avatar = ({ entry, size = "md" }) => {
  const initial = entry.display_name?.[0]?.toUpperCase() || "?";
  const dim     = size === "lg" ? 48 : 36;
  const fs      = size === "lg" ? 16 : 14;

  if (entry.avatar_url) {
    return (
      <img
        src={entry.avatar_url}
        alt={entry.display_name}
        style={{
          width: dim, height: dim, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
          border: '2px solid var(--color-hairline)',
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: dim, height: dim, borderRadius: '50%',
        background: 'var(--color-accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        border: '2px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
      }}
    >
      <span style={{ color: '#fff', fontWeight: 700, fontSize: fs, userSelect: 'none' }}>
        {initial}
      </span>
    </div>
  );
};

// ── Rank badge ────────────────────────────────────────────────────────
const RankBadge = ({ rank }) => {
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
  if (medals[rank]) {
    return <span className="lb-rank-medal">{medals[rank]}</span>;
  }
  return <span className="lb-rank-num">{rank}</span>;
};

// ── Personal stats bar ────────────────────────────────────────────────
const PersonalStatsHeader = ({ currentEntry, user, activeTab }) => {
  const xp      = user?.xp_points ?? 0;
  const xpData  = computeXP(xp);
  const rankNum = currentEntry?.rank;

  return (
    <div className="lb-you-bar">
      <div className="lb-you-left">
        <Medal style={{ width: 16, height: 16, color: 'var(--color-accent)', flexShrink: 0 }} />
        <span className="lb-you-rank">
          {rankNum
            ? `Rank #${rankNum}`
            : activeTab === "quiz"
              ? "Not ranked yet"
              : "—"
          }
        </span>
        {activeTab === "quiz" && !rankNum && (
          <span className="lb-you-note">(need 3+ attempts)</span>
        )}
      </div>
      <div className="lb-you-right">
        <span className="lb-you-xp-rank">{xpData.rank}</span>
        <span className="lb-you-xp">{xp.toLocaleString()} XP</span>
        {!xpData.isMaxLevel && (
          <span className="lb-you-to-next">
            · {xpData.xpNeeded - xpData.xpIntoLevel} to {
              ["Novice","Apprentice","Practitioner","Skilled","Expert","Master"][xpData.level]
            }
          </span>
        )}
      </div>
    </div>
  );
};

// ── Single leaderboard row ────────────────────────────────────────────
const LeaderboardRow = ({ entry, tab, isTop3, onClick }) => {
  const medal = MEDAL_COLORS[entry.rank];

  if (isTop3) {
    return (
      <div
        onClick={onClick}
        className={`lb-row-top${entry.is_current_user ? ' lb-row-top--you' : ''}`}
        style={!entry.is_current_user && medal ? { background: medal.rowBg } : {}}
      >
        <RankBadge rank={entry.rank} />
        <Avatar entry={entry} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <p className={`lb-name lb-name--top${entry.is_current_user ? ' lb-name--you' : ''}`}>
              {entry.display_name}
            </p>
            {entry.is_current_user && <span className="lb-you-chip">You</span>}
            <EquippedBadges badgeIds={entry.equipped_badges} />
          </div>
          <div style={{ marginTop: 4 }}>
            <RankChip xpPoints={entry.xp_points} />
          </div>
          {tab.key === "quiz" && entry.attempt_count != null && (
            <p className="lb-attempt-count">
              {entry.attempt_count} attempt{entry.attempt_count !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <span
            className="lb-score"
            style={{ color: entry.is_current_user ? 'var(--color-accent)' : (medal?.scoreColor ?? 'var(--color-fg)') }}
          >
            {entry.score.toLocaleString()}{tab.scoreSuffix}
          </span>
        </div>
      </div>
    );
  }

  // Rows 4+: compact divider-separated style
  return (
    <div
      onClick={onClick}
      className={`lb-row${entry.is_current_user ? ' lb-row--you' : ''}`}
    >
      <RankBadge rank={entry.rank} />
      <Avatar entry={entry} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <p className={`lb-name${entry.is_current_user ? ' lb-name--you' : ''}`}>
            {entry.display_name}
          </p>
          {entry.is_current_user && <span className="lb-you-chip">You</span>}
          <EquippedBadges badgeIds={entry.equipped_badges} />
        </div>
        <div style={{ marginTop: 2 }}>
          <RankChip xpPoints={entry.xp_points} />
        </div>
      </div>
      <span
        className="lb-score-sm"
        style={{ color: entry.is_current_user ? 'var(--color-accent)' : 'var(--color-fg)' }}
      >
        {entry.score.toLocaleString()}{tab.scoreSuffix}
      </span>
    </div>
  );
};

// ── Skeleton loader ───────────────────────────────────────────────────
const SkeletonRow = ({ wide }) => (
  <div className="lb-skeleton-row">
    <div className="lb-skeleton-box" style={{ width: 28, height: 14 }} />
    <div
      className="lb-skeleton-box"
      style={{ width: wide ? 48 : 36, height: wide ? 48 : 36, borderRadius: '50%', flexShrink: 0 }}
    />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="lb-skeleton-box" style={{ height: 12, width: 128 }} />
      <div className="lb-skeleton-box" style={{ height: 10, width: 64 }} />
    </div>
    <div className="lb-skeleton-box" style={{ height: 14, width: 64 }} />
  </div>
);

// ── Client-side cache TTL ─────────────────────────────────────────────
// [fix 10] Tab data is considered stale after 60 s — matches the backend cache TTL.
const CLIENT_CACHE_TTL = 60_000;

// ══════════════════════════════════════════════════════════════════════
const Leaderboard = () => {
  const { user } = useContext(AppContext);

  const [activeTab,       setActiveTab]       = useState("xp");
  // [fix 10] Each tab entry now stores { entries, currentUserEntry, fetchedAt }.
  const [data,            setData]            = useState({});
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);
  const [searchQuery,     setSearchQuery]     = useState("");
  // user_id is the modal lookup key — always non-null, unlike username.
  const [previewUserId, setPreviewUserId] = useState(null);

  const currentTab = TABS.find(t => t.key === activeTab);

  // [fix 10] Re-fetch when the tab changes unless cached data is < 60 s old.
  useEffect(() => {
    const cached = data[activeTab];
    if (cached && Date.now() - cached.fetchedAt < CLIENT_CACHE_TTL) return;
    fetchTab(activeTab);
  }, [activeTab]);

  useEffect(() => { setSearchQuery(""); }, [activeTab]);

  const fetchTab = async (tabKey) => {
    const tab = TABS.find(t => t.key === tabKey);
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res   = await axios.get(`${API_URL}${tab.endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // [fix 10] Store fetchedAt so the TTL check above can expire stale data.
      setData(prev => ({ ...prev, [tabKey]: { ...res.data, fetchedAt: Date.now() } }));
    } catch (err) {
      console.error(`Leaderboard fetch error [${tabKey}]:`, err);
      setError("Failed to load leaderboard. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // [fix 10] Force re-fetch of the active tab, bypassing the TTL cache.
  const handleRefresh = () => {
    fetchTab(activeTab);
  };

  const tabData       = data[activeTab];
  const entries       = tabData?.entries || [];
  const currentEntry  = tabData?.currentUserEntry;
  const currentInList = entries.some(e => e.is_current_user);
  const showPinnedUser = !loading && !error && currentEntry && !currentInList;

  const visibleEntries = searchQuery.trim()
    ? entries.filter(e =>
        e.display_name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : entries;

  return (
    <div className="px-8 lg:px-10 py-8 lg:py-10 min-h-full">

      {/* ── Page header ── */}
      <header className="lb-ph">
        <div>
          <h1 className="lb-ph-title">Leader<span className="it">board.</span></h1>
          <p className="lb-ph-sub">{currentTab.description}</p>
        </div>
      </header>

      {/* ── Personal stats bar (§6.2) ── */}
      <PersonalStatsHeader
        currentEntry={currentEntry}
        user={user}
        activeTab={activeTab}
      />

      {/* ── Tab filter rail — same pill pattern as Modules page ── */}
      <div className="lb-filter-rail">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`lb-filter-pill${activeTab === tab.key ? ' active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Search + Refresh ── */}
      <div className="lb-search-wrap">
        <Search className="lb-search-icon" size={16} />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or username…"
          className="lb-search"
        />
        <button
          onClick={handleRefresh}
          disabled={loading}
          title="Refresh leaderboard"
          className="lb-refresh-btn"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── Main leaderboard board ── */}
      <div className="lb-board">

        {/* Error state */}
        {error && (
          <div className="lb-state">
            <p className="lb-state-sub">{error}</p>
            <button onClick={() => fetchTab(activeTab)} className="lb-retry-btn">
              Retry
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && !error && (
          <div className="lb-skeleton">
            {[...Array(3)].map((_, i) => <SkeletonRow key={i} wide />)}
            <div className="lb-divider" style={{ margin: '8px 0' }} />
            {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && entries.length === 0 && (
          <div className="lb-state">
            <div className="lb-state-icon">
              <Trophy size={20} style={{ color: 'var(--color-fg-subtle)' }} />
            </div>
            <p className="lb-state-title">No entries yet</p>
            <p className="lb-state-sub">
              {activeTab === "quiz"
                ? "Complete 3 or more quiz attempts to appear here."
                : activeTab === "achievements"
                  ? "Unlock achievements to appear on this leaderboard."
                  : "Be the first to appear on this leaderboard!"}
            </p>
          </div>
        )}

        {/* Ranked list */}
        {!loading && !error && entries.length > 0 && (
          <>
            {/* No search matches */}
            {visibleEntries.length === 0 && (
              <div className="lb-no-match">
                No students match "{searchQuery}"
              </div>
            )}

            {/* Top 3 — card treatment */}
            {visibleEntries.slice(0, 3).length > 0 && (
              <div className="lb-top3">
                {visibleEntries.slice(0, 3).map((entry, i) => (
                  <LeaderboardRow
                    // user_id is always non-null — reliable key.
                    // Index fallback handles any edge case where user_id is missing.
                    key={entry.user_id ?? String(i)}
                    entry={entry}
                    tab={currentTab}
                    isTop3
                    onClick={() => setPreviewUserId(entry.user_id)}
                  />
                ))}
              </div>
            )}

            {/* Divider between top-3 and rest */}
            {visibleEntries.length > 3 && <div className="lb-divider" />}

            {/* Ranks 4+ — compact rows */}
            <div className="lb-rest">
              {visibleEntries.slice(3).map((entry, i) => (
                <LeaderboardRow
                  key={entry.user_id ?? String(i)}
                  entry={entry}
                  tab={currentTab}
                  isTop3={false}
                  onClick={() => setPreviewUserId(entry.user_id)}
                />
              ))}

              {/* Pinned current-user row if outside the visible list */}
              {showPinnedUser && (
                <>
                  <div className="lb-pin-sep">
                    <div className="lb-pin-sep-line" />
                    <span className="lb-pin-sep-label">your position</span>
                    <div className="lb-pin-sep-line" />
                  </div>
                  <LeaderboardRow
                    entry={currentEntry}
                    tab={currentTab}
                    isTop3={false}
                    onClick={() => setPreviewUserId(currentEntry.user_id)}
                  />
                </>
              )}

              {/* No-quiz-attempts nudge (§4.4) */}
              {activeTab === "quiz" && !currentEntry && !loading && (
                <p className="lb-nudge">
                  Complete at least 3 quizzes to be ranked here.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Public profile modal — rendered when a row is clicked */}
      {previewUserId != null && (
        <PublicProfileModal
          userId={previewUserId}
          onClose={() => setPreviewUserId(null)}
        />
      )}
    </div>
  );
};

export default Leaderboard;
