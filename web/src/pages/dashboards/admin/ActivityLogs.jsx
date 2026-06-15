// file path: web/src/pages/dashboards/admin/ActivityLogs.jsx

import './ActivityLogs.css';
import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import gsap from "gsap";
import { Activity } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const ACTION_LABELS = {
  'user.create':        'User Created',
  'user.update':        'User Updated',
  'user.delete':        'User Deleted',
  'user.reset_password':'Password Reset',
};

const ACTION_OPTIONS = [
  { value: '',                    label: 'All Actions'    },
  { value: 'user.create',         label: 'User Created'   },
  { value: 'user.update',         label: 'User Updated'   },
  { value: 'user.delete',         label: 'User Deleted'   },
  { value: 'user.reset_password', label: 'Password Reset' },
];

const formatTime = (ts) => {
  const d    = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000)     return 'Just now';
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDetails = (action, details) => {
  if (!details) return '—';
  try {
    const d = typeof details === 'string' ? JSON.parse(details) : details;
    if (action === 'user.create') return `Role: ${d.role ?? '—'}`;
    if (action === 'user.update' && d.changes) {
      return Object.entries(d.changes)
        .map(([field, { from, to }]) => `${field}: ${from ?? '—'} → ${to ?? '—'}`)
        .join(' · ') || '—';
    }
    if (action === 'user.delete') return `Was ${d.role ?? '—'}`;
  } catch {}
  return '—';
};

const ActionBadge = ({ action }) => (
  <span className={`al-badge al-badge--${(action || '').replace('.', '-')}`}>
    {ACTION_LABELS[action] || action}
  </span>
);

// ── Main Component ──────────────────────────────────────────────────────────
const ActivityLogs = () => {
  const contentRef  = useRef(null);
  const hasAnimated = useRef(false);

  const [logs,         setLogs]         = useState([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const LIMIT = 20;

  useEffect(() => {
    if (contentRef.current && !loading && !hasAnimated.current) {
      hasAnimated.current = true;
      gsap.fromTo(contentRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
    }
  }, [loading]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (actionFilter) params.set('action', actionFilter);
      const { data } = await axios.get(`${API_URL}/api/admin/activity-logs?${params}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(1); },  [actionFilter]);

  const totalPages = Math.ceil(total / LIMIT);
  const countLabel = `${total} event${total !== 1 ? 's' : ''}`;

  if (loading && logs.length === 0) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--color-surface-3)] border-t-[color:var(--color-accent)] animate-spin" />
        <p className="text-[12px] uppercase tracking-[0.16em] ink-faint">Loading logs…</p>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div ref={contentRef} className="px-8 lg:px-10 py-8 lg:py-10" style={{ opacity: 0 }}>

        {/* Header */}
        <header className="al-ph">
          <h1 className="al-ph-title">Activity <span className="it">Logs.</span></h1>
        </header>

        {/* Controls */}
        <div className="al-controls">
          <select
            className="al-action-select"
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
          >
            {ACTION_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <span className="al-count-label">{countLabel}</span>
        </div>

        {/* Table / empty */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <div className="w-6 h-6 rounded-full border-2 border-[color:var(--color-surface-3)] border-t-[color:var(--color-accent)] animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="al-empty">
            <div className="al-empty-icon"><Activity size={34} /></div>
            <p className="al-empty-title">No activity yet.</p>
            <p className="al-empty-sub">
              {actionFilter
                ? `No "${ACTION_LABELS[actionFilter]}" events recorded.`
                : 'Admin actions will appear here once performed.'}
            </p>
          </div>
        ) : (
          <div className="al-table-wrap">
            <table className="al-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }} className="ink-faint">#</th>
                  <th className="al-th-left ink-faint">Admin</th>
                  <th className="ink-faint">Action</th>
                  <th className="al-th-left ink-faint">Target</th>
                  <th className="al-th-left ink-faint">Details</th>
                  <th className="ink-faint">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr key={log.id}>
                    <td className="al-td-num ink-faint">
                      {(page - 1) * LIMIT + index + 1}
                    </td>
                    <td>
                      <span className="al-name ink">{log.admin_name}</span>
                    </td>
                    <td className="al-td-center">
                      <ActionBadge action={log.action} />
                    </td>
                    <td>
                      <span className="al-name ink-muted">{log.target_name || '—'}</span>
                    </td>
                    <td className="al-td-details ink-muted">
                      {formatDetails(log.action, log.details)}
                    </td>
                    <td
                      className="al-td-center al-td-time ink-muted"
                      title={new Date(log.created_at).toLocaleString()}
                    >
                      {formatTime(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="al-pagination">
            <span className="al-pagination-info">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </span>
            <div className="al-pagination-btns">
              <button className="al-pagination-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                Prev
              </button>
              <button className="al-pagination-btn"
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

export default ActivityLogs;
