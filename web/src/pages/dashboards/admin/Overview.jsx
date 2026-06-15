// file path: web/src/pages/dashboards/admin/Overview.jsx

import './Overview.css';
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import gsap from "gsap";
import { UserPlus, Clock, ShieldCheck, Activity, ArrowRight, LayoutDashboard } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Narrative sentence builders per action type
const ACTION_NARRATIVES = {
  'user.create':         (admin, target) => <><strong>{admin}</strong> created user <strong>{target}</strong></>,
  'user.update':         (admin, target) => <><strong>{admin}</strong> updated <strong>{target}</strong></>,
  'user.delete':         (admin, target) => <><strong>{admin}</strong> removed <strong>{target}</strong></>,
  'user.reset_password': (admin, target) => <><strong>{admin}</strong> reset password for <strong>{target}</strong></>,
};

const formatTime = (ts) => {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000)     return 'Just now';
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const buildNarrative = (log) => {
  const fn    = ACTION_NARRATIVES[log.action];
  const admin = log.admin_name  || 'System Admin';
  const target = log.target_name || 'a user';
  return fn ? fn(admin, target) : <><strong>{admin}</strong> performed an action on <strong>{target}</strong></>;
};

const QUICK_ACTIONS = [
  { icon: UserPlus,        label: 'Add User',         sub: 'Invite a new student or instructor', path: '/admin/dashboard/users' },
  { icon: Clock,           label: 'Pending Accounts', sub: 'Review accounts awaiting approval',  path: '/admin/dashboard/users' },
  { icon: ShieldCheck,     label: 'Manage Access',    sub: 'Edit roles and permissions',         path: '/admin/dashboard/users' },
  { icon: LayoutDashboard, label: 'Activity Logs',    sub: 'Full admin audit trail',             path: '/admin/dashboard/activity-logs' },
];

// ── Main Component ──────────────────────────────────────────────────────────
const Overview = () => {
  const contentRef  = useRef(null);
  const hasAnimated = useRef(false);
  const navigate    = useNavigate();

  const [stats,      setStats]      = useState({ total: 0, active: 0, instructors: 0, students: 0, pending: 0 });
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, logsRes] = await Promise.all([
          axios.get(`${API_URL}/api/users/stats`),
          axios.get(`${API_URL}/api/admin/activity-logs?limit=6`),
        ]);
        setStats(statsRes.data);
        setRecentLogs(logsRes.data.logs || []);
      } catch {
        // fail silently — show zeros/empty
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (contentRef.current && !loading && !hasAnimated.current) {
      hasAnimated.current = true;
      gsap.fromTo(contentRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--color-surface-3)] border-t-[color:var(--color-accent)] animate-spin" />
        <p className="text-[12px] uppercase tracking-[0.16em] ink-faint">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div ref={contentRef} className="px-8 lg:px-10 py-8 lg:py-10" style={{ opacity: 0 }}>

        {/* Header */}
        <header className="ov-ph">
          <div className="ov-ph-row">
            <h1 className="ov-ph-title">Admin <span className="it">Overview.</span></h1>
            <div className="ov-status">
              <span className="ov-status-dot" />
              <span className="ov-status-label">System online</span>
            </div>
          </div>
        </header>

        {/* Asymmetric Stats */}
        <div className="ov-stats">
          <div className="ov-stat-hero">
            <span className="ov-stat-hero-val">{stats.total ?? 0}</span>
            <span className="ov-stat-hero-label">Total Users</span>
          </div>
          <div className="ov-stat-cluster">
            {[
              { label: 'Active',       value: stats.active      },
              { label: 'Students',     value: stats.students    },
              { label: 'Instructors',  value: stats.instructors },
              { label: 'Pending',      value: stats.pending     },
            ].map(s => (
              <div key={s.label} className="ov-stat-item">
                <span className="ov-stat-item-val">{s.value ?? 0}</span>
                <span className="ov-stat-item-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <section className="ov-section">
          <div className="ov-section-head">
            <span className="ov-section-title">Quick Actions</span>
          </div>
          <div className="ov-actions">
            {QUICK_ACTIONS.map(({ icon: Icon, label, sub, path }) => (
              <button
                key={label}
                className="ov-action-item"
                onClick={() => navigate(path)}
              >
                <Icon size={14} className="ov-action-icon" />
                <div className="ov-action-text">
                  <span className="ov-action-label">{label}</span>
                  <span className="ov-action-sub">{sub}</span>
                </div>
                <ArrowRight size={12} className="ov-action-arrow" />
              </button>
            ))}
          </div>
        </section>

        {/* Recent Activity — narrative timeline */}
        <section className="ov-section">
          <div className="ov-section-head">
            <span className="ov-section-title">Recent Activity</span>
            <button
              className="ov-view-all"
              onClick={() => navigate('/admin/dashboard/activity-logs')}
            >
              View all <ArrowRight size={11} />
            </button>
          </div>

          {recentLogs.length === 0 ? (
            <div className="ov-empty">
              <Activity size={28} />
              <p>No admin actions recorded yet.</p>
            </div>
          ) : (
            <div className="ov-timeline">
              {recentLogs.map((log, i) => (
                <div key={log.id} className="ov-timeline-item">
                  <div className="ov-timeline-spine">
                    <span className="ov-timeline-dot" />
                    {i < recentLogs.length - 1 && <span className="ov-timeline-line" />}
                  </div>
                  <div className="ov-timeline-body">
                    <span className="ov-timeline-text">{buildNarrative(log)}</span>
                    <span
                      className="ov-timeline-time"
                      title={new Date(log.created_at).toLocaleString()}
                    >
                      {formatTime(log.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
};

export default Overview;
