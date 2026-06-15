// file path: web/src/pages/dashboards/student/profile/ProfileHero.jsx
import './Profile.css';
import { useRef, useState, useEffect } from "react";
import { Camera, Loader2, Plus, Pencil, Trophy, Eye } from "lucide-react";
import { ACHIEVEMENT_ICONS, ACHIEVEMENT_ICON_FALLBACK, RARITY } from "../../../../constants/achievements";

// ── Level gradient (used for accent strip and level pill) ─────────────
const LEVEL_GRADIENT = {
  1: "linear-gradient(135deg, #04510e 0%, #0a7a18 100%)",
  2: "linear-gradient(135deg, #065c10 0%, #16a34a 100%)",
  3: "linear-gradient(135deg, #134e4a 0%, #2dd4bf 100%)",
  4: "linear-gradient(135deg, #4c1d95 0%, #8b5cf6 100%)",
  5: "linear-gradient(135deg, #3b0764 0%, #a855f7 100%)",
  6: "linear-gradient(135deg, #92400e 0%, #fbbf24 100%)",
};
const getLevelGradient = (level) => LEVEL_GRADIENT[Math.min(level, 6)] || LEVEL_GRADIENT[1];

// ── XP ring geometry (unchanged) ─────────────────────────────────────
const RING_SIZE = 112;
const RING_CX   = 56;
const RING_CY   = 56;
const RING_R    = 50;
const RING_C    = 2 * Math.PI * RING_R;

// ── LevelBorder (unchanged — avatar is circular by design) ───────────
const LevelBorder = ({ level, children }) => {
  if (!level || level <= 1) return <>{children}</>;
  const shadowMap = {
    2: "0 0 0 2.5px #9ca3af",
    3: "0 0 0 2px #9ca3af, 0 0 0 5.5px rgba(156,163,175,0.35)",
    4: "0 0 0 2.5px #04510e",
  };
  if (level <= 4) {
    return <div className="rounded-full" style={{ boxShadow: shadowMap[level] }}>{children}</div>;
  }
  if (level === 5) {
    return (
      <div className="rounded-full overflow-hidden"
        style={{ padding: 3, background: "linear-gradient(135deg, #04510e 0%, #22c55e 50%, #4ade80 100%)" }}>
        {children}
      </div>
    );
  }
  // Level 6: spinning amber ring
  return (
    <div className="rounded-full overflow-hidden" style={{ padding: 3, position: "relative" }}>
      <div className="absolute inset-0 rounded-full"
        style={{ background: "conic-gradient(from 0deg, #d97706, #f59e0b, #fcd34d, #f59e0b, #d97706)", animation: "borderSpin 3s linear infinite" }} />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
};

// ── XP ring (unchanged) ───────────────────────────────────────────────
const XPRing = ({ progress }) => {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 120); return () => clearTimeout(t); }, []);
  const dashOffset = animated ? RING_C * (1 - progress) : RING_C;
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      style={{ transform: "rotate(-90deg)" }}>
      <circle cx={RING_CX} cy={RING_CY} r={RING_R} fill="none"
        style={{ stroke: 'var(--color-surface-3)' }}
        strokeWidth="3.5" />
      <circle cx={RING_CX} cy={RING_CY} r={RING_R} fill="none" stroke="#04510e"
        strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray={RING_C} strokeDashoffset={dashOffset}
        style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.4, 0, 0.2, 1)" }} />
    </svg>
  );
};

// ── Count-up animation hook (unchanged) ──────────────────────────────
const useCountUp = (target, duration = 800) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!target) { setCount(0); return; }
    const start = Date.now();
    const tick = () => {
      const elapsed  = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.round(target * progress));
      if (progress < 1) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, duration]);
  return count;
};

// ── Avatar URL helper (unchanged) ─────────────────────────────────────
const getAvatarUrl = (avatarPath, apiUrl) => {
  if (!avatarPath) return null;
  if (avatarPath.startsWith("http://") || avatarPath.startsWith("https://")) return avatarPath;
  return import.meta.env.DEV ? avatarPath : `${apiUrl}${avatarPath}`;
};

// ── Three badge slots ─────────────────────────────────────────────────
const BadgeSlots = ({ equippedBadges, unlockedAchievements, onOpenModal }) => {
  const slots = [0, 1, 2].map(i => {
    const id  = equippedBadges[i];
    const ach = id ? unlockedAchievements.find(a => a.id === id) : null;
    return { id, ach };
  });

  return (
    <div>
      <p className="prof-badges-label">Badge Showcase</p>
      <div className="prof-badge-grid">
        {slots.map(({ id, ach }, i) => {
          const Icon        = ach ? (ACHIEVEMENT_ICONS[id] || ACHIEVEMENT_ICON_FALLBACK) : null;
          const rarityColor = ach ? `var(--color-rarity-${ach.rarity})` : null;
          return (
            <button
              key={i}
              onClick={onOpenModal}
              title={ach ? ach.name : "Equip a badge"}
              className="prof-badge-slot"
            >
              <div
                className="prof-badge-icon"
                style={ach ? { background: `color-mix(in srgb, ${rarityColor} 15%, transparent)` } : {}}
              >
                {ach
                  ? <Icon style={{ width: 17, height: 17, color: rarityColor }} />
                  : <Plus style={{ width: 13, height: 13, color: 'var(--color-fg-subtle)' }} />
                }
              </div>
              <p className="prof-badge-name">{ach ? ach.name : "Equip"}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ── ProfileHero ───────────────────────────────────────────────────────
const ProfileHero = ({
  profileData,
  xpData,
  achievements = [],
  equippedBadges = [],
  unlockedAchievements = [],
  onAvatarChange,
  avatarUploading,
  apiUrl,
  onEditClick,
  onOpenBadgeModal,
  onViewPublicProfile,
}) => {
  const fileInputRef            = useRef(null);
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [profileData.avatar_url]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) onAvatarChange(file);
    e.target.value = "";
  };

  const level     = xpData?.level || 1;
  const gradient  = getLevelGradient(level);
  const avatarSrc = getAvatarUrl(profileData.avatar_url, apiUrl);
  const initials  = profileData.full_name ? profileData.full_name[0].toUpperCase() : "U";

  const COMPLETENESS_KEYS = ["full_name", "username", "bio", "phone", "date_of_birth", "student_id", "year_level"];
  const filledCount = COMPLETENESS_KEYS.filter(k => profileData[k]?.toString?.().trim()).length;
  const completePct = Math.round((filledCount / COMPLETENESS_KEYS.length) * 100);

  const levelCount       = useCountUp(level);
  const totalXpCount     = useCountUp(xpData?.totalPoints ?? 0);
  const achievementCount = useCountUp(unlockedAchievements.length);
  const simCount         = useCountUp(profileData.sim_count ?? 0);

  const statStrip = [
    { label: "Level",        value: levelCount,                                      suffix: "" },
    { label: "Total XP",     value: totalXpCount,                                    suffix: " pts" },
    { label: "Achievements", value: achievementCount,                                suffix: ` / ${achievements.length}` },
    { label: "Sim Runs",     value: profileData.sim_count != null ? simCount : null, suffix: "" },
  ];

  return (
    <div style={{ background: 'var(--color-surface)' }}>

      {/* ── Hero banner ── */}
      <div className="prof-hero-banner" style={{ background: gradient }}>
        <div className="prof-hero-banner-dots" />
      </div>

      {/* ── Identity row ── */}
      <div className="prof-identity">

        {/* Avatar group */}
        <div style={{ position: 'relative', flexShrink: 0, marginBottom: 8 }}>
          <LevelBorder level={level}>
            <div style={{ position: 'relative', background: 'var(--color-surface)', borderRadius: '50%', width: RING_SIZE, height: RING_SIZE }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--color-surface)' }} />
              {xpData && <XPRing progress={xpData.progress} />}
              <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                {avatarSrc && !imgError ? (
                  <img src={avatarSrc} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={() => setImgError(true)} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#04510e', color: 'white', fontSize: 26, fontWeight: 700 }}>
                    {initials}
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }} onChange={handleFileChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                style={{
                  position: 'absolute', bottom: 4, right: 4,
                  width: 28, height: 28,
                  background: 'var(--color-surface)',
                  border: '1.5px solid var(--color-hairline)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'background-color 140ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-surface)'}
              >
                {avatarUploading
                  ? <Loader2 style={{ width: 12, height: 12, color: 'var(--color-fg-muted)', animation: 'spin 1s linear infinite' }} />
                  : <Camera  style={{ width: 12, height: 12, color: 'var(--color-fg-muted)' }} />
                }
              </button>
            </div>
          </LevelBorder>

          {/* Level pill — rectangular */}
          {xpData && (
            <div style={{
              position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)',
              background: gradient, color: 'white',
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              fontFamily: 'var(--font-ui)', padding: '2px 8px',
              whiteSpace: 'nowrap', zIndex: 10,
              border: '1.5px solid var(--color-surface)',
              animation: 'levelPillIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            }}>
              Lv.{level}
            </div>
          )}
        </div>

        {/* Name + meta + bio */}
        <div style={{ flex: 1, minWidth: 0, paddingBottom: 12, paddingTop: 6 }}>
          <h1 className="prof-name">{profileData.full_name || "Unnamed User"}</h1>
          <div className="prof-meta">
            {profileData.username && (
              <span className="prof-username">@{profileData.username}</span>
            )}
            {xpData && (
              <span className="prof-tag prof-tag--rank">{xpData.rank}</span>
            )}
            <span className="prof-tag" style={{ textTransform: 'capitalize' }}>{profileData.role}</span>
          </div>
          {profileData.bio && (
            <p className="prof-bio">
              {profileData.bio.length > 120 ? profileData.bio.slice(0, 120) + "…" : profileData.bio}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="prof-actions">
          <button onClick={onEditClick} className="prof-btn-primary">
            <Pencil style={{ width: 12, height: 12 }} />
            {completePct < 100 ? `Edit Profile · ${completePct}%` : "Edit Profile"}
            {completePct < 100 && (
              <span className="prof-btn-progress" style={{ width: `${completePct}%` }} />
            )}
          </button>
          <button onClick={onOpenBadgeModal} className="prof-btn-secondary">
            <Trophy style={{ width: 12, height: 12 }} />
            Equip Badges
          </button>
          <button onClick={onViewPublicProfile} className="prof-btn-ghost">
            <Eye style={{ width: 12, height: 12 }} />
            View Public
          </button>
        </div>

      </div>

      {/* ── Stat strip ── */}
      <div className="prof-stat-strip">
        {statStrip.map(({ label, value, suffix }) => (
          <div key={label} className="prof-stat">
            <span className="prof-stat-val">{value == null ? "—" : `${value}${suffix}`}</span>
            <span className="prof-stat-label">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Badge showcase + closing rule ── */}
      <div className="prof-badges">
        <BadgeSlots
          equippedBadges={equippedBadges}
          unlockedAchievements={unlockedAchievements}
          onOpenModal={onOpenBadgeModal}
        />
      </div>

    </div>
  );
};

export default ProfileHero;
