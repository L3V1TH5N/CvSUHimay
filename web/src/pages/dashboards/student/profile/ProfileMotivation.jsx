// file path: web/src/pages/dashboards/student/profile/ProfileMotivation.jsx
import { ArrowRight } from "lucide-react";
import { ACHIEVEMENT_ICONS, ACHIEVEMENT_ICON_FALLBACK } from "../../../../constants/achievements";

const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

// ── Block 1: Streak ────────────────────────────────────────────────────
const StreakBlock = ({ streak = 0 }) => {
  const hasStreak = streak > 0;
  return (
    <div className="prof-rail-block">
      <div className="prof-rail-label">Practice Streak</div>
      <div className="prof-rail-display" style={hasStreak ? { color: 'var(--color-accent)' } : {}}>
        {streak}
        <span className="sub">day{streak !== 1 ? 's' : ''}</span>
      </div>
      <div className="prof-rail-note">
        {streak === 0
          ? "No active streak — practice today to start one."
          : streak < 3
            ? "Getting started. Don't break the chain."
            : streak < 7
              ? "Good momentum. Keep it burning."
              : "Unstoppable. You're on a serious streak."
        }
      </div>
    </div>
  );
};

// ── Block 2: XP / Rank ─────────────────────────────────────────────────
const XPBlock = ({ xpData }) => {
  if (!xpData) return null;
  const xpPct = xpData.isMaxLevel ? 100 : Math.min(100, xpData.progress * 100);

  return (
    <div className="prof-rail-block">
      <div className="prof-rail-label">Global Rank</div>
      <div className="prof-rail-display">
        <span style={{ color: 'var(--color-accent)' }}>{xpData.rank}</span>
      </div>

      <div className="prof-rail-sep" />

      <div className="prof-rail-sub-label">Level {xpData.level} · XP</div>
      <div className="prof-rail-display" style={{ fontSize: 22 }}>
        <span style={{ color: 'var(--color-accent)' }}>{xpData.xpIntoLevel.toLocaleString()}</span>
        <span className="sub">/ {xpData.xpNeeded.toLocaleString()}</span>
      </div>
      <div className="prof-xp-bar"><i style={{ width: `${xpPct}%` }} /></div>
      <div className="prof-xp-bar-meta">
        <span>{xpData.rank}</span>
        {!xpData.isMaxLevel && (
          <span>{(xpData.xpNeeded - xpData.xpIntoLevel).toLocaleString()} to L{xpData.level + 1}</span>
        )}
      </div>
    </div>
  );
};

// ── Block 3: Profile Completeness ──────────────────────────────────────
const COMPLETENESS_FIELDS = [
  { key: "full_name",     label: "Full name"  },
  { key: "username",      label: "Username"   },
  { key: "bio",           label: "Bio"        },
  { key: "phone",         label: "Phone"      },
  { key: "date_of_birth", label: "Birthday"   },
  { key: "student_id",    label: "Student ID" },
  { key: "year_level",    label: "Year level" },
];

const CompletenessBlock = ({ profileData, onEditClick }) => {
  if (!profileData) return null;
  const filled    = COMPLETENESS_FIELDS.filter(f => profileData[f.key]?.toString?.().trim()).length;
  const total     = COMPLETENESS_FIELDS.length;
  const pct       = Math.round((filled / total) * 100);
  const remaining = COMPLETENESS_FIELDS.filter(f => !profileData[f.key]?.toString?.().trim());
  const isDone    = pct === 100;

  return (
    <div className="prof-rail-block">
      <div className="prof-rail-label">Profile Complete</div>
      <div className="prof-rail-display" style={{ fontSize: 22 }}>
        <span style={{ color: pct === 100 ? 'var(--color-accent)' : 'var(--color-fg)' }}>{pct}</span>
        <span className="sub">%</span>
      </div>
      <div className="prof-lp-bar"><i style={{ width: `${pct}%` }} /></div>

      {isDone ? (
        <div className="prof-rail-note">Profile complete.</div>
      ) : (
        <>
          {remaining[0] && (
            <div className="prof-rail-note">
              Add your <strong style={{ color: 'var(--color-fg)' }}>{remaining[0].label}</strong>
              {remaining.length > 1 && ` (+${remaining.length - 1} more)`}.
            </div>
          )}
          {onEditClick && (
            <button className="prof-rail-cta" onClick={onEditClick}>
              Complete profile <ArrowRight size={10} />
            </button>
          )}
        </>
      )}
    </div>
  );
};

// ── Block 4: Next Achievement ──────────────────────────────────────────
const NextAchievementBlock = ({ achievements = [] }) => {
  const locked = achievements
    .filter(a => !a.unlocked)
    .sort((a, b) => (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99));

  const next = locked[0];

  return (
    <div className="prof-rail-block">
      <div className="prof-rail-label">Up Next</div>
      {!next ? (
        <div className="prof-rail-note">All achievements unlocked.</div>
      ) : (() => {
        const Icon        = ACHIEVEMENT_ICONS[next.id] || ACHIEVEMENT_ICON_FALLBACK;
        const rarityColor = `var(--color-rarity-${next.rarity})`;
        return (
          <div className="prof-rail-achv">
            <div
              className="prof-rail-achv-medal"
              style={{ background: `color-mix(in srgb, ${rarityColor} 13%, transparent)` }}
            >
              <Icon style={{ width: 16, height: 16, color: rarityColor }} />
            </div>
            <div className="prof-rail-achv-body">
              <div className="prof-rail-achv-name" style={{ color: rarityColor }}>{next.name}</div>
              <div className="prof-rail-achv-meta">{next.description?.slice(0, 50)}{next.description?.length > 50 ? '…' : ''}</div>
              <div className="prof-rail-achv-pts">{Number(next.points) || "—"} pts · {next.rarity}</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ── ProfileMotivation ──────────────────────────────────────────────────
const ProfileMotivation = ({
  xpData,
  stats,
  achievements = [],
  profileData,
  onEditClick,
}) => (
  <>
    <StreakBlock        streak={stats?.streak ?? 0} />
    <XPBlock           xpData={xpData} />
    <CompletenessBlock profileData={profileData} onEditClick={onEditClick} />
    <NextAchievementBlock achievements={achievements} />
  </>
);

export default ProfileMotivation;
