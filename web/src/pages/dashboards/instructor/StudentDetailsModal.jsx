// file path: web/src/pages/dashboards/instructor/StudentDetailsModal.jsx

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
  if (avg >= 75) return { label: "Good",            cls: "pass" };
  if (avg >= 60) return { label: "Average",         cls: "prog" };
  return             { label: "Needs Attention",   cls: "fail" };
};

const StudentDetailsModal = ({ student, courseId, isPending, onClose, onAccept, onReject }) => {
  const { token } = useContext(AppContext);

  const [quizProgress,    setQuizProgress]    = useState([]);
  const [lectureProgress, setLectureProgress] = useState([]);
  const [simProgress,     setSimProgress]     = useState(null);
  const [progressLoading, setProgressLoading] = useState(!isPending);

  useEffect(() => {
    if (isPending) return;
    setProgressLoading(true);
    Promise.all([fetchQuizProgress(), fetchLectureProgress(), fetchSimProgress()])
      .finally(() => setProgressLoading(false));
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

  const fetchSimProgress = async () => {
    try {
      const res = await axios.get(
        `${API_URL}/api/courses/instructor/${courseId}/students/${student.id}/simulation-progress`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSimProgress(res.data);
    } catch { setSimProgress(null); }
  };

  const perf    = getPerformanceLabel(student.avg_score);
  const initial = (student.full_name?.[0] || student.email?.[0] || "?").toUpperCase();
  const enrolledDate = student.responded_at || student.enrolled_at;

  const quizRows = quizProgress.length > 0
    ? quizProgress
    : [1, 2, 3, 4, 5].map(id => ({ module_id: id, attempt_count: 0, best_score: null, avg_percentage: null, ever_passed: false }));

  const lectureRows = lectureProgress.length > 0
    ? lectureProgress
    : [1, 2, 3, 4, 5].map(id => ({ module_id: id, completed: false, completed_at: null, last_accessed_at: null }));

  return (
    <div className="sm-modal-overlay" onClick={onClose}>
      <div className="sm-modal sm-modal--detail" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sm-modal-header">
          <div className="sm-detail-identity">
            <div className="sm-avatar sm-avatar--lg ink-muted">{initial}</div>
            <div>
              <h2 className="sm-modal-title font-outfit ink">
                {student.full_name || "—"}
              </h2>
              <p className="sm-modal-sub ink-muted">{student.email}</p>
              <p className="sm-modal-sub ink-faint">
                {isPending ? "Requested" : "Enrolled"}: {formatDate(enrolledDate)}
              </p>
            </div>
          </div>
          <button className="sm-modal-close ink-muted" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className="sm-modal-body">

          {/* Enrolled: aggregate stats */}
          {!isPending && (
            <div className="sm-stat-grid" style={{ marginBottom: 28 }}>
              <div className="sm-stat-cell">
                <span className="sm-stat-val ink">{student.total_attempts || 0}</span>
                <span className="sm-stat-label ink-faint">Attempts</span>
              </div>
              <div className="sm-stat-cell">
                <span className={`sm-stat-val sm-score--${scoreClass(student.avg_score)}`}>
                  {Math.round(student.avg_score) || 0}%
                </span>
                <span className="sm-stat-label ink-faint">Avg Score</span>
              </div>
              <div className="sm-stat-cell">
                <span className={`sm-stat-val sm-score--${scoreClass(student.best_score)}`}>
                  {student.best_score || 0}%
                </span>
                <span className="sm-stat-label ink-faint">Best Score</span>
              </div>
              <div className="sm-stat-cell">
                <span className="sm-stat-val ink">
                  <span className={`sm-badge sm-badge--${perf.cls}`}>{perf.label}</span>
                </span>
                <span className="sm-stat-label ink-faint">Performance</span>
              </div>
            </div>
          )}

          {/* Enrolled: progress tables */}
          {!isPending && (
            progressLoading ? (
              <div className="sm-loading ink-muted">Loading progress…</div>
            ) : (
              <>
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

                {/* Simulation summary */}
                <div className="sm-section">
                  <h3 className="sm-section-head ink-faint">Simulation Summary</h3>
                  {simProgress ? (
                    <div className="sm-stat-grid">
                      <div className="sm-stat-cell">
                        <span className="sm-stat-val ink">{simProgress.aggregate?.total || 0}</span>
                        <span className="sm-stat-label ink-faint">Attempts</span>
                      </div>
                      <div className="sm-stat-cell">
                        <span className={`sm-stat-val sm-score--${scoreClass(simProgress.aggregate?.best_score)}`}>
                          {Math.round(simProgress.aggregate?.best_score) || 0}%
                        </span>
                        <span className="sm-stat-label ink-faint">Best Score</span>
                      </div>
                      <div className="sm-stat-cell">
                        <span className={`sm-stat-val sm-score--${scoreClass(simProgress.aggregate?.avg_score)}`}>
                          {Math.round(simProgress.aggregate?.avg_score) || 0}%
                        </span>
                        <span className="sm-stat-label ink-faint">Avg Score</span>
                      </div>
                      <div className="sm-stat-cell">
                        <span className="sm-stat-val ink">{simProgress.aggregate?.total_hints || 0}</span>
                        <span className="sm-stat-label ink-faint">Hints Used</span>
                      </div>
                    </div>
                  ) : (
                    <p className="ink-muted" style={{ fontSize: 13 }}>No simulation attempts yet.</p>
                  )}
                </div>
              </>
            )
          )}

          {/* Pending: accept / reject */}
          {isPending && (
            <div className="sm-modal-footer">
              <button className="sm-btn sm-btn--primary" onClick={onAccept}>Accept Student</button>
              <button className="sm-btn sm-btn--danger"  onClick={onReject}>Reject</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDetailsModal;
