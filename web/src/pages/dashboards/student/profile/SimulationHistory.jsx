// file path: web/src/pages/dashboards/student/profile/SimulationHistory.jsx

import { useState, useEffect } from "react";
import axios from "axios";
import { Gamepad2, ArrowRight, Clock, Lightbulb } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../../../constants/achievements";

const formatDuration = (seconds) => {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
};

const LOG_ITEMS = [
  "Time spent per deboning step",
  "Error count by type",
  "Accuracy score",
  "Session date and duration",
];

// ── Empty state ────────────────────────────────────────────────────────
const EmptyState = ({ navigate }) => (
  <div className="prof-sim-empty">
    <div className="prof-sim-icon">
      <Gamepad2 style={{ width: 24, height: 24, color: 'var(--color-fg-subtle)' }} />
    </div>
    <h3 className="prof-sim-title">Simulation History</h3>
    <p className="prof-sim-desc">
      Complete a simulation run to see your performance data logged here.
    </p>
    <button onClick={() => navigate("/student/simulator")} className="prof-sim-cta">
      Launch Simulator <ArrowRight style={{ width: 12, height: 12 }} />
    </button>
    <p className="prof-sim-log-eyebrow">What gets logged after a run</p>
    <ul className="prof-sim-log-list">
      {LOG_ITEMS.map(item => (
        <li key={item} className="prof-sim-log-item">
          <span className="prof-sim-log-dot" />
          {item}
        </li>
      ))}
    </ul>
  </div>
);

// ── Main ───────────────────────────────────────────────────────────────
const SimulationHistory = () => {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/api/student/attempts`)
      .then(res => setAttempts(res.data.attempts ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="prof-spinner"><div className="prof-spinner-ring" /></div>
  );

  if (error) return (
    <div className="prof-sim-empty">
      <div className="prof-sim-icon">
        <Gamepad2 style={{ width: 24, height: 24, color: 'var(--color-fg-subtle)' }} />
      </div>
      <h3 className="prof-sim-title">Failed to load history</h3>
      <p className="prof-sim-desc">Could not fetch simulation runs.</p>
    </div>
  );

  if (attempts.length === 0) return <EmptyState navigate={navigate} />;

  const best = Math.max(...attempts.map(a => a.score ?? 0));
  const avg  = Math.round(attempts.reduce((s, a) => s + (a.score ?? 0), 0) / attempts.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Summary strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid var(--color-hairline)', background: 'var(--color-surface)' }}>
        {[
          { label: 'Total Runs', value: attempts.length },
          { label: 'Best Score', value: `${best}%`      },
          { label: 'Avg Score',  value: `${avg}%`       },
        ].map(({ label, value }) => (
          <div key={label} className="prof-stat">
            <span className="prof-stat-val">{value}</span>
            <span className="prof-stat-label">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Attempt list ── */}
      <div style={{ border: '1px solid var(--color-hairline)', background: 'var(--color-surface)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--color-hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 500, color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)' }}>
            Run History ({attempts.length})
          </span>
          <button
            onClick={() => navigate("/student/simulator")}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', background: 'var(--color-fg)', color: 'var(--color-bg)',
              border: 'none', cursor: 'pointer', fontSize: 9,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              fontWeight: 700, fontFamily: 'var(--font-ui)',
            }}
          >
            New Run <ArrowRight style={{ width: 10, height: 10 }} />
          </button>
        </div>

        {/* Rows */}
        {attempts.map((a, i) => (
          <div
            key={a.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 20px',
              borderBottom: i < attempts.length - 1 ? '1px solid var(--color-hairline)' : 'none',
            }}
          >
            {/* Run number */}
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)', fontVariantNumeric: 'tabular-nums', width: 22, flexShrink: 0 }}>
              #{i + 1}
            </span>

            {/* Score */}
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-fg)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 52 }}>
              {a.score ?? '—'}%
            </span>

            {/* Status chip */}
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              padding: '2px 6px', fontFamily: 'var(--font-ui)', flexShrink: 0,
              background: a.completed ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'var(--color-surface-3)',
              color:      a.completed ? 'var(--color-accent)' : 'var(--color-fg-subtle)',
              border:     `1px solid ${a.completed ? 'var(--color-accent)' : 'var(--color-hairline)'}`,
            }}>
              {a.completed ? 'Complete' : 'Incomplete'}
            </span>

            {/* Duration + hints */}
            <div style={{ flex: 1, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)' }}>
                <Clock style={{ width: 10, height: 10 }} />
                {formatDuration(a.duration_seconds)}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)' }}>
                <Lightbulb style={{ width: 10, height: 10 }} />
                {a.hints_used ?? 0} hints
              </span>
            </div>

            {/* Date */}
            <span style={{ fontSize: 11, color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)', flexShrink: 0 }}>
              {formatDate(a.created_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SimulationHistory;
