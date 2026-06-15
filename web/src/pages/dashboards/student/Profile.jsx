// file path: web/src/pages/dashboards/student/Profile.jsx

import './profile/Profile.css';
import { useState, useEffect, useContext } from "react";
import { Trophy, BarChart2, FlaskConical } from "lucide-react";
import { AppContext } from "../../../context/AppContext";
import axios from "axios";
import { toast } from "react-hot-toast";

import ProfileHero         from "./profile/ProfileHero";
import ProfileMotivation   from "./profile/ProfileMotivation";
import ProfileEditModal    from "./profile/ProfileEditModal";
import ProfileAchievements from "./profile/ProfileAchievements";
import ProfileProgress     from "./profile/ProfileProgress";
import SimulationHistory   from "./profile/SimulationHistory";
import { BadgeEquipModal, PublicProfileModal } from "./profile/ProfileModals";

import { API_URL }   from "../../../constants/achievements";
import { computeXP } from "../../../utils/xp";

// ── Helpers ──────────────────────────────────────────────────────────────


const parseEquippedBadges = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
};

const CONTENT_TABS = [
  { id: "achievements", label: "Achievements",       icon: Trophy       },
  { id: "progress",     label: "Progress",           icon: BarChart2    },
  { id: "simulation",   label: "Simulation History", icon: FlaskConical },
];

// ── Component ─────────────────────────────────────────────────────────────

const Profile = () => {
  const { user } = useContext(AppContext);

  const [profileData,         setProfileData]         = useState(null);
  const [xpData,              setXpData]              = useState(null);
  const [achievements,        setAchievements]        = useState([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);
  const [achievementsError,   setAchievementsError]   = useState(false);
  const [loading,             setLoading]             = useState(true);
  const [activeTab,           setActiveTab]           = useState("achievements");
  const [avatarUploading,     setAvatarUploading]     = useState(false);
  const [badgeModalOpen,      setBadgeModalOpen]      = useState(false);
  const [publicProfileOpen,   setPublicProfileOpen]   = useState(false);
  const [editModalOpen,       setEditModalOpen]       = useState(false);
  const [progressData,        setProgressData]        = useState(null);
  const [progressLoading,     setProgressLoading]     = useState(true);
  const [progressError,       setProgressError]       = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchAchievements();
    fetchProgress();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/profile`);
      const u = response.data.user;
      setProfileData(u);
      setXpData(computeXP(u.xp_points ?? 0));
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const fetchAchievements = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/achievements`);
      setAchievements(res.data.achievements ?? []);
    } catch {
      setAchievementsError(true);
    } finally {
      setAchievementsLoading(false);
    }
  };

  const fetchProgress = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/achievements/progress`);
      setProgressData(res.data);
    } catch {
      setProgressError(true);
    } finally {
      setProgressLoading(false);
    }
  };

  const handleSave = async (formData) => {
    try {
      await axios.put(`${API_URL}/api/profile`, formData);
      setProfileData(prev => ({ ...prev, ...formData }));
      setEditModalOpen(false);
      toast.success("Profile updated!");
    } catch (error) {
      const message = error.response?.data?.issues
        ? "Please fix the highlighted fields."
        : (error.response?.data?.error || "Failed to save changes");
      toast.error(message);
      throw error;
    }
  };

  const handleAvatarChange = async (file) => {
    const formData = new FormData();
    formData.append("avatar", file);
    setAvatarUploading(true);
    try {
      const res = await axios.post(`${API_URL}/api/profile/avatar`, formData);
      setProfileData(prev => ({ ...prev, avatar_url: res.data.avatar_url }));
      toast.success("Avatar updated!");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleEquipBadges = async (badgeIds) => {
    try {
      await axios.put(`${API_URL}/api/profile/badges`, { badge_ids: badgeIds });
      setProfileData(prev => ({ ...prev, equipped_badges: badgeIds }));
      toast.success("Badges updated!");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update badges");
      throw error;
    }
  };

  const equippedBadges       = parseEquippedBadges(profileData?.equipped_badges);
  const unlockedAchievements = achievements.filter(a => a.unlocked);

  if (loading) {
    return (
      <div className="prof-spinner" style={{ minHeight: '100vh', flexDirection: 'column', gap: 12, background: 'var(--color-bg)' }}>
        <div className="prof-spinner-ring" />
        <p style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)' }}>
          Loading profile…
        </p>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="prof-spinner" style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <p style={{ fontSize: 13, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-ui)' }}>
          Failed to load profile
        </p>
      </div>
    );
  }

  return (
    <div className="px-8 lg:px-10 py-8 lg:py-10 min-h-full" style={{ background: 'var(--color-bg)' }}>

      {/* ── Hero ── */}
      <ProfileHero
        profileData={profileData}
        xpData={xpData}
        achievements={achievements}
        equippedBadges={equippedBadges}
        unlockedAchievements={unlockedAchievements}
        onAvatarChange={handleAvatarChange}
        avatarUploading={avatarUploading}
        apiUrl={API_URL}
        onEditClick={() => setEditModalOpen(true)}
        onOpenBadgeModal={() => setBadgeModalOpen(true)}
        onViewPublicProfile={() => setPublicProfileOpen(true)}
      />

      {/* ── Atelier two-column body ── */}
      <div className="prof-atelier">

        {/* Main panel — tabs + content */}
        <main>
          <div className="prof-tab-bar">
            {CONTENT_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`prof-tab${activeTab === id ? ' prof-tab--active' : ''}`}
              >
                <Icon style={{ width: 13, height: 13 }} />
                {label}
              </button>
            ))}
          </div>

          <div key={activeTab} className="prof-tab-content">
            {activeTab === "achievements" && (
              <ProfileAchievements
                achievements={achievements}
                loading={achievementsLoading}
                error={achievementsError}
              />
            )}
            {activeTab === "progress" && (
              <ProfileProgress data={progressData} loading={progressLoading} error={progressError} />
            )}
            {activeTab === "simulation" && <SimulationHistory />}
          </div>
        </main>

        {/* Right rail — motivation blocks */}
        <aside className="prof-rail">
          <ProfileMotivation
            xpData={xpData}
            stats={progressData?.stats}
            achievements={achievements}
            profileData={profileData}
            onEditClick={() => setEditModalOpen(true)}
          />
        </aside>

      </div>

      {/* ── Modals ── */}
      <BadgeEquipModal
        isOpen={badgeModalOpen}
        achievements={achievements}
        equippedBadges={equippedBadges}
        onSave={handleEquipBadges}
        onClose={() => setBadgeModalOpen(false)}
      />

      {publicProfileOpen && (
        <PublicProfileModal
          userId={profileData.id}
          achievements={achievements}
          onClose={() => setPublicProfileOpen(false)}
        />
      )}

      {editModalOpen && (
        <ProfileEditModal
          profileData={profileData}
          onSave={handleSave}
          onClose={() => setEditModalOpen(false)}
        />
      )}
    </div>
  );
};

export default Profile;