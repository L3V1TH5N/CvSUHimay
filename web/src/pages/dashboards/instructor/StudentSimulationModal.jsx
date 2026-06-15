// file path: web/src/pages/dashboards/instructor/StudentSimulationModal.jsx

import { useState, useEffect, useContext } from "react";
import axios from "axios";
import { AppContext } from "../../../context/AppContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const formatDate = (ts) =>
  ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const formatDuration = (secs) => {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const scoreClass = (score) => {
  if (!score && score !== 0) return "";
  if (score >= 75) return "good";
  if (score >= 60) return "avg";
  return "bad";
};

const StudentSimulationModal = ({ student, courseId, onClose }) => {
  const { token } = useContext(AppContext);

  const [simData,          setSimData]          = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [expandedSession,  setExpandedSession]  = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get(
          `${API_URL}/api/courses/instructor/${courseId}/students/${student.id}/simulation-progress`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSimData(res.data);
      } catch {
        setSimData(null);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [student.id, courseId]);

  const agg      = simData?.aggregate;
  const sessions = simData?.recent || [];

  const toggleSession = (id) =>
    setExpandedSession(prev => (prev === id ? null : id));

  return (
    <div className="sm-modal-overlay" onClick={onClose}>
      <div className="sm-modal sm-modal--sim" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sm-modal-header">
          <div>
            <h2 className="sm-modal-title font-outfit ink">
              Simulation <span className="it">Performance.</span>
            </h2>
            <p className="sm-modal-sub ink-muted">{student.full_name || student.email}</p>
          </div>
          <button className="sm-modal-close ink-muted" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className="sm-modal-body">
          {loading ? (
            <div className="sm-loading ink-muted">Loading simulation data…</div>
          ) : !simData ? (
            <div className="sm-empty">
              <p className="sm-empty-title ink">No simulation data.</p>
              <p className="sm-empty-sub ink-muted">This student hasn't attempted the simulator yet.</p>
            </div>
          ) : (
            <>
              {/* Aggregate stats */}
              <div className="sm-stat-grid" style={{ marginBottom: 28 }}>
                <div className="sm-stat-cell">
                  <span className="sm-stat-val ink">{agg?.total || 0}</span>
                  <span className="sm-stat-label ink-faint">Attempts</span>
                </div>
                <div className="sm-stat-cell">
                  <span className={`sm-stat-val sm-score--${scoreClass(agg?.best_score)}`}>
                    {Math.round(agg?.best_score) || 0}%
                  </span>
                  <span className="sm-stat-label ink-faint">Best Score</span>
                </div>
                <div className="sm-stat-cell">
                  <span className={`sm-stat-val sm-score--${scoreClass(agg?.avg_score)}`}>
                    {Math.round(agg?.avg_score) || 0}%
                  </span>
                  <span className="sm-stat-label ink-faint">Avg Score</span>
                </div>
                <div className="sm-stat-cell">
                  <span className="sm-stat-val ink">{agg?.total_hints || 0}</span>
                  <span className="sm-stat-label ink-faint">Hints Used</span>
                </div>
              </div>

              {/* Sessions */}
              {sessions.length > 0 ? (
                <div className="sm-section">
                  <h3 className="sm-section-head ink-faint">Recent Sessions</h3>
                  <div className="sm-sessions">
                    {sessions.map(session => {
                      const expanded = expandedSession === session.id;
                      return (
                        <div key={session.id} className="sm-session">
                          <button
                            className="sm-session-hdr"
                            onClick={() => toggleSession(session.id)}
                          >
                            <div className="sm-session-score-col">
                              <span className={`sm-score--${scoreClass(session.score)}`} style={{ fontSize: 16, fontWeight: 700 }}>
                                {session.score ?? "—"}%
                              </span>
                            </div>
                            <div className="sm-session-meta">
                              <span className="sm-session-date ink">{formatDate(session.created_at)}</span>
                              <span className="sm-session-detail ink-muted">
                                {formatDuration(session.duration_seconds)} · {session.hints_used} hint{session.hints_used !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <span className="sm-session-chevron ink-faint">{expanded ? "▲" : "▼"}</span>
                          </button>

                          {expanded && (
                            <div className="sm-session-body">
                              <div className="sm-session-row">
                                <span className="sm-session-key ink-faint">Score</span>
                                <span className={`sm-session-row-val sm-score--${scoreClass(session.score)}`}>
                                  {session.score ?? "—"}%
                                </span>
                              </div>
                              <div className="sm-session-row">
                                <span className="sm-session-key ink-faint">Duration</span>
                                <span className="sm-session-row-val ink">{formatDuration(session.duration_seconds)}</span>
                              </div>
                              <div className="sm-session-row">
                                <span className="sm-session-key ink-faint">Hints Used</span>
                                <span className="sm-session-row-val ink">{session.hints_used}</span>
                              </div>
                              <div className="sm-session-row">
                                <span className="sm-session-key ink-faint">Date</span>
                                <span className="sm-session-row-val ink">{formatDate(session.created_at)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="sm-empty">
                  <p className="sm-empty-title ink">No sessions recorded.</p>
                  <p className="sm-empty-sub ink-muted">Session data will appear once the student completes a run.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentSimulationModal;
