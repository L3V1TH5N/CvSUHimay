// file path: web/src/pages/dashboards/instructor/InstructorCourseDetails.jsx

import './InstructorCourseDetails.css';
import { useState, useEffect, useContext, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";
import { AppContext } from "../../../context/AppContext";
import StudentDetailsModal from "./StudentDetailsModal";
import { ArrowLeft, ArrowRight, Copy, Check, RefreshCw, Users, Trophy, ShieldCheck, SearchX, Trash2 } from "lucide-react";
import gsap from "gsap";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const InstructorCourseDetails = () => {
  const { courseId }  = useParams();
  const navigate      = useNavigate();
  const [sp]          = useSearchParams();
  const { token }     = useContext(AppContext);
  const contentRef    = useRef(null);

  const [courseData,        setCourseData]        = useState(null);
  const [students,          setStudents]          = useState([]);
  const [acceptedStudents,  setAcceptedStudents]  = useState([]);
  const [loading,           setLoading]           = useState(true);

  const [activeSection,  setActiveSection]  = useState("students");
  const [filterStatus,   setFilterStatus]   = useState("accepted");
  const [searchTerm,     setSearchTerm]     = useState("");

  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const [bulkLoading,  setBulkLoading]  = useState(false);

  const [regenLoading, setRegenLoading] = useState(false);
  const [copiedCode,   setCopiedCode]   = useState(false);

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [selectedStudent,  setSelectedStudent]  = useState(null);

  const [highlightStudentId, setHighlightStudentId] = useState(null);

  useEffect(() => {
    fetchCourseData();
    fetchAcceptedStudents();
  }, [courseId]);

  useEffect(() => {
    fetchStudents();
    setSelectedIds(new Set());
  }, [courseId, filterStatus]);

  useEffect(() => {
    const tab    = sp.get("tab");
    const filter = sp.get("filter");
    const focus  = sp.get("focus");
    if (tab === "students") setActiveSection("students");
    if (filter) setFilterStatus(filter);
    if (focus) {
      const id = Number(focus);
      setHighlightStudentId(id);
      setTimeout(() => setHighlightStudentId(null), 3000);
    }
  }, []);

  useEffect(() => {
    if (contentRef.current && !loading) {
      gsap.fromTo(contentRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
    }
  }, [loading]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCourseData(res.data.course);
    } catch {
      toast.error("Failed to load course details");
      navigate("/instructor/dashboard/courses");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await axios.get(
        `${API_URL}/api/courses/instructor/${courseId}/students`,
        { params: { status: filterStatus }, headers: { Authorization: `Bearer ${token}` } }
      );
      setStudents(res.data.students);
    } catch {
      console.error("Failed to fetch students");
    }
  };

  const fetchAcceptedStudents = async () => {
    try {
      const res = await axios.get(
        `${API_URL}/api/courses/instructor/${courseId}/students`,
        { params: { status: "accepted" }, headers: { Authorization: `Bearer ${token}` } }
      );
      setAcceptedStudents(res.data.students);
    } catch {
      console.error("Failed to fetch accepted students");
    }
  };

  const handleAcceptStudent = async (studentId, name) => {
    try {
      await axios.post(
        `${API_URL}/api/courses/instructor/${courseId}/students/${studentId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${name} accepted`);
      refreshAll();
    } catch {
      toast.error("Failed to accept student");
    }
  };

  const handleRejectStudent = async (studentId, name) => {
    if (!window.confirm(`Reject ${name}'s enrollment request?`)) return;
    try {
      await axios.post(
        `${API_URL}/api/courses/instructor/${courseId}/students/${studentId}/reject`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Enrollment rejected");
      refreshAll();
    } catch {
      toast.error("Failed to reject student");
    }
  };

  const handleRemoveStudent = async (studentId, name) => {
    if (!window.confirm(`Remove ${name} from this course?`)) return;
    try {
      await axios.delete(
        `${API_URL}/api/courses/instructor/${courseId}/students/${studentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Student removed");
      refreshAll();
    } catch {
      toast.error("Failed to remove student");
    }
  };

  const handleBulkAccept = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Accept ${selectedIds.size} student(s)?`)) return;
    try {
      setBulkLoading(true);
      await axios.post(
        `${API_URL}/api/courses/instructor/${courseId}/students/bulk-accept`,
        { studentIds: [...selectedIds] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${selectedIds.size} student(s) accepted`);
      setSelectedIds(new Set());
      refreshAll();
    } catch {
      toast.error("Bulk accept failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Reject ${selectedIds.size} student(s)?`)) return;
    try {
      setBulkLoading(true);
      await axios.post(
        `${API_URL}/api/courses/instructor/${courseId}/students/bulk-reject`,
        { studentIds: [...selectedIds] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${selectedIds.size} student(s) rejected`);
      setSelectedIds(new Set());
      refreshAll();
    } catch {
      toast.error("Bulk reject failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleRegenerateCode = async () => {
    if (!window.confirm("Regenerate the course code? The old code will stop working immediately. Enrolled students are unaffected."))
      return;
    try {
      setRegenLoading(true);
      const res = await axios.post(
        `${API_URL}/api/courses/instructor/${courseId}/regenerate-code`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCourseData((prev) => ({ ...prev, course_code: res.data.course_code }));
      toast.success(`New code: ${res.data.course_code}`);
    } catch {
      toast.error("Failed to regenerate code");
    } finally {
      setRegenLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(courseData.course_code);
    setCopiedCode(true);
    toast.success("Code copied!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  const refreshAll = () => {
    fetchCourseData();
    fetchStudents();
    fetchAcceptedStudents();
  };

  const filteredStudents = students.filter(
    (s) =>
      s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const atRiskStudents = acceptedStudents.filter(
    (s) => s.total_attempts === 0 || (s.avg_score !== null && s.avg_score < 60)
  );

  const acceptedList = filterStatus === "accepted" ? students : acceptedStudents;
  const avgScore =
    acceptedList.length > 0
      ? Math.round(acceptedList.reduce((sum, s) => sum + (s.avg_score || 0), 0) / acceptedList.length)
      : 0;

  if (loading) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--color-surface-3)] border-t-[color:var(--color-accent)] animate-spin" />
        <p className="text-[12px] uppercase tracking-[0.16em] ink-faint">Loading course…</p>
      </div>
    );
  }

  if (!courseData) return null;

  return (
    <div className="min-h-full">
      <div ref={contentRef} className="px-8 lg:px-10 py-8 lg:py-10" style={{ opacity: 0 }}>

        {/* Page header */}
        <header className="icd-ph">
          <div>
            <h1 className="icd-ph-title"><span className="it">{courseData.name}.</span></h1>
            <p className="icd-ph-sub">
              {courseData.code_name && `${courseData.code_name} · `}
              {courseData.student_count || 0} student{courseData.student_count !== 1 ? "s" : ""} enrolled
            </p>
          </div>
          <button className="icd-back-btn" onClick={() => navigate("/instructor/dashboard/courses")}>
            <ArrowLeft size={11} /> Back to Courses
          </button>
        </header>

        {/* Atelier two-column layout */}
        <div className="icd-atelier">

          {/* ── Main column ── */}
          <main>
            {/* Section tabs */}
            <div className="icd-tab-rail">
              {[
                { key: "students",    label: "Students" },
                { key: "leaderboard", label: "Leaderboard" },
                { key: "at-risk",     label: `At Risk${atRiskStudents.length > 0 ? ` (${atRiskStudents.length})` : ""}` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className={`icd-tab-pill${activeSection === key ? " active" : ""}`}
                  onClick={() => setActiveSection(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Students section */}
            {activeSection === "students" && (
              <div>
                <div className="icd-search-row">
                  <input
                    className="icd-search"
                    type="text"
                    placeholder="Search students…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <div className="icd-filter-rail">
                    <button
                      className={`icd-filter-pill${filterStatus === "accepted" ? " active" : ""}`}
                      onClick={() => setFilterStatus("accepted")}
                    >
                      Enrolled
                    </button>
                    <button
                      className={`icd-filter-pill${filterStatus === "pending" ? " active" : ""}`}
                      onClick={() => setFilterStatus("pending")}
                    >
                      Pending{courseData?.pending_count > 0 ? ` (${courseData.pending_count})` : ""}
                    </button>
                  </div>
                </div>

                {filteredStudents.length === 0 ? (
                  <div className="icd-empty">
                    <div className="icd-empty-icon">
                      {searchTerm ? <SearchX size={30} /> : <Users size={30} />}
                    </div>
                    <p className="icd-empty-title">
                      {searchTerm
                        ? "No results found."
                        : filterStatus === "pending"
                        ? "No pending requests."
                        : "No students enrolled."}
                    </p>
                    {searchTerm && (
                      <p className="icd-empty-sub">No students match &ldquo;{searchTerm}&rdquo;.</p>
                    )}
                  </div>
                ) : (
                  <div className="icd-table-wrap">
                    <table className="icd-table">
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>#</th>
                          {filterStatus === "pending" && (
                            <th style={{ width: 32 }}>
                              <input
                                type="checkbox"
                                checked={selectedIds.size === filteredStudents.length && filteredStudents.length > 0}
                                onChange={toggleSelectAll}
                              />
                            </th>
                          )}
                          <th className="icd-th-name">Student</th>
                          {filterStatus === "accepted" && (
                            <>
                              <th>Module</th>
                              <th>Quiz</th>
                              <th>Simulation</th>
                            </>
                          )}
                          {filterStatus === "pending" && <th>Requested</th>}
                          {filterStatus === "pending" && <th>Actions</th>}
                          {filterStatus === "accepted" && <th style={{ width: 36 }} />}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student, index) => (
                          <tr
                            key={student.id}
                            className={[
                              highlightStudentId === student.id ? "highlight" : "",
                              filterStatus === "accepted" ? "icd-row-clickable" : "",
                            ].filter(Boolean).join(" ")}
                            onClick={filterStatus === "accepted"
                              ? () => { setSelectedStudent(student); setShowStudentModal(true); }
                              : undefined}
                          >
                            <td style={{ fontSize: "12px", color: "var(--color-fg-subtle)" }}>{index + 1}</td>
                            {filterStatus === "pending" && (
                              <td style={{ width: 32 }}>
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(student.id)}
                                  onChange={() => toggleSelect(student.id)}
                                />
                              </td>
                            )}
                            <td className="icd-table-name-cell">
                              <div className="icd-name-flex">
                                <div className="icd-name-stack">
                                  <strong>{student.full_name || "No name"}</strong>
                                  <small>{student.email}</small>
                                </div>
                                {filterStatus === "accepted" && (
                                  <ArrowRight size={11} className="icd-row-arrow" />
                                )}
                              </div>
                            </td>
                            {filterStatus === "accepted" && (
                              <>
                                <td>
                                  {student.total_modules > 0
                                    ? `${student.modules_completed || 0}/${student.total_modules}`
                                    : "—"}
                                </td>
                                <td>
                                  {student.quiz_avg_score != null
                                    ? `${Math.round(student.quiz_avg_score)}%`
                                    : "—"}
                                </td>
                                <td>
                                  {student.avg_score != null
                                    ? `${Math.round(student.avg_score)}%`
                                    : "—"}
                                </td>
                                <td style={{ width: 36, padding: "0 10px" }}>
                                  <button
                                    className="icd-trash-btn"
                                    title="Remove student"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveStudent(student.id, student.full_name || student.email);
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </>
                            )}
                            {filterStatus === "pending" && (
                              <td>
                                {student.enrolled_at
                                  ? new Date(student.enrolled_at).toLocaleDateString()
                                  : "—"}
                              </td>
                            )}
                            {filterStatus === "pending" && (
                              <td>
                                <div className="icd-action-cell">
                                  <button
                                    className="icd-table-btn icd-table-btn--accept"
                                    onClick={() => handleAcceptStudent(student.id, student.full_name || student.email)}
                                  >
                                    Accept
                                  </button>
                                  <button
                                    className="icd-table-btn icd-table-btn--reject"
                                    onClick={() => handleRejectStudent(student.id, student.full_name || student.email)}
                                  >
                                    Reject
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Leaderboard section */}
            {activeSection === "leaderboard" && (
              <div>
                {!courseData?.leaderboard || courseData.leaderboard.length === 0 ? (
                  <div className="icd-empty">
                    <div className="icd-empty-icon">
                      <Trophy size={30} />
                    </div>
                    <p className="icd-empty-title">No leaderboard data yet.</p>
                    <p className="icd-empty-sub">Students need to complete simulation attempts first.</p>
                  </div>
                ) : (
                  <div className="icd-table-wrap">
                    <table className="icd-table">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th className="icd-th-name">Student</th>
                          <th>Best Score</th>
                          <th>Avg Score</th>
                          <th>Attempts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...courseData.leaderboard].sort((a, b) => a.rank - b.rank).map((student) => (
                          <tr key={student.id}>
                            <td className="icd-rank-cell">#{student.rank}</td>
                            <td>{student.full_name}</td>
                            <td>{Math.round(student.best_score)}%</td>
                            <td>{Math.round(student.avg_score)}%</td>
                            <td>{student.total_attempts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* At-risk section */}
            {activeSection === "at-risk" && (
              <div>
                <div className="icd-section-head">
                  <h3>At-Risk Students</h3>
                  <span className="icd-rule" />
                </div>
                <p className="icd-at-risk-desc">Avg score below 60% or no simulation attempts.</p>
                {atRiskStudents.length === 0 ? (
                  <div className="icd-empty">
                    <div className="icd-empty-icon">
                      <ShieldCheck size={30} />
                    </div>
                    <p className="icd-empty-title">No at-risk students.</p>
                    <p className="icd-empty-sub">All students are performing well.</p>
                  </div>
                ) : (
                  <div className="icd-table-wrap">
                    <table className="icd-table">
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>#</th>
                          <th className="icd-th-name">Student</th>
                          <th>Avg Score</th>
                          <th>Attempts</th>
                          <th>Risk Reason</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atRiskStudents.map((student, index) => (
                          <tr key={student.id}>
                            <td style={{ fontSize: "12px", color: "var(--color-fg-subtle)" }}>{index + 1}</td>
                            <td className="icd-table-name-cell">
                              <strong>{student.full_name || "No name"}</strong>
                              <small>{student.email}</small>
                            </td>
                            <td>{Math.round(student.avg_score) || 0}%</td>
                            <td>{student.total_attempts || 0}</td>
                            <td className="icd-risk-reason">
                              {student.total_attempts === 0 ? "No activity" : "Low score"}
                            </td>
                            <td>
                              <div className="icd-action-cell">
                                <button
                                  className="icd-table-btn icd-table-btn--reveal"
                                  onClick={() => { setSelectedStudent(student); setShowStudentModal(true); }}
                                >
                                  View
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* ── Rail ── */}
          <aside className="icd-rail">

            <div className="icd-rail-block">
              <div className="icd-rail-label">Course Code</div>
              <div className="icd-code-chip">
                <code>{courseData.course_code}</code>
                <button className="icd-code-btn" onClick={copyCode} title="Copy code">
                  {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
              <button
                className="icd-regen-btn"
                onClick={handleRegenerateCode}
                disabled={regenLoading}
              >
                {regenLoading ? "Regenerating…" : <><RefreshCw size={11} />Regenerate Code</>}
              </button>
            </div>

            <div className="icd-rail-block">
              <div className="icd-rail-label">Enrollment</div>
              <div className="icd-display">
                <span className="icd-display-count">{courseData.student_count || 0}</span>
                <span className="icd-display-sub">enrolled</span>
              </div>
              <div className="icd-rail-sep" />
              <div className="icd-stat-row">
                <span className="icd-stat-label">Pending</span>
                <span className="icd-stat-val">{courseData.pending_count ?? 0}</span>
              </div>
              <div className="icd-stat-row">
                <span className="icd-stat-label">Avg Score</span>
                <span className="icd-stat-val">{avgScore}%</span>
              </div>
              <div className="icd-stat-row">
                <span className="icd-stat-label">At Risk</span>
                <span className={`icd-stat-val${atRiskStudents.length > 0 ? " icd-stat-val--danger" : ""}`}>
                  {atRiskStudents.length}
                </span>
              </div>
            </div>

          </aside>
        </div>
      </div>

      {/* Bulk actions floating bar */}
      {filterStatus === "pending" && selectedIds.size > 0 && (
        <div className="icd-bulk-bar">
          <span>{selectedIds.size} selected</span>
          <button
            className="icd-bulk-btn icd-bulk-btn--accept"
            onClick={handleBulkAccept}
            disabled={bulkLoading}
          >
            Accept All
          </button>
          <button
            className="icd-bulk-btn icd-bulk-btn--reject"
            onClick={handleBulkReject}
            disabled={bulkLoading}
          >
            Reject All
          </button>
          <button
            className="icd-bulk-btn icd-bulk-btn--clear"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {showStudentModal && selectedStudent && (
        <StudentDetailsModal
          student={selectedStudent}
          courseId={courseId}
          onClose={() => { setShowStudentModal(false); setSelectedStudent(null); }}
        />
      )}
    </div>
  );
};

export default InstructorCourseDetails;
