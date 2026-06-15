// file path: web/src/pages/dashboards/student/profile/ProfileAchievements.jsx

import { useState } from "react";
import { Trophy, Star, Award, Lock, Unlock, Brain, BookOpen, FlaskConical } from "lucide-react";
import { ACHIEVEMENT_ICONS, ACHIEVEMENT_ICON_FALLBACK } from "../../../../constants/achievements";
import { formatDateShort } from "../../../../utils/format";

const CATEGORIES = [
  { id: "all",        name: "All",        icon: Trophy       },
  { id: "quiz",       name: "Quiz",       icon: Brain        },
  { id: "learning",   name: "Learning",   icon: BookOpen     },
  { id: "simulation", name: "Simulation", icon: FlaskConical },
];

const STATUS_TABS = [
  { id: "all",      label: "All"      },
  { id: "unlocked", label: "Unlocked" },
  { id: "locked",   label: "Locked"   },
];

const getProgressCopy = (pct) => {
  if (pct === 0)  return "Complete activities to earn your first badge.";
  if (pct < 50)   return "You're building momentum.";
  if (pct < 100)  return "More than halfway there.";
  return "All achievements unlocked. Impressive.";
};

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

const RARITY_RANK = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };

// ── Recently unlocked strip ────────────────────────────────────────────

const RecentlyUnlockedStrip = ({ achievements }) => {
  const recent = achievements.filter(a =>
    a.unlocked && a.unlocked_at &&
    (Date.now() - new Date(a.unlocked_at).getTime()) < SEVEN_DAYS
  );
  if (recent.length === 0) return null;

  return (
    <div className="prof-achv-recent">
      <div className="prof-achv-recent-label">
        Recently Unlocked
        <span className="prof-achv-recent-count">{recent.length}</span>
        <span className="prof-achv-recent-date">Last 7 days</span>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {recent.map(a => {
          const Icon        = ACHIEVEMENT_ICONS[a.id] || ACHIEVEMENT_ICON_FALLBACK;
          const rarityColor = `var(--color-rarity-${a.rarity})`;
          return (
            <div key={a.id} className="prof-achv-recent-item" style={{ borderTop: `2px solid ${rarityColor}` }}>
              <div style={{
                width: 40, height: 40,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `color-mix(in srgb, ${rarityColor} 13%, transparent)`,
              }}>
                <Icon style={{ width: 18, height: 18, color: rarityColor }} />
              </div>
              <span className="prof-achv-recent-item-name">
                {a.name}
              </span>
              <span className="prof-achv-rarity-tag prof-achv-rarity-tag--strip" style={{ color: rarityColor, borderColor: rarityColor }}>
                {a.rarity}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Unlocked card ──────────────────────────────────────────────────────

const UnlockedCard = ({ a, unlockDate, isNew }) => {
  const Icon        = ACHIEVEMENT_ICONS[a.id] || ACHIEVEMENT_ICON_FALLBACK;
  const rarityColor = `var(--color-rarity-${a.rarity})`;

  return (
    <div className="prof-achv-card">
      <div className="prof-achv-top-bar" style={{ background: rarityColor }} />
      <div className="prof-achv-body">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div className="prof-achv-icon"
            style={{ background: `color-mix(in srgb, ${rarityColor} 13%, transparent)` }}>
            <Icon style={{ width: 17, height: 17, color: rarityColor }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span className="prof-achv-rarity-tag" style={{ color: rarityColor, borderColor: rarityColor }}>
              {a.rarity === 'legendary' ? '✦ legendary' : a.rarity}
            </span>
            {isNew && (
              <span style={{ fontSize: 9, fontWeight: 700, background: '#04510e', color: 'white', padding: '2px 5px', fontFamily: 'var(--font-ui)', letterSpacing: '0.08em' }}>
                New
              </span>
            )}
          </div>
        </div>
        <div className="prof-achv-name">{a.name}</div>
        <div className="prof-achv-desc">{a.description}</div>
      </div>
      <div className="prof-achv-footer">
        <div className="prof-achv-pts">
          <Star style={{ width: 11, height: 11, color: '#d97706' }} />
          {Number(a.points) || "—"} XP
        </div>
        {unlockDate && <span className="prof-achv-date">{unlockDate}</span>}
      </div>
    </div>
  );
};

// ── Locked card ────────────────────────────────────────────────────────

const LockedCard = ({ a }) => {
  const Icon        = ACHIEVEMENT_ICONS[a.id] || ACHIEVEMENT_ICON_FALLBACK;
  const rarityColor = `var(--color-rarity-${a.rarity})`;

  return (
    <div className="prof-achv-card prof-achv-card--locked">
      <div className="prof-achv-top-bar" style={{ background: rarityColor, opacity: 0.2 }} />
      <div className="prof-achv-body">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative' }}>
            <div className="prof-achv-icon" style={{ background: 'var(--color-surface-3)' }}>
              <Icon style={{ width: 17, height: 17, color: 'var(--color-fg-subtle)' }} />
            </div>
            <div style={{
              position: 'absolute', bottom: -4, right: -4,
              width: 16, height: 16,
              background: 'var(--color-fg-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Lock style={{ width: 9, height: 9, color: 'var(--color-bg)' }} />
            </div>
          </div>
          <span className="prof-achv-rarity-tag" style={{ color: rarityColor, borderColor: rarityColor, opacity: 0.4 }}>
            {a.rarity}
          </span>
        </div>
        <div className="prof-achv-name">{a.name}</div>
        <div className="prof-achv-desc">{a.description}</div>
      </div>
      <div className="prof-achv-footer">
        <div className="prof-achv-pts" style={{ opacity: 0.5 }}>
          <Star style={{ width: 11, height: 11, color: 'var(--color-fg-subtle)' }} />
          {Number(a.points) || "—"} XP
        </div>
        <span className="prof-achv-date">Locked</span>
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────

const ProfileAchievements = ({ achievements = [], loading = false, error = false }) => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus,   setSelectedStatus]   = useState("all");
  const [sortRarity,       setSortRarity]        = useState("default");

  if (loading) {
    return (
      <div className="prof-spinner">
        <div className="prof-spinner-ring" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', fontSize: 13, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-ui)' }}>
        Failed to load achievements.
      </div>
    );
  }

  const unlocked    = achievements.filter(a => a.unlocked);
  const totalPoints = unlocked.reduce((s, a) => s + (Number(a.points) || 0), 0);
  const rarePlus    = unlocked.filter(a => ["rare", "epic", "legendary"].includes(a.rarity)).length;
  const completion  = achievements.length
    ? Math.round((unlocked.length / achievements.length) * 100) : 0;

  const byCat = selectedCategory === "all"
    ? achievements
    : achievements.filter(a => a.category === selectedCategory);

  const filtered = selectedStatus === "unlocked"
    ? byCat.filter(a => a.unlocked)
    : selectedStatus === "locked"
      ? byCat.filter(a => !a.unlocked)
      : byCat;

  const sorted = sortRarity === "default"
    ? filtered
    : [...filtered].sort((a, b) => {
        const diff = (RARITY_RANK[a.rarity] ?? 0) - (RARITY_RANK[b.rarity] ?? 0);
        return sortRarity === "high" ? -diff : diff;
      });

  const categoryCounts = CATEGORIES.reduce((acc, { id }) => {
    const items = id === "all" ? achievements : achievements.filter(a => a.category === id);
    acc[id] = { total: items.length, unlocked: items.filter(a => a.unlocked).length };
    return acc;
  }, {});

  const activeCategoryLabel = CATEGORIES.find(c => c.id === selectedCategory)?.name ?? "this category";

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Progress header */}
      <div className="prof-achv-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="prof-achv-fraction">{unlocked.length}</span>
              <span className="prof-achv-fraction sub">/ {achievements.length} unlocked</span>
            </div>
            <div className="prof-achv-progress-copy">{getProgressCopy(completion)}</div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div className="prof-achv-stat">
              <div className="prof-achv-stat-val">
                <Star style={{ width: 12, height: 12, color: '#d97706' }} />
                {totalPoints}
              </div>
              <div className="prof-achv-stat-label">points</div>
            </div>
            <div className="prof-achv-stat">
              <div className="prof-achv-stat-val">
                <Award style={{ width: 12, height: 12, color: 'var(--color-rarity-epic)' }} />
                {rarePlus}
              </div>
              <div className="prof-achv-stat-label">rare+</div>
            </div>
          </div>
        </div>
        <div className="prof-achv-bar">
          <i style={{ width: achievements.length ? `${(unlocked.length / achievements.length) * 100}%` : '0%' }} />
        </div>
        {/* Rarity legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-hairline)' }}>
          {['common','uncommon','rare','epic','legendary'].map(r => (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: `var(--color-rarity-${r})` }} />
              <span style={{ fontSize: 10, color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)', textTransform: 'capitalize' }}>{r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recently unlocked strip */}
      <RecentlyUnlockedStrip achievements={achievements} />

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="prof-filter-rail">
          {CATEGORIES.map(({ id, name, icon: Icon }) => {
            const counts = categoryCounts[id];
            const isActive = selectedCategory === id;
            return (
              <button
                key={id}
                onClick={() => setSelectedCategory(id)}
                className={`prof-filter-pill${isActive ? ' active' : ''}`}
              >
                <Icon style={{ width: 11, height: 11 }} />
                {name}
                {id !== "all" && (
                  <span style={{ opacity: 0.6 }}> · {counts.unlocked}/{counts.total}</span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          <select
            value={sortRarity}
            onChange={e => setSortRarity(e.target.value)}
            style={{
              fontSize: 11, fontFamily: 'var(--font-ui)', fontWeight: 500,
              color: 'var(--color-fg-muted)', background: 'var(--color-surface-2)',
              border: '1px solid var(--color-hairline)', borderRadius: 4,
              padding: '3px 6px', height: 26, cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="default">Sort: Default</option>
            <option value="high">Rarity: High → Low</option>
            <option value="low">Rarity: Low → High</option>
          </select>
          <div className="prof-status-toggle">
            {STATUS_TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSelectedStatus(id)}
                className={`prof-status-btn${selectedStatus === id ? ' active' : ''}`}
              >
                {id === "unlocked" && <Unlock style={{ width: 10, height: 10 }} />}
                {id === "locked"   && <Lock   style={{ width: 10, height: 10 }} />}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Achievement grid */}
      {sorted.length === 0 ? (
        <div className="prof-achv-empty">
          <div className="prof-achv-empty-icon">
            <Trophy style={{ width: 18, height: 18, color: 'var(--color-fg-subtle)' }} />
          </div>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-ui)', marginBottom: 4 }}>
            No {selectedStatus !== "all" ? selectedStatus + " " : ""}{activeCategoryLabel.toLowerCase()} achievements
          </p>
          <p style={{ fontSize: 12, color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)' }}>
            {selectedStatus === "locked"
              ? "All achievements in this category are already unlocked."
              : "Complete activities to earn badges in this category."}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {sorted.map(a => {
            const unlockDate = formatDateShort(a.unlocked_at);
            const isNew = a.unlocked_at
              && (Date.now() - new Date(a.unlocked_at).getTime()) < SEVEN_DAYS;
            return a.unlocked
              ? <UnlockedCard key={a.id} a={a} unlockDate={unlockDate} isNew={isNew} />
              : <LockedCard   key={a.id} a={a} />;
          })}
        </div>
      )}

    </div>
  );
};

export default ProfileAchievements;
