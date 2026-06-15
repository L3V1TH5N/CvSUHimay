// file path: web/src/pages/dashboards/admin/UserManagement.jsx

import './UserManagement.css';
import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import gsap from "gsap";
import { Users, GraduationCap, UserCheck, Clock, Edit, Trash2, Plus, Key, X, SearchX } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// ── Edit Modal ──────────────────────────────────────────────────────────────
const EditModal = ({ user, onClose, onSave }) => {
  const [form, setForm] = useState({ email: user.email, full_name: user.full_name || '', role: user.role });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/users/${user.id}`, form);
      toast.success('User updated');
      onSave();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="um-modal-backdrop" onClick={onClose} />
      <div className="um-modal">
        <div className="um-modal-header">
          <span className="um-modal-title">Edit User</span>
          <button className="um-modal-close" onClick={onClose} aria-label="Close"><X size={14} /></button>
        </div>
        <div className="um-modal-body">
          <div className="um-modal-field">
            <label className="um-modal-label">Full Name</label>
            <input type="text" value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
              className="um-modal-input" />
          </div>
          <div className="um-modal-field">
            <label className="um-modal-label">Email</label>
            <input type="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="um-modal-input" />
          </div>
          <div className="um-modal-field" style={{ marginBottom: 0 }}>
            <label className="um-modal-label">Role</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
              className="um-modal-input">
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="um-modal-footer">
          <button className="um-modal-btn" onClick={onClose}>Cancel</button>
          <button className="um-modal-btn um-modal-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
};

// ── Add User Modal ──────────────────────────────────────────────────────────
const AddUserModal = ({ onClose, onSave }) => {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'student' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.email || !form.password) { toast.error('Email and password required'); return; }
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/users`, form);
      toast.success('User created');
      onSave();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="um-modal-backdrop" onClick={onClose} />
      <div className="um-modal">
        <div className="um-modal-header">
          <span className="um-modal-title">Add User</span>
          <button className="um-modal-close" onClick={onClose} aria-label="Close"><X size={14} /></button>
        </div>
        <div className="um-modal-body">
          <div className="um-modal-field">
            <label className="um-modal-label">Full Name</label>
            <input type="text" value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
              className="um-modal-input" placeholder="Juan dela Cruz" />
          </div>
          <div className="um-modal-field">
            <label className="um-modal-label">Email</label>
            <input type="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="um-modal-input" placeholder="juan@example.com" />
          </div>
          <div className="um-modal-field">
            <label className="um-modal-label">Password</label>
            <input type="password" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="um-modal-input" />
          </div>
          <div className="um-modal-field" style={{ marginBottom: 0 }}>
            <label className="um-modal-label">Role</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
              className="um-modal-input">
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="um-modal-footer">
          <button className="um-modal-btn" onClick={onClose}>Cancel</button>
          <button className="um-modal-btn um-modal-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </div>
    </>
  );
};

// ── Temp Password Modal ─────────────────────────────────────────────────────
const TempPasswordModal = ({ password, onClose }) => (
  <>
    <div className="um-modal-backdrop" onClick={onClose} />
    <div className="um-modal um-modal--sm">
      <div className="um-modal-header">
        <span className="um-modal-title">Temporary Password</span>
        <button className="um-modal-close" onClick={onClose} aria-label="Close"><X size={14} /></button>
      </div>
      <div className="um-modal-body um-modal-body--center">
        <p className="um-modal-hint">Share with user — they must change it on next login.</p>
        <div className="um-temp-password">{password}</div>
      </div>
      <div className="um-modal-footer">
        <button className="um-modal-btn um-modal-btn--primary" onClick={onClose}>Done</button>
      </div>
    </div>
  </>
);

// ── Status Badge ────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map    = { active: 'um-badge--active', pending_approval: 'um-badge--pending', rejected: 'um-badge--rejected', suspended: 'um-badge--suspended' };
  const labels = { active: 'Active', pending_approval: 'Pending', rejected: 'Rejected', suspended: 'Suspended' };
  return <span className={`um-badge ${map[status] || 'um-badge--active'}`}>{labels[status] || status}</span>;
};

// ── Main Component ──────────────────────────────────────────────────────────
const UserManagement = () => {
  const contentRef = useRef(null);

  const [tab,          setTab]          = useState('students');
  const [users,        setUsers]        = useState([]);
  const [stats,        setStats]        = useState({ total: 0, active: 0, instructors: 0, students: 0, pending: 0 });
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editUser,     setEditUser]     = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tempPassword, setTempPassword] = useState(null);

  const LIMIT = 20;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (contentRef.current && !loadingUsers && !hasAnimated.current) {
      hasAnimated.current = true;
      gsap.fromTo(contentRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
    }
  }, [loadingUsers]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/users/stats`);
      setStats(data);
    } catch {}
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      params.set('role', tab === 'students' ? 'student' : 'instructor');
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      const { data } = await axios.get(`${API_URL}/api/users?${params}`);
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [page, tab, filterStatus, searchTerm]);

  useEffect(() => { fetchStats(); },  [fetchStats]);
  useEffect(() => { fetchUsers(); },  [fetchUsers]);
  useEffect(() => { setPage(1); },    [tab, filterStatus, searchTerm]);

  const refresh = () => { fetchUsers(); fetchStats(); };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete ${user.full_name || user.email}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_URL}/api/users/${user.id}`);
      toast.success('User deleted');
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Delete failed');
    }
  };

  const handleResetPassword = async (user) => {
    if (!window.confirm(`Reset password for ${user.full_name || user.email}?`)) return;
    try {
      const { data } = await axios.post(`${API_URL}/api/users/${user.id}/reset-password`);
      setTempPassword(data.temporary_password);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Reset failed');
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  const getInitials = (name, email) => {
    const str = name || email || 'U';
    return str.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const countLabel = searchTerm
    ? `Showing ${users.length} of ${total}`
    : `${total} ${tab === 'students' ? 'student' : 'instructor'}${total !== 1 ? 's' : ''}`;

  if (loadingUsers && users.length === 0) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--color-surface-3)] border-t-[color:var(--color-accent)] animate-spin" />
        <p className="text-[12px] uppercase tracking-[0.16em] ink-faint">Loading users…</p>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {editUser     && <EditModal user={editUser} onClose={() => setEditUser(null)} onSave={refresh} />}
      {showAddModal && <AddUserModal onClose={() => setShowAddModal(false)} onSave={refresh} />}
      {tempPassword && <TempPasswordModal password={tempPassword} onClose={() => setTempPassword(null)} />}

      <div ref={contentRef} className="px-8 lg:px-10 py-8 lg:py-10" style={{ opacity: 0 }}>

        {/* Page header */}
        <header className="um-ph">
          <h1 className="um-ph-title">User <span className="it">Management.</span></h1>
          <button className="um-create-btn" onClick={() => setShowAddModal(true)}>
            <Plus size={13} /> Add User
          </button>
        </header>

        {/* Controls row */}
        <div className="um-controls">
          <div className="um-tab-rail">
            {[
              { key: 'students',    label: 'Students'    },
              { key: 'instructors', label: 'Instructors' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`um-tab-pill${tab === key ? ' active' : ''}`}
                onClick={() => { setTab(key); setSearchTerm(''); setFilterStatus('all'); }}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="um-count-label">{countLabel}</span>

          <select
            className="um-status-select"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending_approval">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>

          <input
            className="um-search-bar"
            type="text"
            placeholder="Search by name or email…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Table / empty */}
        {loadingUsers ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <div className="w-6 h-6 rounded-full border-2 border-[color:var(--color-surface-3)] border-t-[color:var(--color-accent)] animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="um-empty">
            <div className="um-empty-icon">
              {searchTerm ? <SearchX size={34} /> : <Users size={34} />}
            </div>
            <p className="um-empty-title">
              {searchTerm ? 'No results found.' : `No ${tab} yet.`}
            </p>
            <p className="um-empty-sub">
              {searchTerm
                ? `No ${tab} match "${searchTerm}".`
                : `${tab === 'students' ? 'Students' : 'Instructors'} will appear here once they register.`}
            </p>
          </div>
        ) : (
          <div className="um-table-wrap">
            <table className="um-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }} className="ink-faint">#</th>
                  <th className="um-th-name ink-faint">User</th>
                  <th className="ink-faint">Status</th>
                  <th className="ink-faint">Activity</th>
                  <th className="ink-faint">Last Login</th>
                  <th className="ink-faint">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, index) => (
                  <tr key={u.id}>
                    <td className="ink-faint" style={{ fontSize: '12px', textAlign: 'center' }}>
                      {(page - 1) * LIMIT + index + 1}
                    </td>
                    <td>
                      <div className="um-user-cell">
                        <div className="um-avatar">{getInitials(u.full_name, u.email)}</div>
                        <div>
                          <div className="um-user-name">{u.full_name || '—'}</div>
                          <div className="um-user-email">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="um-td-center">
                      <StatusBadge status={u.account_status} />
                    </td>
                    <td className="um-td-center um-td-muted">
                      {u.role === 'instructor'
                        ? `${u.course_count} course${u.course_count !== 1 ? 's' : ''}`
                        : `${u.enrolled_course_count} enrolled`}
                    </td>
                    <td className="um-td-center um-td-muted um-td-date">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="um-td-center">
                      <div className="um-actions">
                        <button className="um-action-btn" onClick={() => setEditUser(u)} title="Edit">
                          <Edit size={13} />
                        </button>
                        <button className="um-action-btn" onClick={() => handleResetPassword(u)} title="Reset password">
                          <Key size={13} />
                        </button>
                        <button className="um-action-btn um-action-btn--danger" onClick={() => handleDelete(u)} title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="um-pagination">
            <span className="um-pagination-info">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </span>
            <div className="um-pagination-btns">
              <button className="um-pagination-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                Prev
              </button>
              <button className="um-pagination-btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default UserManagement;
