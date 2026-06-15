// file path: web/src/pages/dashboards/student/Settings.jsx

import './Settings.css';
import { useState, useContext, useRef, useEffect } from "react";
import { Camera, LogOut, Loader2, Lock } from "lucide-react";
import { toast } from "react-hot-toast";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../../../context/AppContext";
import { ThemeContext } from "../../../context/ThemeContext";
import LogoutConfirmModal from "../components/modals/LogoutConfirmationModal";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const getAvatarUrl = (avatarPath) => {
  if (!avatarPath) return null;
  if (avatarPath.startsWith("http://") || avatarPath.startsWith("https://")) return avatarPath;
  return import.meta.env.DEV ? avatarPath : `${API_URL}${avatarPath}`;
};

const NAV_SECTIONS = [
  { id: "profile",    label: "Profile"    },
  { id: "appearance", label: "Appearance" },
  { id: "session",    label: "Session"    },
  { id: "security",  label: "Security"   },
];

const Settings = () => {
  const { user, token, refreshUser, logout } = useContext(AppContext);
  const { isDarkMode, toggleTheme }          = useContext(ThemeContext);
  const navigate = useNavigate();

  const [fullName,        setFullName]        = useState(user?.full_name || "");
  const [saving,          setSaving]          = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [imgError,        setImgError]        = useState(false);
  const [activeSection,   setActiveSection]   = useState("profile");
  const [logoutOpen,      setLogoutOpen]      = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving,        setPwSaving]        = useState(false);
  const [nameError,        setNameError]        = useState("");

  const fileInputRef  = useRef(null);
  const profileRef    = useRef(null);
  const appearanceRef = useRef(null);
  const sessionRef    = useRef(null);
  const securityRef   = useRef(null);

  const sectionRefs = { profile: profileRef, appearance: appearanceRef, session: sessionRef, security: securityRef };

  useEffect(() => { setImgError(false); }, [user?.avatar_url]);

  const scrollTo = (id) => {
    setActiveSection(id);
    sectionRefs[id].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) handleAvatarUpload(file);
    e.target.value = "";
  };

  const handleAvatarUpload = async (file) => {
    const formData = new FormData();
    formData.append("avatar", file);
    setAvatarUploading(true);
    try {
      await axios.post(`${API_URL}/api/profile/avatar`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshUser?.();
      toast.success("Avatar updated!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) { setNameError("Name cannot be empty"); return; }
    setNameError("");
    setSaving(true);
    try {
      await axios.patch(
        `${API_URL}/api/profile`,
        { full_name: fullName.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refreshUser?.();
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All password fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setPwSaving(true);
    try {
      await axios.put(
        `${API_URL}/api/profile/password`,
        { current_password: currentPassword, new_password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Password changed. Please sign in again.");
      logout();
      navigate("/signin");
    } catch (err) {
      const msg = err.response?.data?.error;
      if (msg === "Current password is incorrect.") {
        toast.error("Current password is incorrect");
      } else if (msg === "PASSWORD_POLICY") {
        const reqs = err.response?.data?.requirements || [];
        toast.error(`Password too weak: ${reqs.join(", ")}`);
      } else {
        toast.error(msg || "Failed to change password");
      }
    } finally {
      setPwSaving(false);
    }
  };

  const avatarSrc = getAvatarUrl(user?.avatar_url);
  const initials  = (user?.full_name || user?.email || "U")[0].toUpperCase();

  return (
    <div className="settings-page">

      {/* ── Must-change-password banner ── */}
      {user?.must_change_password && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 20px", background: "var(--color-accent, #e67e22)", color: "#fff", fontSize: "14px" }}>
          <Lock style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>Your account requires a password change. Please update your password in the Security section below before continuing.</span>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">Manage your account and preferences</p>
      </div>

      <div className="settings-layout">

        {/* ── Sidebar nav ── */}
        <nav className="settings-sidebar">
          {NAV_SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`settings-nav-link${activeSection === id ? " settings-nav-link--active" : ""}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* ── Section cards ── */}
        <div className="settings-content">

          {/* Profile */}
          <section ref={profileRef} id="profile" className="settings-section">
            <div className="settings-section-header">
              <p className="settings-section-eyebrow">Profile</p>
              <h2 className="settings-section-title">Profile Information</h2>
              <p className="settings-section-desc">Update your display name and avatar</p>
            </div>
            <form className="settings-section-body" onSubmit={e => { e.preventDefault(); handleSave(); }}>

              {/* Avatar */}
              <div className="settings-avatar-row">
                <div className="settings-avatar-wrap">
                  <div className="settings-avatar">
                    {avatarSrc && !imgError ? (
                      <img
                        src={avatarSrc}
                        alt="Avatar"
                        className="settings-avatar-img"
                        onError={() => setImgError(true)}
                      />
                    ) : (
                      <span className="settings-avatar-initials">{initials}</span>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    className="settings-avatar-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    aria-label="Change avatar"
                  >
                    {avatarUploading
                      ? <Loader2 className="settings-avatar-btn-icon settings-spin" />
                      : <Camera  className="settings-avatar-btn-icon" />
                    }
                  </button>
                </div>
                <p className="settings-avatar-hint">JPG, PNG, or WebP · Max 2 MB</p>
              </div>

              {/* Fields */}
              <div className="settings-fields">
                <div className="settings-field">
                  <label className="settings-label">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => { setFullName(e.target.value); if (nameError) setNameError(""); }}
                    className={`settings-input${nameError ? " settings-input--error" : ""}`}
                    placeholder="Your full name"
                  />
                  {nameError && <span className="settings-field-error">{nameError}</span>}
                </div>
                <div className="settings-field">
                  <label className="settings-label">Email Address</label>
                  <input
                    type="email"
                    defaultValue={user?.email || ""}
                    disabled
                    className="settings-input settings-input--disabled"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="settings-actions">
                <button
                  type="submit"
                  disabled={saving}
                  className="settings-btn-primary"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => { setFullName(user?.full_name || ""); setNameError(""); }}
                  className="settings-btn-ghost"
                >
                  Cancel
                </button>
              </div>

            </form>
          </section>

          {/* Appearance */}
          <section ref={appearanceRef} id="appearance" className="settings-section">
            <div className="settings-section-header">
              <p className="settings-section-eyebrow">Appearance</p>
              <h2 className="settings-section-title">Display</h2>
              <p className="settings-section-desc">Customize how the dashboard looks</p>
            </div>
            <div className="settings-section-body">
              <div className="settings-row">
                <div>
                  <p className="settings-row-label">Dark Mode</p>
                  <p className="settings-row-hint">Applies across the entire dashboard</p>
                </div>
                <button
                  role="switch"
                  aria-checked={isDarkMode}
                  onClick={toggleTheme}
                  className={`settings-toggle${isDarkMode ? " settings-toggle--on" : ""}`}
                >
                  <span className="settings-toggle-thumb" />
                </button>
              </div>
            </div>
          </section>

          {/* Session */}
          <section ref={sessionRef} id="session" className="settings-section">
            <div className="settings-section-header">
              <p className="settings-section-eyebrow">Session</p>
              <h2 className="settings-section-title">Active Session</h2>
              <p className="settings-section-desc">Manage your current session</p>
            </div>
            <div className="settings-section-body">
              <div className="settings-row">
                <div>
                  <p className="settings-row-label">Log out</p>
                  <p className="settings-row-hint">End your current session</p>
                </div>
                <button
                  onClick={() => setLogoutOpen(true)}
                  className="settings-btn-danger"
                >
                  <LogOut className="settings-btn-icon" />
                  Log Out
                </button>
              </div>
            </div>
          </section>

          {/* Security */}
          <section ref={securityRef} id="security" className="settings-section">
            <div className="settings-section-header">
              <p className="settings-section-eyebrow">Security</p>
              <h2 className="settings-section-title">Change Password</h2>
              <p className="settings-section-desc">Update your account password</p>
            </div>
            <form className="settings-section-body" onSubmit={e => { e.preventDefault(); handlePasswordChange(); }}>
              <div className="settings-fields settings-fields--single">
                <div className="settings-field">
                  <label className="settings-label">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="settings-input"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
                <div className="settings-field">
                  <label className="settings-label">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="settings-input"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
                <div className="settings-field">
                  <label className="settings-label">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="settings-input"
                    placeholder="••••••••"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="settings-actions">
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="settings-btn-primary"
                >
                  {pwSaving ? "Saving…" : "Change Password"}
                </button>
                <button
                  type="button"
                  onClick={() => { setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}
                  className="settings-btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>

        </div>
      </div>

      {/* ── Logout confirmation modal ── */}
      <LogoutConfirmModal
        isOpen={logoutOpen}
        onConfirm={() => { logout(); navigate("/signin"); }}
        onCancel={() => setLogoutOpen(false)}
      />

    </div>
  );
};

export default Settings;
