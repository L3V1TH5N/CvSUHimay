import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Users, X } from "lucide-react";
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import SectionHead from "./shared/SectionHead";
import { getCSSVar, fmtSeconds, fmtLastActive, scoreBadge } from "./shared/chartHelpers";
import { MODULES_META } from "../../../../data/modulesMeta";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Returns engagement tier based on days since last activity
const engagementStatus = (lastActive) => {
  if (!lastActive) return "none";
  const diff = (Date.now() - new Date(lastActive).getTime()) / 86400000;
  if (diff <= 14) return "active";
  if (diff <= 30) return "moderate";
  return "inactive";
};

const STUDENT_MODALS = {
  moduleProgress: {
    title: "Module Progress",
    description: "Which of the 5 learning modules this student has completed, with the completion date where available.",
    purpose: "Identifies gaps in theoretical preparation that may explain simulation performance issues.",
    guide: "A student with a low simulation score who also hasn't completed Module 4 has a clear, addressable root cause: they need to finish the deboning theory before practicing again.",
  },
  studentList: {
    title: "Enrolled Students",
    description: "All students enrolled in your courses, sorted by your chosen criterion. The coloured dot shows engagement recency; the badge shows their average simulation score.",
    purpose: "Find students who need intervention — either underperforming or disengaged.",
    guide: "Red dot = no sim in over 30 days. Grey dot = never attempted. Click any row to open the full individual analytics panel.",
  },
};

// ── Student Detail Panel ──────────────────────────────────────────────────────
const StudentDetailPanel = ({ student, detail, isLoading, onClose }) => {
  const accent = getCSSVar("--color-accent", "#16a34a");
  const grid   = getCSSVar("--color-hairline", "#e5e7eb");
  const muted  = getCSSVar("--color-fg-subtle", "#9ca3af");

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const { score_trend = [], error_totals = {}, step_performance = [] } = detail?.simAnalytics || {};
  const quizAttempts = detail?.quizAttempts || [];

  const quizModuleMap = {};
  quizAttempts.forEach(a => {
    const id = a.module_id;
    if (!quizModuleMap[id]) quizModuleMap[id] = { attempts: 0, totalPct: 0, passed: 0 };
    quizModuleMap[id].attempts++;
    quizModuleMap[id].totalPct += Number(a.percentage ?? 0);
    if (a.passed) quizModuleMap[id].passed++;
  });
  const quizModules = Object.entries(quizModuleMap).map(([moduleId, d]) => ({
    moduleId:  Number(moduleId),
    attempts:  d.attempts,
    avg_score: d.attempts > 0 ? Math.round(d.totalPct / d.attempts) : null,
    pass_rate: d.attempts > 0 ? Math.round((d.passed / d.attempts) * 100) : 0,
  }));

  const hasSimData  = score_trend.length > 0;
  const hasQuizData = quizModules.length > 0;
  const trendData   = score_trend.map(a => ({ attempt: a.attempt_number, score: a.score_percent }));
  const n           = score_trend.length || 1;
  const avgScore    = hasSimData ? Math.round(score_trend.reduce((s, a) => s + (a.score_percent ?? 0), 0) / n) : null;
  const avgDur      = hasSimData ? Math.round(score_trend.reduce((s, a) => s + (a.duration_seconds ?? 0), 0) / n) : null;

  return (
    <>
      <div className="ar-modal-header">
        <span className="ar-modal-title">{student?.full_name || "Student Detail"}</span>
        <button className="ar-modal-close" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>
      {isLoading || !detail ? (
        <div className="ar-panel-loading"><div className="ar-spinner" /></div>
      ) : (
        <div className="ar-modal-body ar-modal-body--scroll">
          <div className="ar-panel-subsection">
            <SectionHead label="Simulation" />
            {!hasSimData ? (
              <p className="ar-note">No simulation sessions yet.</p>
            ) : (
              <>
                {trendData.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
                      <XAxis dataKey="attempt" tick={{ fontSize: 10, fill: muted, fontFamily: "inherit" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tickCount={4} tick={{ fontSize: 10, fill: muted, fontFamily: "inherit" }} axisLine={false} tickLine={false} unit="%" />
                      <Tooltip contentStyle={{ fontFamily: "inherit", fontSize: 11, border: `1px solid ${grid}` }} formatter={val => [`${val}%`, "Score"]} labelFormatter={label => `Session ${label}`} />
                      <Line type="monotone" dataKey="score" stroke={accent} strokeWidth={2} dot={{ r: 3, fill: accent, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="ar-note">1 session · Score: {trendData[0]?.score ?? 0}%</p>
                )}
                <div className="ar-stu-error-row">
                  <div className="ar-stu-error-card">
                    <span className="ar-error-cell-label">Avg Score</span>
                    <span className="ar-error-cell-count" style={{ color: avgScore == null ? undefined : avgScore >= 75 ? "var(--color-accent)" : avgScore >= 60 ? "#f59e0b" : "#ef4444" }}>
                      {avgScore ?? "—"}%
                    </span>
                    <span className="ar-error-cell-sub">avg across sessions</span>
                  </div>
                  <div className="ar-stu-error-card">
                    <span className="ar-error-cell-label">Avg Duration</span>
                    <span className="ar-error-cell-count">{fmtSeconds(avgDur)}</span>
                    <span className="ar-error-cell-sub">per session</span>
                  </div>
                </div>
                {Object.values(error_totals).some(v => v > 0) && (
                  <div className="ar-panel-subgroup">
                    <span className="ar-panel-subgroup-label">Error Totals</span>
                    <div className="ar-error-grid ar-error-grid--sm">
                      {[
                        { key: "wrong_cut_path",      label: "Wrong Cut",    cls: "high" },
                        { key: "excess_flesh_damage", label: "Excess Flesh", cls: "medium" },
                        { key: "missed_bone",         label: "Missed Bone",  cls: "critical" },
                      ].map(({ key, label, cls }) => (
                        <div key={key} className="ar-error-cell">
                          <span className="ar-error-cell-label">{label}</span>
                          <span className={`ar-error-cell-count ar-error-cell-count--${cls} ar-error-cell-count--sm`}>
                            {error_totals[key] ?? 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {step_performance.length > 0 && (
                  <div className="ar-panel-subgroup">
                    <span className="ar-panel-subgroup-label">Step Performance</span>
                    <div className="ar-table-wrap">
                      <table className="ar-table">
                        <thead>
                          <tr><th>Step</th><th>Accuracy</th><th>Errors</th><th>Avg Time</th></tr>
                        </thead>
                        <tbody>
                          {step_performance.map(s => (
                            <tr key={s.step_key || s.step_id}>
                              <td>{s.step_key || `Step ${s.step_id}`}</td>
                              <td><span className={`ar-badge ${scoreBadge(s.avg_accuracy_pct)}`}>{s.avg_accuracy_pct ?? 0}%</span></td>
                              <td>{s.avg_errors ?? 0}</td>
                              <td>{fmtSeconds(s.avg_time_seconds)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="ar-panel-subsection">
            <SectionHead label="Quizzes" />
            {!hasQuizData ? (
              <p className="ar-note">No quiz attempts yet.</p>
            ) : (
              <div className="ar-table-wrap">
                <table className="ar-table">
                  <thead>
                    <tr><th>Module</th><th>Attempts</th><th>Avg Score</th><th>Pass Rate</th></tr>
                  </thead>
                  <tbody>
                    {quizModules.map(m => (
                      <tr key={m.moduleId}>
                        <td>{MODULES_META.find(mm => mm.id === m.moduleId)?.title || `Module ${m.moduleId}`}</td>
                        <td>{m.attempts}</td>
                        <td>{m.avg_score != null ? <span className={`ar-badge ${scoreBadge(m.avg_score)}`}>{m.avg_score}%</span> : <span>—</span>}</td>
                        <td><span className={`ar-badge ${scoreBadge(m.pass_rate)}`}>{m.pass_rate}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="ar-panel-subsection">
            <SectionHead label="Module Progress" info={STUDENT_MODALS.moduleProgress} onInfoClick={() => {}} />
            {!detail?.moduleCompletion?.length ? (
              <p className="ar-note">No module progress recorded.</p>
            ) : (
              <div className="ar-module-checklist">
                {MODULES_META.map(m => {
                  const found = detail.moduleCompletion.find(r => r.module_id === m.id);
                  const done  = found?.completed === 1;
                  return (
                    <div key={m.id} className="ar-module-checklist-item">
                      <span className="ar-module-checklist-icon">{done ? "✓" : "✗"}</span>
                      <span className="ar-module-checklist-title" style={{ color: done ? "var(--color-fg)" : "var(--color-fg-muted)" }}>
                        {m.title}
                      </span>
                      {done && found?.completed_at && (
                        <span className="ar-module-checklist-date">
                          {new Date(found.completed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// ── StudentsTab ───────────────────────────────────────────────────────────────
const StudentsTab = ({ token, selectedCourse, since, onInfoClick }) => {
  const [students,        setStudents]        = useState([]);
  const [studentsTotal,   setStudentsTotal]   = useState(0);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState("");
  const [sortKey,         setSortKey]         = useState("last_active");
  const [sortDir,         setSortDir]         = useState("desc");
  const [selectedId,      setSelectedId]      = useState(null);
  const [selectedDetail,  setSelectedDetail]  = useState(null);
  const [selectedLoading, setSelectedLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelectedId(null);
    setSelectedDetail(null);
    setSearch("");
    setStudentsTotal(0);

    const params = new URLSearchParams();
    if (selectedCourse) params.set("courseId", selectedCourse);
    if (since)          params.set("since", since);
    const suffix = params.toString() ? `?${params}` : "";

    axios
      .get(`${API_URL}/api/instructor/students${suffix}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(res => {
        if (cancelled) return;
        const seen   = new Set();
        const unique = (res.data.students || []).filter(s => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
        setStudents(unique);
        setStudentsTotal(res.data.total || unique.length);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { toast.error("Failed to load students"); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [selectedCourse, since, token]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const handleRowClick = async (studentId) => {
    if (selectedId === studentId) { setSelectedId(null); setSelectedDetail(null); return; }
    setSelectedId(studentId);
    setSelectedDetail(null);
    setSelectedLoading(true);
    const params = new URLSearchParams();
    if (selectedCourse) params.set("courseId", selectedCourse);
    if (since)          params.set("since", since);
    const suffix = params.toString() ? `?${params}` : "";
    try {
      const [simRes, quizRes] = await Promise.all([
        axios.get(`${API_URL}/api/instructor/students/${studentId}/sim-analytics${suffix}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/instructor/quiz/students/${studentId}/attempts${suffix}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setSelectedDetail({
        simAnalytics:     simRes.data,
        quizAttempts:     quizRes.data.attempts || [],
        moduleCompletion: simRes.data.module_completion || [],
      });
    } catch {
      toast.error("Failed to load student details");
      setSelectedId(null);
    } finally {
      setSelectedLoading(false);
    }
  };

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    return !q || s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    let av, bv;
    if (sortKey === "avg_score") {
      av = a.avg_score || 0; bv = b.avg_score || 0;
    } else if (sortKey === "total_attempts") {
      av = a.total_attempts || 0; bv = b.total_attempts || 0;
    } else {
      av = a.last_active ? new Date(a.last_active).getTime() : 0;
      bv = b.last_active ? new Date(b.last_active).getTime() : 0;
    }
    return sortDir === "asc" ? av - bv : bv - av;
  });

  if (loading) return (
    <div className="ar-loading"><div className="ar-spinner" /><p>Loading students…</p></div>
  );

  if (!students.length) return (
    <div className="ar-empty">
      <div className="ar-empty-icon"><Users size={34} /></div>
      <p className="ar-empty-title">No enrolled students.</p>
      <p className="ar-empty-sub">Students will appear here once they enroll in your courses.</p>
    </div>
  );

  return (
    <div className="ar-content">
      <div className="ar-section">
        <SectionHead
          label={`Enrolled Students · ${students.length}${studentsTotal > students.length ? ` of ${studentsTotal}` : ""}`}
          info={STUDENT_MODALS.studentList}
          onInfoClick={onInfoClick}
        />
        {studentsTotal > students.length && (
          <p className="ar-note">Showing {students.length} of {studentsTotal}. Use course filter to narrow.</p>
        )}

        <div className="ar-sort-controls">
          {[
            { key: "avg_score",      label: "Score" },
            { key: "total_attempts", label: "Attempts" },
            { key: "last_active",    label: "Last Active" },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`ar-sort-btn${sortKey === key ? " ar-sort-btn--active" : ""}`}
              onClick={() => handleSort(key)}
            >
              {label}
              {sortKey === key && <span className="ar-sort-arrow">{sortDir === "asc" ? " ↑" : " ↓"}</span>}
            </button>
          ))}
        </div>

        <input
          className="ar-search"
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {sorted.length === 0 ? (
          <p className="ar-note">No students match "{search}".</p>
        ) : (
          <div className="ar-stu-list">
            {sorted.map(student => (
              <div
                key={student.id}
                className={`ar-stu-row${selectedId === student.id ? " ar-stu-row--open" : ""}`}
                onClick={() => handleRowClick(student.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && handleRowClick(student.id)}
              >
                <div className="ar-student-avatar">
                  {(student.full_name || "?").split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <span
                  className={`ar-engagement-dot ar-engagement-dot--${engagementStatus(student.last_active)}`}
                  title={`Last active: ${student.last_active ? new Date(student.last_active).toLocaleDateString() : "Never"}`}
                />
                <div className="ar-stu-info">
                  <span className="ar-stu-name">{student.full_name || "—"}</span>
                  <span className="ar-stu-email">{student.email}</span>
                </div>
                <span className={`ar-badge ${scoreBadge(student.total_attempts > 0 ? student.avg_score : null)}`}>
                  {student.total_attempts > 0 ? `${student.avg_score}%` : "—"}
                </span>
                <span className="ar-student-attempts">
                  {student.total_attempts} attempt{student.total_attempts !== 1 ? "s" : ""}
                </span>
                {student.achievement_count > 0 && (
                  <span className="ar-stu-last" title={`${student.achievement_count} achievements`}>
                    🏆 {student.achievement_count}
                  </span>
                )}
                <span className="ar-stu-last">
                  {student.modules_completed != null ? `${student.modules_completed}/5 mod` : ""}
                </span>
                <span className="ar-stu-last">{fmtLastActive(student.last_active)}</span>
              </div>
            ))}
          </div>
        )}

        {selectedId && (
          <div
            className="ar-modal-overlay"
            onClick={() => { setSelectedId(null); setSelectedDetail(null); }}
          >
            <div className="ar-modal ar-modal--wide" onClick={e => e.stopPropagation()}>
              <StudentDetailPanel
                student={students.find(s => s.id === selectedId) || null}
                detail={selectedDetail}
                isLoading={selectedLoading}
                onClose={() => { setSelectedId(null); setSelectedDetail(null); }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentsTab;
