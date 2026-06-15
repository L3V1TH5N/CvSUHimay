// file path: web/src/pages/dashboards/instructor/StudentManagement.jsx

import { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { AppContext } from "../../../context/AppContext";
import StudentProfileModal from "./StudentProfileModal";
import "./StudentManagement.css";
import gsap from "gsap";
import { Users, Clock, SearchX, Trash2 } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const formatDate = (ts) =>
  ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const scoreClass = (score) => {
  if (!score && score !== 0) return "";
  if (score >= 75) return "good";
  if (score >= 60) return "avg";
  return "bad";
};

const SortIcon = ({ col, sortBy, sortDir }) => (
  <span className={`sm-sort-icon${sortBy === col ? " active" : ""}`}>
    {sortBy === col ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
  </span>
);

const StudentManagement = () => {
  const { token }  = useContext(AppContext);
  const contentRef = useRef(null);

  const [courses,         setCourses]         = useState([]);
  const [selectedCourse,  setSelectedCourse]  = useState(null);
  const [students,        setStudents]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [searchTerm,      setSearchTerm]      = useState("");
  const [filterStatus,    setFilterStatus]    = useState("accepted");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showProfile,     setShowProfile]     = useState(false);
  const [sortBy,          setSortBy]          = useState(null);
  const [sortDir,         setSortDir]         = useState("desc");
  const [attentionFilter, setAttentionFilter] = useState(false);
  const [selectedIds,     setSelectedIds]     = useState(new Set());
  const [bulkLoading,     setBulkLoading]     = useState(false);

  useEffect(() => { fetchCourses(); }, []);
  useEffect(() => {
    if (selectedCourse) fetchStudents();
  }, [selectedCourse, filterStatus]);

  useEffect(() => {
    if (contentRef.current && !loading) {
      gsap.fromTo(contentRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
    }
  }, [loading]);

  const fetchCourses = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/courses/instructor/my-courses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCourses(res.data.courses);
      if (res.data.courses.length > 0) setSelectedCourse(res.data.courses[0].id);
      else setLoading(false);
    } catch {
      toast.error("Failed to load courses");
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const url = selectedCourse === "__ALL__"
        ? `${API_URL}/api/courses/instructor/students/all`
        : `${API_URL}/api/courses/instructor/${selectedCourse}/students`;
      const res = await axios.get(url, {
        params: { status: filterStatus },
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(res.data.students);
    } catch {
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const courseIdFor = (student) =>
    selectedCourse === "__ALL__" ? student.course_id : selectedCourse;

  const handleAcceptStudent = async (studentId, name, student) => {
    try {
      await axios.post(
        `${API_URL}/api/courses/instructor/${courseIdFor(student)}/students/${studentId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${name} accepted`);
      fetchStudents(); fetchCourses();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to accept student");
    }
  };

  const handleRejectStudent = async (studentId, name, student) => {
    if (!window.confirm(`Reject ${name}'s enrollment request?`)) return;
    try {
      await axios.post(
        `${API_URL}/api/courses/instructor/${courseIdFor(student)}/students/${studentId}/reject`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${name}'s request rejected`);
      fetchStudents(); fetchCourses();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to reject student");
    }
  };

  const handleRemoveStudent = async (studentId, name, student) => {
    if (!window.confirm(`Remove ${name} from this course? All their progress will be deleted.`)) return;
    try {
      await axios.delete(
        `${API_URL}/api/courses/instructor/${courseIdFor(student)}/students/${studentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${name} removed`);
      fetchStudents(); fetchCourses();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to remove student");
    }
  };

  const handleBulkAccept = async () => {
    if (selectedIds.size === 0 || selectedCourse === "__ALL__") return;
    if (!window.confirm(`Accept ${selectedIds.size} student(s)?`)) return;
    try {
      setBulkLoading(true);
      await axios.post(
        `${API_URL}/api/courses/instructor/${selectedCourse}/students/bulk-accept`,
        { studentIds: [...selectedIds] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${selectedIds.size} student(s) accepted`);
      setSelectedIds(new Set());
      fetchStudents(); fetchCourses();
    } catch {
      toast.error("Bulk accept failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0 || selectedCourse === "__ALL__") return;
    if (!window.confirm(`Reject ${selectedIds.size} student(s)?`)) return;
    try {
      setBulkLoading(true);
      await axios.post(
        `${API_URL}/api/courses/instructor/${selectedCourse}/students/bulk-reject`,
        { studentIds: [...selectedIds] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${selectedIds.size} student(s) rejected`);
      setSelectedIds(new Set());
      fetchStudents(); fetchCourses();
    } catch {
      toast.error("Bulk reject failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === displayStudents.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(displayStudents.map(s => s.id)));
  };

  const openProfile  = (student) => { setSelectedStudent(student); setShowProfile(true); };
  const closeProfile = () => { setShowProfile(false); setSelectedStudent(null); };

  const handleSort = (col) => {
    if (sortBy === col) {
      if (sortDir === "desc") setSortDir("asc");
      else { setSortBy(null); setSortDir("desc"); }
    } else {
      setSortBy(col); setSortDir("desc");
    }
  };

  const switchFilter = (status) => {
    setFilterStatus(status);
    setSearchTerm("");
    setSortBy(null); setSortDir("desc");
    setAttentionFilter(false);
    setSelectedIds(new Set());
  };

  // derived values
  const isAllCourses     = selectedCourse === "__ALL__";
  const currentCourse    = isAllCourses ? null : courses.find(c => c.id === selectedCourse);
  const acceptedStudents = students.filter(s => s.enrollment_status === "accepted");
  const pendingStudents  = students.filter(s => s.enrollment_status === "pending");
  const avgScore = acceptedStudents.length > 0
    ? Math.round(acceptedStudents.reduce((sum, s) => sum + (s.avg_score || 0), 0) / acceptedStudents.length)
    : 0;
  const needAttention = acceptedStudents.filter(s => (s.avg_score || 0) < 60).length;
  const enrolledCount = isAllCourses ? acceptedStudents.length : (currentCourse?.student_count || 0);
  const pendingCount  = isAllCourses ? pendingStudents.length  : (currentCourse?.pending_count  || 0);

  // filter → attention → sort
  let displayStudents = students.filter(s =>
    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  if (attentionFilter && filterStatus === "accepted") {
    displayStudents = displayStudents.filter(s => (s.avg_score || 0) < 60);
  }
  if (sortBy) {
    displayStudents = [...displayStudents].sort((a, b) => {
      let aVal = sortBy === "enrolled_at"
        ? (a[sortBy] ? new Date(a[sortBy]).getTime() : 0)
        : (a[sortBy] ?? -1);
      let bVal = sortBy === "enrolled_at"
        ? (b[sortBy] ? new Date(b[sortBy]).getTime() : 0)
        : (b[sortBy] ?? -1);
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }

  const statsLabel = searchTerm
    ? `Showing ${displayStudents.length} of ${students.length}`
    : `${enrolledCount} enrolled · ${pendingCount} pending · ${avgScore}% avg`;

  if (loading) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--color-surface-3)] border-t-[color:var(--color-accent)] animate-spin" />
        <p className="text-[12px] uppercase tracking-[0.16em] ink-faint">Loading students…</p>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div ref={contentRef} className="px-8 lg:px-10 py-8 lg:py-10" style={{ opacity: 0 }}>

        {/* Page header */}
        <header className="sm-ph">
          <h1 className="sm-ph-title">Student <span className="it">Management.</span></h1>
        </header>

        {courses.length === 0 && (
          <div className="sm-empty">
            <div className="sm-empty-icon"><Users size={34} /></div>
            <p className="sm-empty-title">No courses yet.</p>
            <p className="sm-empty-sub">Create a course first to manage students.</p>
          </div>
        )}

        {courses.length > 0 && (
          <>
            {/* Controls row */}
            <div className="sm-controls">
              <select
                className="sm-course-select"
                value={selectedCourse || ""}
                onChange={e => {
                  const v = e.target.value;
                  setSelectedCourse(v === "__ALL__" ? "__ALL__" : Number(v));
                  setSortBy(null); setSortDir("desc");
                  setAttentionFilter(false);
                  setSelectedIds(new Set());
                }}
              >
                <option value="__ALL__">All courses</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code_name ? `${c.code_name} · ${c.name}` : c.name}
                  </option>
                ))}
              </select>

              <div className="sm-tab-rail">
                <button
                  className={`sm-tab-pill${filterStatus === "accepted" ? " active" : ""}`}
                  onClick={() => switchFilter("accepted")}
                >
                  Enrolled {enrolledCount > 0 && <span className="sm-tab-count">{enrolledCount}</span>}
                </button>
                <button
                  className={`sm-tab-pill${filterStatus === "pending" ? " active" : ""}`}
                  onClick={() => switchFilter("pending")}
                >
                  Pending {pendingCount > 0 && <span className="sm-tab-count">{pendingCount}</span>}
                </button>
              </div>

              <span className="sm-stats-label">
                {statsLabel}
                {!searchTerm && needAttention > 0 && filterStatus === "accepted" && (
                  <>
                    {" · "}
                    <button
                      className={`sm-attention-btn${attentionFilter ? " active" : ""}`}
                      onClick={() => setAttentionFilter(f => !f)}
                    >
                      {needAttention} need attention
                    </button>
                  </>
                )}
              </span>

              <input
                className="sm-search"
                type="text"
                placeholder="Search by name or email…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Content */}
            {displayStudents.length === 0 ? (
              <div className="sm-empty">
                <div className="sm-empty-icon">
                  {searchTerm ? <SearchX size={34} />
                    : attentionFilter ? <Users size={34} />
                    : filterStatus === "pending" ? <Clock size={34} /> : <Users size={34} />}
                </div>
                <p className="sm-empty-title">
                  {searchTerm ? "No results found."
                    : attentionFilter ? "No students need attention."
                    : filterStatus === "pending" ? "No pending requests." : "No enrolled students."}
                </p>
                <p className="sm-empty-sub">
                  {searchTerm ? `No students match "${searchTerm}".`
                    : attentionFilter ? "All enrolled students are performing above the threshold."
                    : filterStatus === "pending"
                    ? "Students who request to join will appear here."
                    : "Accept pending requests to see enrolled students."}
                </p>
              </div>
            ) : (
              <div className="sm-table-wrap">
                <table className="sm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }} className="ink-faint">#</th>
                      {/* Checkbox column — pending + specific course only */}
                      {filterStatus === "pending" && !isAllCourses && (
                        <th style={{ width: 32 }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.size === displayStudents.length && displayStudents.length > 0}
                            onChange={toggleSelectAll}
                          />
                        </th>
                      )}
                      <th className="ink-faint sm-th-name">Student</th>
                      {isAllCourses && <th className="ink-faint">Course</th>}
                      {filterStatus === "accepted" && (
                        <>
                          <th className="ink-faint">Module</th>
                          <th
                            className="ink-faint sm-th-sortable"
                            onClick={() => handleSort("quiz_avg_score")}
                          >
                            Quiz <SortIcon col="quiz_avg_score" sortBy={sortBy} sortDir={sortDir} />
                          </th>
                          <th
                            className="ink-faint sm-th-sortable"
                            onClick={() => handleSort("avg_score")}
                          >
                            Simulation <SortIcon col="avg_score" sortBy={sortBy} sortDir={sortDir} />
                          </th>
                        </>
                      )}
                      <th
                        className="ink-faint sm-th-sortable"
                        onClick={() => handleSort("enrolled_at")}
                      >
                        {filterStatus === "pending" ? "Requested" : "Enrolled"}
                        {" "}<SortIcon col="enrolled_at" sortBy={sortBy} sortDir={sortDir} />
                      </th>
                      {filterStatus === "pending" && <th className="ink-faint">Actions</th>}
                      {filterStatus === "accepted" && <th style={{ width: 36 }} />}
                    </tr>
                  </thead>
                  <tbody>
                    {displayStudents.map((student, index) => {
                      const attention  = filterStatus === "accepted" && (student.avg_score || 0) < 60;
                      const hasSimData = (student.total_attempts || 0) > 0;
                      return (
                        <tr
                          key={student.id}
                          className={[
                            filterStatus === "accepted" ? "sm-row-clickable" : "",
                          ].filter(Boolean).join(" ")}
                          onClick={filterStatus === "accepted" ? () => openProfile(student) : undefined}
                        >

                          <td className="ink-faint" style={{ fontSize: "12px" }}>{index + 1}</td>

                          {filterStatus === "pending" && !isAllCourses && (
                            <td style={{ width: 32 }}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(student.id)}
                                onChange={() => toggleSelect(student.id)}
                              />
                            </td>
                          )}

                          <td className="sm-table-name-cell">
                            <strong className="ink">{student.full_name || "No name"}</strong>
                            <small className="ink-muted">{student.email}</small>
                          </td>

                          {isAllCourses && (
                            <td className="sm-td-course ink-muted">
                              {student.course_code_name
                                ? `${student.course_code_name} · ${student.course_name}`
                                : student.course_name}
                            </td>
                          )}

                          {filterStatus === "accepted" && (
                            <>
                              <td className="sm-td-center ink-muted">
                                {student.total_modules > 0
                                  ? `${student.modules_completed || 0}/${student.total_modules}`
                                  : "—"}
                              </td>
                              <td className="sm-td-center">
                                {student.quiz_avg_score != null
                                  ? <span className={`sm-score--${scoreClass(student.quiz_avg_score)}`}>{Math.round(student.quiz_avg_score)}%</span>
                                  : <span className="ink-faint">—</span>}
                              </td>
                              <td className="sm-td-center">
                                {hasSimData
                                  ? <span className={`sm-score--${scoreClass(student.avg_score)}`}>{Math.round(student.avg_score)}%</span>
                                  : <span className="ink-faint">—</span>}
                              </td>
                            </>
                          )}

                          <td className="sm-td-date ink-muted">{formatDate(student.enrolled_at)}</td>

                          {filterStatus === "pending" ? (
                            <td>
                              <div className="sm-actions sm-actions--right">
                                <button className="sm-btn sm-btn--ghost sm-btn--reveal" onClick={() => openProfile(student)}>Details</button>
                                <button className="sm-btn sm-btn--primary" onClick={() => handleAcceptStudent(student.id, student.full_name || student.email, student)}>Accept</button>
                                <button className="sm-btn sm-btn--danger"  onClick={() => handleRejectStudent(student.id, student.full_name || student.email, student)}>Reject</button>
                              </div>
                            </td>
                          ) : (
                            <td style={{ width: 36, padding: "0 10px" }}>
                              <button
                                className="sm-trash-btn"
                                title="Remove student"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveStudent(student.id, student.full_name || student.email, student);
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

      </div>

      {/* Bulk action bar — pending + specific course + selection active */}
      {filterStatus === "pending" && !isAllCourses && selectedIds.size > 0 && (
        <div className="sm-bulk-bar">
          <span className="sm-bulk-count">{selectedIds.size} selected</span>
          <button className="sm-bulk-btn sm-bulk-btn--accept" onClick={handleBulkAccept} disabled={bulkLoading}>
            Accept All
          </button>
          <button className="sm-bulk-btn sm-bulk-btn--reject" onClick={handleBulkReject} disabled={bulkLoading}>
            Reject All
          </button>
          <button className="sm-bulk-btn sm-bulk-btn--clear" onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
        </div>
      )}

      {showProfile && selectedStudent && (
        <StudentProfileModal
          student={selectedStudent}
          courseId={courseIdFor(selectedStudent)}
          isPending={filterStatus === "pending"}
          onClose={closeProfile}
          onAccept={() => {
            handleAcceptStudent(selectedStudent.id, selectedStudent.full_name || selectedStudent.email, selectedStudent);
            closeProfile();
          }}
          onReject={() => {
            handleRejectStudent(selectedStudent.id, selectedStudent.full_name || selectedStudent.email, selectedStudent);
            closeProfile();
          }}
        />
      )}
    </div>
  );
};

export default StudentManagement;
