// file path: web/src/pages/dashboards/student/profile/ProfileModals.jsx
// BadgeEquipModal and PublicProfileModal as named exports.

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { X, CheckCircle, Lock, Trophy } from "lucide-react";
import { ACHIEVEMENT_ICONS, ACHIEVEMENT_ICON_FALLBACK } from "../../../../constants/achievements";
import { computeXP, rankFor, rankAccent } from "../../../../utils/xp";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BadgeEquipModal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MAX_EQUIPPED = 3;

const RARITY_COLORS = {
  common:    '#a1a1aa',
  uncommon:  '#4ade80',
  rare:      '#60a5fa',
  epic:      '#c084fc',
  legendary: '#fbbf24',
};

export const BadgeEquipModal = ({ isOpen, achievements, equippedBadges, onSave, onClose }) => {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving]     = useState(false);

  // Sync selected state every time the modal opens.
  // Using useState initializer alone would capture equippedBadges only once at mount,
  // causing stale state if badges change between modal opens.
  useEffect(() => {
    if (isOpen) setSelected([...equippedBadges]);
  }, [isOpen]);

  if (!isOpen) return null;

  const toggle = (id) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_EQUIPPED) return prev;
      return [...prev, id];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selected);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const slotsLeft = MAX_EQUIPPED - selected.length;

  return (
    <div
      className="prof-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="prof-modal" style={{ overflowY: 'hidden', maxHeight: '85vh' }}>

        {/* Header */}
        <div className="prof-modal-head">
          <div>
            <div className="prof-modal-title">Manage Display Badges</div>
            <div className="prof-modal-sub">
              {slotsLeft > 0
                ? `${slotsLeft} slot${slotsLeft !== 1 ? "s" : ""} remaining`
                : "All slots filled"
              }
            </div>
          </div>
          <div className="prof-badge-equip-head-right">
            <div className="prof-slot-dots">
              {Array.from({ length: MAX_EQUIPPED }).map((_, i) => (
                <div
                  key={i}
                  className="prof-slot-dot"
                  style={{ background: i < selected.length ? 'var(--color-accent)' : 'var(--color-surface-3)' }}
                />
              ))}
            </div>
            <button onClick={onClose} className="prof-modal-close">
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {/* Badge grid */}
        <div className="prof-badge-scroll">
          {achievements.length === 0 ? (
            <div className="prof-badge-empty">
              <div className="prof-badge-empty-icon">
                <Trophy style={{ width: 20, height: 20, color: 'var(--color-fg-subtle)' }} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-ui)', marginBottom: 4 }}>
                No badges yet
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)' }}>
                Complete achievements to unlock badges
              </p>
            </div>
          ) : (
            <div className="prof-badge-equip-grid">
              {achievements.map((a) => {
                const Icon        = ACHIEVEMENT_ICONS[a.id] || ACHIEVEMENT_ICON_FALLBACK;
                const rarityColor = RARITY_COLORS[a.rarity] || RARITY_COLORS.common;
                const isSelected  = selected.includes(a.id);
                const isLocked    = !a.unlocked;
                const isFull      = !isSelected && selected.length >= MAX_EQUIPPED;

                return (
                  <button
                    key={a.id}
                    onClick={() => !isLocked && toggle(a.id)}
                    disabled={isLocked || (isFull && !isSelected)}
                    className={[
                      'prof-badge-item',
                      isSelected           ? 'prof-badge-item--selected' : '',
                      isLocked             ? 'prof-badge-item--locked'   : '',
                      !isLocked && isFull  ? 'prof-badge-item--full'     : '',
                    ].join(' ')}
                  >
                    <div
                      className="prof-badge-item-icon"
                      style={!isLocked ? { background: `color-mix(in srgb, ${rarityColor} 14%, transparent)` } : {}}
                    >
                      <Icon style={{
                        width: 18, height: 18,
                        color: isLocked ? 'var(--color-fg-subtle)' : rarityColor,
                      }} />
                    </div>
                    <p className="prof-badge-item-name" style={{ color: isLocked ? 'var(--color-fg-subtle)' : 'var(--color-fg-muted)' }}>
                      {a.name}
                    </p>
                    {!isLocked && (
                      <div className="prof-badge-rarity-dot" style={{ background: rarityColor }} />
                    )}
                    {isSelected && (
                      <div className="prof-badge-check">
                        <CheckCircle style={{ width: 11, height: 11, color: 'white' }} />
                      </div>
                    )}
                    {isLocked && (
                      <div className="prof-badge-lock">
                        <Lock style={{ width: 9, height: 9, color: 'var(--color-bg)' }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="prof-modal-foot">
          <button onClick={onClose} className="prof-modal-cancel">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="prof-modal-save">
            {saving ? (
              <>
                <div className="prof-spinner-ring" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Saving…
              </>
            ) : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PublicProfileModal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PUB_API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const formatMonthYear = (isoString) => {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const BANNER_CONFIG = {
  1: { gradient: "linear-gradient(135deg, #04510e 0%, #065c10 50%, #0a7a18 100%)" },
  2: { gradient: "linear-gradient(135deg, #065c10 0%, #076b15 50%, #16a34a 100%)" },
  3: { gradient: "linear-gradient(135deg, #134e4a 0%, #0d9488 50%, #2dd4bf 100%)" },
  4: { gradient: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #8b5cf6 100%)" },
  5: { gradient: "linear-gradient(135deg, #3b0764 0%, #7e22ce 50%, #a855f7 100%)" },
  6: { gradient: "linear-gradient(135deg, #92400e 0%, #d97706 60%, #fbbf24 100%)" },
};
const getBannerGradient = (level) => (BANNER_CONFIG[Math.min(level, 6)] || BANNER_CONFIG[1]).gradient;

const StatTile = ({ label, value, sub }) => (
  <div className="prof-pub-stat">
    <div className="prof-pub-stat-label">{label}</div>
    <div className="prof-pub-stat-val">{value}</div>
    {sub && <div className="prof-pub-stat-sub">{sub}</div>}
  </div>
);

const PubBadgeSlots = ({ equippedBadges, achievements }) => {
  const slots = [0, 1, 2].map(i => equippedBadges[i] ?? null);
  return (
    <div className="prof-pub-badge-slots">
      {slots.map((id, i) => {
        if (!id) return (
          <div key={i} className="prof-pub-badge-slot">
            <div className="prof-pub-badge-icon prof-pub-badge-icon--empty">
              <span style={{ fontSize: 16, opacity: 0.2, userSelect: 'none' }}>?</span>
            </div>
            <span className="prof-pub-badge-name">Empty</span>
          </div>
        );
        const ach         = achievements.find(a => a.id === id);
        const rarityColor = `var(--color-rarity-${ach?.rarity || 'common'})`;
        const Icon        = ACHIEVEMENT_ICONS[id] || ACHIEVEMENT_ICON_FALLBACK;
        const name        = ach?.name || `#${id}`;
        return (
          <div key={id} className="prof-pub-badge-slot">
            <div
              title={name}
              className="prof-pub-badge-icon"
              style={{ background: `color-mix(in srgb, ${rarityColor} 12%, transparent)` }}
            >
              <Icon style={{ width: 22, height: 22, color: rarityColor }} />
            </div>
            <span className="prof-pub-badge-name">{name}</span>
          </div>
        );
      })}
    </div>
  );
};

const AchievementChip = ({ achievementId, achievements }) => {
  const ach         = achievements.find(a => a.id === achievementId);
  const rarityColor = `var(--color-rarity-${ach?.rarity || 'common'})`;
  const Icon        = ACHIEVEMENT_ICONS[achievementId] || ACHIEVEMENT_ICON_FALLBACK;
  const name        = ach?.name || `Achievement #${achievementId}`;
  return (
    <span className="prof-pub-achv-chip" style={{ color: rarityColor, borderColor: rarityColor, background: `color-mix(in srgb, ${rarityColor} 8%, var(--color-surface))` }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: rarityColor, flexShrink: 0, display: 'inline-block' }} />
      <Icon style={{ width: 11, height: 11, flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>{name}</span>
    </span>
  );
};

// Accepts userId — the reliable lookup key (always non-null, unlike username).
// Fetches GET /api/profile/public/:userId and GET /api/achievements for metadata.
// Achievement metadata (names, rarities) is fetched internally — callers don't need to pass it.
export const PublicProfileModal = ({ userId, onClose }) => {
  const [profile,         setProfile]         = useState(null);
  // achievementMeta: full list from /api/achievements — provides names + rarities for chips/slots.
  const [achievementMeta, setAchievementMeta] = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token   = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      // Fetch profile and achievement metadata in parallel.
      const [profileRes, achRes] = await Promise.all([
        axios.get(`${PUB_API_URL}/api/profile/public/${userId}`, { headers }),
        axios.get(`${PUB_API_URL}/api/achievements`,             { headers }),
      ]);
      setProfile(profileRes.data.profile);
      setAchievementMeta(achRes.data.achievements || []);
    } catch (err) {
      console.error("PublicProfileModal fetch error:", err);
      setError("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const displayName        = profile?.username?.trim() || profile?.full_name || "Student";
  const xpPoints           = profile?.xp_points ?? 0;
  const rankName           = rankFor(xpPoints);
  const xpComputed         = computeXP(xpPoints);
  const accent             = rankAccent(xpComputed.level);
  const equippedBadges     = profile?.equipped_badges || [];
  const recentAchievements = profile?.recent_achievements || [];
  const stats              = profile?.stats || {};

  return (
    <div
      className="prof-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="prof-modal" style={{ overflowY: 'hidden' }}>

        {/* Level gradient banner */}
        <div className="prof-pub-banner" style={{ background: getBannerGradient(xpComputed.level) }}>
          <div className="prof-pub-banner-dots" />
        </div>

        {/* Title + close */}
        <div className="prof-modal-head">
          <div className="prof-modal-title">Public Profile</div>
          <button onClick={onClose} aria-label="Close" className="prof-modal-close">
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="prof-pub-body" style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-surface-3)', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <div style={{ height: 14, background: 'var(--color-surface-3)', width: 120 }} />
                  <div style={{ height: 11, background: 'var(--color-surface-3)', width: 72 }} />
                </div>
              </div>
              <div className="prof-pub-stat-grid">
                {[...Array(4)].map((_, i) => (
                  <div key={i} style={{ height: 64, background: 'var(--color-surface-3)' }} />
                ))}
              </div>
            </div>
          )}

          {error && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-ui)' }}>{error}</p>
              <button
                onClick={fetchProfile}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && profile && (
            <>
              {/* Identity */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--color-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ color: 'white', fontSize: 20, fontWeight: 700, userSelect: 'none' }}>
                      {displayName[0]?.toUpperCase() || "?"}
                    </span>
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p className="prof-pub-name">{displayName}</p>
                  {profile.username && (
                    <p className="prof-pub-username">@{profile.username}</p>
                  )}
                  <span className="prof-pub-rank-tag" style={{ color: accent.token, borderColor: accent.token }}>
                    {rankName}
                  </span>
                </div>
              </div>

              {/* XP progress bar */}
              <div>
                <div className="prof-pub-xp-meta">
                  <span className="prof-pub-xp-meta-left">
                    {xpComputed.isMaxLevel ? "Max Level" : `${xpComputed.xpIntoLevel} / ${xpComputed.xpNeeded} XP`}
                  </span>
                  <span className="prof-pub-xp-level" style={{ color: accent.token }}>Lv.{xpComputed.level}</span>
                </div>
                <div className="prof-pub-xp-bar">
                  <i style={{ width: `${xpComputed.progress * 100}%`, background: accent.token }} />
                </div>
              </div>

              {/* Equipped badges */}
              <div>
                <p className="prof-pub-section-label">Equipped Badges</p>
                <PubBadgeSlots equippedBadges={equippedBadges} achievements={achievementMeta} />
              </div>

              {/* Stats */}
              <div>
                <p className="prof-pub-section-label">Stats</p>
                <div className="prof-pub-stat-grid">
                  <StatTile label="XP Points"    value={xpPoints.toLocaleString()} sub={`Level ${xpComputed.level}`} />
                  <StatTile label="Quiz Avg"      value={stats.quiz_avg_percentage != null ? `${stats.quiz_avg_percentage}%` : "—"} sub={stats.quiz_passes != null ? `${stats.quiz_passes} passes` : undefined} />
                  <StatTile label="Quiz Passes"   value={stats.quiz_passes ?? "—"} sub="modules passed" />
                  <StatTile label="Achievements"  value={stats.achievements_unlocked ?? "—"} sub={`of ${achievementMeta.length} total`} />
                  <StatTile label="Streak"        value={stats.streak ?? "—"} sub="day streak" />
                </div>
              </div>

              {/* Recent achievements */}
              <div>
                <p className="prof-pub-section-label">Recent Achievements</p>
                {recentAchievements.length > 0 ? (
                  <div className="prof-pub-achv-scroll">
                    {recentAchievements.slice(0, 12).map((a) => (
                      <AchievementChip key={a.achievement_id} achievementId={a.achievement_id} achievements={achievementMeta} />
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)', fontStyle: 'italic' }}>
                    No achievements yet
                  </p>
                )}
              </div>

              {/* Footer */}
              <p className="prof-pub-footer">
                Member since {formatMonthYear(profile.joined_at)}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
