// file path: web/src/pages/dashboards/instructor/StudentProfileModal.jsx

import { useState, useEffect, useContext } from "react";
import axios from "axios";
import { AppContext } from "../../../context/AppContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const MODULE_LABELS = { 1: "Module 1", 2: "Module 2", 3: "Module 3", 4: "Module 4", 5: "Module 5" };

const formatDate = (ts) =>
  ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const formatDuration = (secs) => {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const formatPct = (val) =>
  val !== null && val !== undefined ? `${Math.round(val)}%` : "—";

const scoreClass = (score) => {
  if (!score && score !== 0) return "";
  if (score >= 75) return "good";
  if (score >= 60) return "avg";
  return "bad";
};

const getPerformanceLabel = (avg) => {
  if (!avg || avg === 0) return { label: "No activity", cls: "none" };
  if (avg >= 75) return { label: "Good",          cls: "pass" };
  if (avg >= 60) return { label: "Average",        cls: "prog" };
  return             { label: "Needs Attention", cls: "fail" };
};

const StudentProfileModal = ({ student, courseId, isPending, onClose, onAccept, onReject }) => {
  const { token } = useContext(AppContext);

  const [activeTab,       setActiveTab]       = useState("overview");
  const [quizProgress,    setQuizProgress]    = useState([]);
  const [lectureProgress, setLectureProgress] = useState([]);
  const [simData,         setSimData]         = useState(null);
  const [loading,         setLoading]         = useState(!isPending);
  const [expandedSession, setExpandedSession] = useState(null);

  useEffect(() => {
    if (isPending) return;
    setLoading(true);
    Promise.all([fetchQuizProgress(), fetchLectureProgress(), fetchSimData()])
      .finally(() => setLoading(false));
  }, [student.id]);

  const fetchQuizProgress = async () => {
    try {
      const res = await axios.get(
        `${API_URL}/api/courses/instructor/${courseId}/students/${student.id}/quiz-progress`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQuizProgress(res.data.progress);
    } catch { setQuizProgress([]); }
  };

  const fetchLectureProgress = async () => {
    try {
      const res = await axios.get(
        `${API_URL}/api/courses/instructor/${courseId}/students/${student.id}/module-progress`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLectureProgress(res.data.progress);
    } catch { setLectureProgress([]); }
  };

  const fetchSimData = async () => {
    try {
      const res = await axios.get(
        `${API_URL}/api/courses/instructor/${courseId}/students/${student.id}/simulation-progress`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSimData(res.data);
    } catch { setSimData(null); }
  };

  const perf         = getPerformanceLabel(student.avg_score);
  const initial      = (student.full_name?.[0] || student.email?.[0] || "?").toUpperCase();
  const enrolledDate = student.responded_at || student.enrolled_at;
  const agg          = simData?.aggregate;
  const sessions     = simData?.recent || [];

  const quizRows = quizProgress.length > 0
    ? quizProgress
    : [1, 2, 3, 4, 5].map(id => ({ module_id: id, attempt_count: 0, best_score: null, avg_percentage: null, ever_passed: false }));

  const lectureRows = lectureProgress.length > 0
    ? lectureProgress
    : [1, 2, 3, 4, 5].map(id => ({ module_id: id, completed: false, completed_at: null, last_accessed_at: null }));

  return (
    <div className="sm-modal-overlay" onClick={onClose}>
      <div className="sm-modal sm-modal--profile" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sm-modal-header">
          <div className="sm-detail-identity">
            <div className="sm-avatar sm-avatar--lg ink-muted">{initial}</div>
            <div>
              <h2 className="sm-modal-title font-outfit ink">{student.full_name || "—"}</h2>
              <p className="sm-modal-sub ink-muted">{student.email}</p>
              <p className="sm-modal-sub ink-faint">
                {isPending ? "Requested" : "Enrolled"}: {formatDate(enrolledDate)}
              </p>
            </div>
          </div>
          <button className="sm-modal-close ink-muted" onClick={onClose}>×</button>
        </div>

        {/* Tab strip (enrolled only) */}
        {!isPending && (
          <div className="sm-modal-tab-strip">
            <button
              className={`sm-modal-tab${activeTab === "overview" ? " active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            <button
              className={`sm-modal-tab${activeTab === "simulations" ? " active" : ""}`}
              onClick={() => setActiveTab("simulations")}
            >
              Simulations
            </button>
          </div>
        )}

        {/* Body */}
        <div className="sm-modal-body">

          {/* Pending: just accept / reject */}
          {isPending && (
            <div className="sm-modal-footer">
              <button className="sm-btn sm-btn--primary" onClick={onAccept}>Accept Student</button>
              <button className="sm-btn sm-btn--danger"  onClick={onReject}>Reject</button>
            </div>
          )}

          {/* Enrolled: loading */}
          {!isPending && loading && (
            <div className="sm-loading ink-muted">Loading…</div>
          )}

          {/* Enrolled: overview tab */}
          {!isPending && !loading && activeTab === "overview" && (
            <>
              {/* Aggregate stats */}
              <div className="sm-stat-grid" style={{ marginBottom: 28 }}>
                <div className="sm-stat-cell">
                  <span className="sm-stat-val ink">{student.total_attempts || 0}</span>
                  <span className="sm-stat-label ink-faint">Attempts</span>
                </div>
                <div className="sm-stat-cell">
                  <span className={`sm-stat-val sm-score--${scoreClass(student.avg_score)}`}>
                    {student.total_attempts > 0 ? `${Math.round(student.avg_score)}%` : "—"}
                  </span>
                  <span className="sm-stat-label ink-faint">Avg Score</span>
                </div>
                <div className="sm-stat-cell">
                  <span className="sm-stat-val ink">
                    <span className={`sm-badge sm-badge--${perf.cls}`}>{perf.label}</span>
                  </span>
                  <span className="sm-stat-label ink-faint">Performance</span>
                </div>
              </div>

              {/* Quiz progress */}
              <div className="sm-section">
                <h3 className="sm-section-head ink-faint">Quiz Progress</h3>
                <table className="sm-table sm-table--inner">
                  <thead>
                    <tr>
                      <th className="ink-faint">Module</th>
                      <th className="ink-faint sm-td-center">Attempts</th>
                      <th className="ink-faint sm-td-center">Best</th>
                      <th className="ink-faint sm-td-center">Avg</th>
                      <th className="ink-faint sm-td-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizRows.map(mod => {
                      const none = mod.attempt_count === 0;
                      return (
                        <tr key={mod.module_id}>
                          <td className="ink">{MODULE_LABELS[mod.module_id] || `Module ${mod.module_id}`}</td>
                          <td className="sm-td-center ink-muted">{mod.attempt_count}</td>
                          <td className="sm-td-center ink-muted">{none ? "—" : `${mod.best_score}/10`}</td>
                          <td className="sm-td-center ink-muted">{none ? "—" : formatPct(mod.avg_percentage)}</td>
                          <td className="sm-td-center">
                            {none
                              ? <span className="sm-badge sm-badge--none">Not attempted</span>
                              : mod.ever_passed
                                ? <span className="sm-badge sm-badge--pass">Passed</span>
                                : <span className="sm-badge sm-badge--fail">Not passed</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Lecture progress */}
              <div className="sm-section">
                <h3 className="sm-section-head ink-faint">Lecture Progress</h3>
                <table className="sm-table sm-table--inner">
                  <thead>
                    <tr>
                      <th className="ink-faint">Module</th>
                      <th className="ink-faint sm-td-center">Status</th>
                      <th className="ink-faint sm-td-center">Completed</th>
                      <th className="ink-faint sm-td-center">Last Accessed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lectureRows.map(mod => {
                      const statusLabel = mod.completed ? "Completed" : mod.last_accessed_at ? "In progress" : "Not started";
                      const statusCls   = mod.completed ? "done" : mod.last_accessed_at ? "prog" : "none";
                      return (
                        <tr key={mod.module_id}>
                          <td className="ink">{MODULE_LABELS[mod.module_id] || `Module ${mod.module_id}`}</td>
                          <td className="sm-td-center">
                            <span className={`sm-badge sm-badge--${statusCls}`}>{statusLabel}</span>
                          </td>
                          <td className="sm-td-center ink-muted">{formatDate(mod.completed_at)}</td>
                          <td className="sm-td-center ink-muted">{formatDate(mod.last_accessed_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Enrolled: simulations tab */}
          {!isPending && !loading && activeTab === "simulations" && (
            !simData ? (
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
                      {agg?.total > 0 ? `${Math.round(agg.best_score)}%` : "—"}
                    </span>
                    <span className="sm-stat-label ink-faint">Best Score</span>
                  </div>
                  <div className="sm-stat-cell">
                    <span className={`sm-stat-val sm-score--${scoreClass(agg?.avg_score)}`}>
                      {agg?.total > 0 ? `${Math.round(agg.avg_score)}%` : "—"}
                    </span>
                    <span className="sm-stat-label ink-faint">Avg Score</span>
                  </div>
                  <div className="sm-stat-cell">
                    <span className="sm-stat-val ink">{agg?.total_hints || 0}</span>
                    <span className="sm-stat-label ink-faint">Hints Used</span>
                  </div>
                </div>

                {/* Recent sessions */}
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
                              onClick={() => setExpandedSession(prev => prev === session.id ? null : session.id)}
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
            )
          )}

        </div>
      </div>
    </div>
  );
};

export default StudentProfileModal;
