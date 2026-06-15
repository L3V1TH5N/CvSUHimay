// file path: web/src/pages/dashboards/student/profile/ProfileEditModal.jsx
// Edit-profile modal + inline form — merged into one file.

import { useState, useEffect } from "react";
import { Check, X, ChevronDown } from "lucide-react";
import { formatDateInput } from "../../../../utils/format";

// ── Constants ──────────────────────────────────────────────────────────

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const DEPARTMENTS = ["FASD", "ITD", "TED", "MD"];

// ── Field sub-components ───────────────────────────────────────────────

const FieldLabel = ({ children }) => (
  <label className="prof-field-label">{children}</label>
);

const FieldError = ({ msg }) => msg
  ? <p className="prof-field-error">{msg}</p>
  : null;

const TextInput = ({ label, value, onChange, placeholder, error }) => (
  <div>
    {label && <FieldLabel>{label}</FieldLabel>}
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`prof-input${error ? ' prof-input--error' : ''}`}
    />
    <FieldError msg={error} />
  </div>
);

const TextareaInput = ({ label, value, onChange, placeholder, error }) => (
  <div>
    {label && <FieldLabel>{label}</FieldLabel>}
    <textarea
      rows={3}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`prof-input prof-textarea${error ? ' prof-input--error' : ''}`}
    />
    <FieldError msg={error} />
  </div>
);

const UsernameInput = ({ value, onChange, error }) => (
  <div>
    <FieldLabel>Username</FieldLabel>
    <div className={`prof-input-prefix${error ? ' prof-input-prefix--error' : ''}`}>
      <span className="prof-input-prefix-at">@</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="yourname"
        maxLength={20}
      />
    </div>
    {error
      ? <FieldError msg={error} />
      : <p className="prof-field-hint">3–20 chars · letters, numbers, underscores</p>
    }
  </div>
);

const PhoneInput = ({ value, onChange, error }) => (
  <div>
    <FieldLabel>Phone</FieldLabel>
    <input
      type="tel"
      inputMode="numeric"
      value={value}
      onChange={e => onChange(e.target.value.replace(/\D/g, ""))}
      placeholder="Phone number"
      className={`prof-input${error ? ' prof-input--error' : ''}`}
    />
    <FieldError msg={error} />
  </div>
);

const DateInput = ({ label, value, onChange, error }) => (
  <div>
    {label && <FieldLabel>{label}</FieldLabel>}
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`prof-input${error ? ' prof-input--error' : ''}`}
    />
    <FieldError msg={error} />
  </div>
);

const SelectInput = ({ label, value, onChange, options, placeholder, error }) => (
  <div>
    {label && <FieldLabel>{label}</FieldLabel>}
    <div className="prof-select-wrap">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`prof-input prof-select${error ? ' prof-input--error' : ''}`}
      >
        <option value="">{placeholder || "Select..."}</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <ChevronDown className="prof-select-icon" style={{ width: 13, height: 13 }} />
    </div>
    <FieldError msg={error} />
  </div>
);

const Section = ({ title, children }) => (
  <div className="prof-form-fields">
    <p className="prof-form-section-title">{title}</p>
    {children}
  </div>
);

// ── Completeness tracking ──────────────────────────────────────────────

const COMPLETENESS_FIELDS = [
  { key: "full_name",     label: "Full name"  },
  { key: "username",      label: "Username"   },
  { key: "bio",           label: "Bio"        },
  { key: "phone",         label: "Phone"      },
  { key: "date_of_birth", label: "Birthday"   },
  { key: "student_id",    label: "Student ID" },
  { key: "year_level",    label: "Year level" },
];

// ── Form (internal) ────────────────────────────────────────────────────

const ProfileEditForm = ({ profileData, onSave, onCancel }) => {
  const [form,        setForm]        = useState({});
  const [saving,      setSaving]      = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // Initialize form from profileData when component mounts
  useEffect(() => {
    setForm({
      username:      profileData.username      || "",
      full_name:     profileData.full_name     || "",
      bio:           profileData.bio           || "",
      phone:         profileData.phone         || "",
      date_of_birth: profileData.date_of_birth || "",
      address:       profileData.address       || "",
      department:    profileData.department    || "",
      year_level:    profileData.year_level    || "",
      student_id:    profileData.student_id    || "",
    });
  }, []);

  // Clear the field error when the user edits a field
  const set = (key) => (val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    if (fieldErrors[key]) setFieldErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleSave = async () => {
    setSaving(true);
    setFieldErrors({});
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])
      );
      await onSave(payload);
    } catch (error) {
      // Extract per-field validation issues from the backend's structured 400 response
      const issues = error.response?.data?.issues;
      if (issues?.length) {
        const errs = {};
        issues.forEach(({ path, message }) => { errs[path] = message; });
        setFieldErrors(errs);
      }
    } finally {
      setSaving(false);
    }
  };

  const filled              = COMPLETENESS_FIELDS.filter(f => form[f.key]?.trim?.()).length;
  const completenessPercent = Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
  const firstMissingField   = COMPLETENESS_FIELDS.find(f => !form[f.key]?.trim?.());

  return (
    <div className="prof-modal" style={{ overflowY: 'hidden' }}>

      {/* Header */}
      <div className="prof-modal-head">
        <div>
          <div className="prof-modal-title">Editing Profile</div>
          <div className="prof-modal-sub">Changes apply immediately after saving</div>
        </div>
        <button onClick={onCancel} className="prof-modal-close">
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Form body */}
      <div className="prof-form-body" style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>

        {/* Completeness nudge */}
        {completenessPercent < 100 && (
          <div className="prof-complete-nudge">
            <div className="prof-complete-nudge-head">
              <span className="prof-complete-nudge-title">Profile {completenessPercent}% complete</span>
              {firstMissingField && (
                <span className="prof-complete-nudge-hint">Add {firstMissingField.label} to improve</span>
              )}
            </div>
            <div className="prof-complete-nudge-track">
              <div className="prof-complete-nudge-fill" style={{ width: `${completenessPercent}%` }} />
            </div>
          </div>
        )}

        {/* Identity */}
        <Section title="Identity">
          <div className="prof-form-grid">
            <TextInput
              label="Full name"
              value={form.full_name || ""}
              onChange={set("full_name")}
              placeholder="Your full name"
              error={fieldErrors.full_name}
            />
            <UsernameInput
              value={form.username || ""}
              onChange={set("username")}
              error={fieldErrors.username}
            />
          </div>
          <TextareaInput
            label="Bio"
            value={form.bio || ""}
            onChange={set("bio")}
            placeholder="Write a short bio…"
            error={fieldErrors.bio}
          />
        </Section>

        <hr className="prof-form-divider" />

        {/* Contact */}
        <Section title="Contact">
          <div className="prof-form-grid">
            <PhoneInput
              value={form.phone || ""}
              onChange={set("phone")}
              error={fieldErrors.phone}
            />
            <DateInput
              label="Birthday"
              value={formatDateInput(form.date_of_birth)}
              onChange={set("date_of_birth")}
              error={fieldErrors.date_of_birth}
            />
          </div>
          <TextInput
            label="Address"
            value={form.address || ""}
            onChange={set("address")}
            placeholder="Your address"
            error={fieldErrors.address}
          />
        </Section>

        {/* Academic — students only */}
        {profileData.role === "student" && (
          <>
            <hr className="prof-form-divider" />
            <Section title="Academic">
              <div className="prof-form-grid">
                <TextInput
                  label="Student ID"
                  value={form.student_id || ""}
                  onChange={set("student_id")}
                  placeholder="e.g., 202100001"
                  error={fieldErrors.student_id}
                />
                <SelectInput
                  label="Year Level"
                  value={form.year_level || ""}
                  onChange={set("year_level")}
                  options={YEAR_LEVELS}
                  placeholder="Select year level"
                  error={fieldErrors.year_level}
                />
              </div>
              <SelectInput
                label="Department"
                value={form.department || ""}
                onChange={set("department")}
                options={DEPARTMENTS}
                placeholder="Select department"
                error={fieldErrors.department}
              />
            </Section>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="prof-modal-foot">
        <button onClick={onCancel} className="prof-modal-cancel">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="prof-modal-save">
          {saving ? (
            <>
              <div className="prof-spinner-ring" style={{ width: 14, height: 14, borderWidth: 2 }} />
              Saving…
            </>
          ) : (
            <>
              <Check style={{ width: 13, height: 13 }} />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// ── Modal shell ────────────────────────────────────────────────────────

const ProfileEditModal = ({ profileData, onSave, onClose }) => {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="prof-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <ProfileEditForm profileData={profileData} onSave={onSave} onCancel={onClose} />
    </div>
  );
};

export default ProfileEditModal;
