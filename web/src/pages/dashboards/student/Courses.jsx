// file path: web/src/pages/dashboards/student/Courses.jsx

import './Courses.css';
import { useState, useEffect, useContext, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";
import { AppContext } from "../../../context/AppContext";
import { RotateCcw, ArrowRight, X } from "lucide-react";
import gsap from "gsap";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const pad2 = (n) => String(n).padStart(2, "0");

// ── CourseModal (centered static panel) ───────────────────────────────────
const CourseModal = ({ onClose, title, children, footer }) => (
  <>
    <div className="course-modal-backdrop" onClick={onClose} />
    <div className="course-modal" role="dialog" aria-modal="true">
      <div className="course-modal-header">
        <span className="course-modal-title">{title}</span>
        <button className="course-modal-close" onClick={onClose} aria-label="Close">
          <X size={15} />
        </button>
      </div>
      <div className="course-modal-body">{children}</div>
      {footer && <div className="course-modal-footer">{footer}</div>}
    </div>
  </>
);

// ── EnrolledCard (full visual weight) ─────────────────────────────────────
const EnrolledCard = ({ course, idx, navigate }) => {
  const bestPct  = Math.round(course.best_score || 0);
  const myRank   = course.my_rank ?? null;
  const students = course.student_count || 0;

  return (
    <div
      className="course-card"
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/student/courses/${course.id}`)}
      onKeyDown={e => e.key === 'Enter' && navigate(`/student/courses/${course.id}`)}
    >
      <div className="course-card-top">
        <span className="course-card-num">{pad2(idx + 1)}</span>
        <div className="course-card-badge course-card-badge--enrolled">
          <span className="course-badge-dot course-badge-dot--enrolled" />
          Enrolled
        </div>
      </div>

      <h3 className="course-card-title">{course.name}</h3>
      <p className="course-card-meta">
        {course.instructor_name} · {students} student{students !== 1 ? 's' : ''}
      </p>

      <div className="course-rank">
        {myRank != null ? (
          <>
            <span className="course-rank-val">#{myRank}</span>
            <span className="course-rank-sub">of {students}</span>
          </>
        ) : (
          <span className="course-rank-val" style={{ color: 'var(--color-fg-subtle)', fontSize: 24 }}>—</span>
        )}
      </div>

      <div className="course-card-footer">
        <div className="course-card-bar"><i style={{ width: `${bestPct}%` }} /></div>
        <span className="course-card-pct">{bestPct}%</span>
        <span className="course-card-cta">View Course <ArrowRight size={10} /></span>
      </div>
    </div>
  );
};

// ── InertCard (pending / rejected — muted) ────────────────────────────────
const InertCard = ({ course, idx, onLeave, onReapply }) => {
  const isPending  = course.enrollment_status === "pending";
  const statusKey  = isPending ? 'pending' : 'rejected';

  return (
    <div className="course-inert-card">
      <div className="course-card-top">
        <span className="course-card-num">{pad2(idx + 1)}</span>
        <div className={`course-card-badge course-card-badge--${statusKey}`}>
          <span className={`course-badge-dot course-badge-dot--${statusKey}`} />
          {isPending ? 'Pending' : 'Rejected'}
        </div>
      </div>

      <h3 className="course-card-title course-card-title--muted">{course.name}</h3>
      <p className="course-card-meta">
        {course.instructor_name} · {course.student_count || 0} students
      </p>

      <div className="course-inert-actions">
        {isPending && (
          <button
            className="course-inert-action"
            onClick={e => { e.stopPropagation(); onLeave(course); }}
          >
            Cancel Request
          </button>
        )}
        {!isPending && !!course.allow_reapply && (
          <button
            className="course-inert-action"
            onClick={e => { e.stopPropagation(); onReapply(course); }}
          >
            <RotateCcw size={11} /> Reapply
          </button>
        )}
      </div>
    </div>
  );
};

// ── BrowseCard ─────────────────────────────────────────────────────────────
const BROWSE_STATUS_BADGE = {
  pending:  { label: 'Pending',  key: 'pending'  },
  accepted: { label: 'Enrolled', key: 'enrolled' },
  rejected: { label: 'Rejected', key: 'rejected' },
};

const BrowseCard = ({ course, idx, onRequestJoin }) => {
  const students = course.student_count || 0;
  const badge    = BROWSE_STATUS_BADGE[course.enrollment_status];

  return (
    <div className="browse-card">
      <div className="course-card-top">
        <span className="course-card-num">{pad2(idx + 1)}</span>
        {badge && (
          <div className={`course-card-badge course-card-badge--${badge.key}`}>
            <span className={`course-badge-dot course-badge-dot--${badge.key}`} />
            {badge.label}
          </div>
        )}
      </div>
      <h3 className="browse-card-title">{course.name}</h3>
      <p className="course-card-meta">{course.instructor_name}</p>
      {course.description && <p className="browse-card-desc">{course.description}</p>}

      <div className="browse-stat">
        <span className="browse-stat-val">{students}</span>
        <span className="browse-stat-sub">student{students !== 1 ? 's' : ''}</span>
      </div>

      <div className="course-card-footer">
        {!badge ? (
          <button className="browse-cta" onClick={() => onRequestJoin(course)}>
            Request to Join <ArrowRight size={11} />
          </button>
        ) : (
          <span className="course-card-cta" style={{ marginLeft: 'auto' }}>{badge.label}</span>
        )}
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────
const Courses = () => {
  const { token } = useContext(AppContext);
  const navigate  = useNavigate();
  const [sp]      = useSearchParams();
  const contentRef = useRef(null);

  const [activeTab,      setActiveTab]      = useState("my");
  const [myCourses,      setMyCourses]      = useState([]);
  const [browseCourses,  setBrowseCourses]  = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [searchTerm,     setSearchTerm]     = useState("");
  const [statusFilter,   setStatusFilter]   = useState("all");
  const [showJoinModal,  setShowJoinModal]  = useState(false);
  const [courseCode,     setCourseCode]     = useState("");
  const [joiningByCode,  setJoiningByCode]  = useState(false);
  const [reapplyCourse,  setReapplyCourse]  = useState(null);
  const [reapplying,     setReapplying]     = useState(false);
  const [leaveModal,     setLeaveModal]     = useState(null);

  useEffect(() => {
    const focus = sp.get("focus");
    if (focus?.startsWith("rejected:")) setActiveTab("my");
  }, []);

  useEffect(() => { fetchCourses(); }, [activeTab, token]);

  useEffect(() => {
    if (contentRef.current && !loading) {
      gsap.fromTo(contentRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
    }
  }, [loading]);

  const fetchCourses = async () => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    if (activeTab === "my") {
      try {
        const res = await axios.get(`${API_URL}/api/courses/my-courses`, { headers });
        setMyCourses(res.data.courses);
      } catch { toast.error("Failed to load your courses"); }
    } else {
      try {
        const res = await axios.get(`${API_URL}/api/courses/browse`, { headers });
        setBrowseCourses(res.data.courses);
      } catch { toast.error("Failed to load available courses"); }
    }
    setLoading(false);
  };

  const handleLeaveCourse = (course) => setLeaveModal(course);

  const confirmLeave = async () => {
    const { id, name } = leaveModal;
    try {
      await axios.delete(`${API_URL}/api/courses/leave/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Left ${name}`);
      fetchCourses();
    } catch { toast.error("Failed to leave course"); }
    setLeaveModal(null);
  };

  const handleRequestJoin = async (course) => {
    try {
      await axios.post(`${API_URL}/api/courses/join/request/${course.id}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Enrollment request sent!");
      fetchCourses();
    } catch (err) { toast.error(err.response?.data?.error || "Failed to send request"); }
  };

  const handleJoinByCode = async () => {
    if (!courseCode.trim()) return toast.error("Please enter a course code");
    setJoiningByCode(true);
    try {
      await axios.post(
        `${API_URL}/api/courses/join/code`,
        { course_code: courseCode.toUpperCase() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Request sent!");
      setCourseCode("");
      setShowJoinModal(false);
      setActiveTab("my");
      fetchCourses();
    } catch (err) { toast.error(err.response?.data?.error || "Failed to join"); }
    finally { setJoiningByCode(false); }
  };

  const handleReapply = async () => {
    if (!reapplyCourse) return;
    setReapplying(true);
    try {
      await axios.post(
        `${API_URL}/api/courses/join/code/reapply`,
        { course_code: reapplyCourse.course_code },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Reapply request sent");
      setReapplyCourse(null);
      fetchCourses();
    } catch (err) { toast.error(err.response?.data?.error || "Failed to reapply"); }
    finally { setReapplying(false); }
  };

  const STATUS_FILTERS = [
    { value: "all",      label: "All" },
    { value: "accepted", label: "Enrolled" },
    { value: "pending",  label: "Pending" },
    { value: "rejected", label: "Rejected" },
  ];

  const filteredMy = myCourses.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (statusFilter === "all" || c.enrollment_status === statusFilter)
  );
  const filteredBrowse = browseCourses.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.instructor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--color-surface-3)] border-t-[color:var(--color-accent)] animate-spin" />
        <p className="text-[12px] uppercase tracking-[0.16em] ink-faint">Loading courses…</p>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div ref={contentRef} className="px-8 lg:px-10 py-8 lg:py-10" style={{ opacity: 0 }}>

        {/* Page header */}
        <header className="course-ph">
          <h1 className="course-ph-title">Your <span className="it">Courses.</span></h1>
        </header>

        {/* Controls: tabs + search + join by code */}
        <div className="course-controls">
          <div className="course-tab-rail">
            {[
              { key: 'my',     label: 'My Courses' },
              { key: 'browse', label: 'Browse' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`course-tab-pill${activeTab === key ? ' active' : ''}`}
                onClick={() => { setActiveTab(key); setStatusFilter("all"); }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="course-controls-right">
            <input
              className="course-search"
              type="text"
              placeholder="Search courses…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <button className="course-join-btn" onClick={() => setShowJoinModal(true)}>
              + Join by Code
            </button>
          </div>
        </div>

        {/* Status filter pills — my tab only */}
        {activeTab === "my" && (
          <div className="course-filter-rail">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                className={`course-filter-pill${statusFilter === f.value ? ' active' : ''}`}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Card grid */}
        {activeTab === "my" ? (
          filteredMy.length > 0 ? (
            <div className="course-grid">
              {filteredMy.map((course, idx) =>
                course.enrollment_status === "accepted" ? (
                  <EnrolledCard key={course.id} course={course} idx={idx} navigate={navigate} />
                ) : (
                  <InertCard
                    key={course.id}
                    course={course}
                    idx={idx}
                    onLeave={handleLeaveCourse}
                    onReapply={setReapplyCourse}
                  />
                )
              )}
            </div>
          ) : myCourses.length === 0 ? (
            <div className="course-empty">
              <p className="course-empty-title">No courses yet.</p>
              <p className="course-empty-sub">Ask your instructor for a code, or browse available courses.</p>
              <div className="course-empty-actions">
                <button className="course-join-btn" onClick={() => setShowJoinModal(true)}>
                  + Join by Code
                </button>
                <button className="course-empty-browse" onClick={() => { setActiveTab('browse'); setStatusFilter('all'); }}>
                  Browse Courses
                </button>
              </div>
            </div>
          ) : searchTerm ? (
            <div className="course-empty">
              <p>No results for &ldquo;{searchTerm}&rdquo;.</p>
            </div>
          ) : (
            <div className="course-empty">
              <p>No {STATUS_FILTERS.find(f => f.value === statusFilter)?.label.toLowerCase()} courses.</p>
            </div>
          )
        ) : (
          filteredBrowse.length > 0 ? (
            <div className="course-grid">
              {filteredBrowse.map((course, idx) => (
                <BrowseCard key={course.id} course={course} idx={idx} onRequestJoin={handleRequestJoin} />
              ))}
            </div>
          ) : (
            <div className="course-empty"><p>No courses available.</p></div>
          )
        )}

      </div>

      {/* ── Join by Code modal ── */}
      {showJoinModal && (
        <CourseModal
          title="Join by Code"
          onClose={() => { setShowJoinModal(false); setCourseCode(""); }}
          footer={
            <>
              <button
                className="course-modal-btn"
                onClick={() => { setShowJoinModal(false); setCourseCode(""); }}
              >
                Cancel
              </button>
              <button
                className="course-modal-btn course-modal-btn--primary"
                onClick={handleJoinByCode}
                disabled={joiningByCode || courseCode.length !== 6}
              >
                {joiningByCode ? "Sending…" : "Send Request"}
              </button>
            </>
          }
        >
          <p className="course-modal-text">
            Enter the 6-character code your instructor shared.
          </p>
          <input
            className="course-modal-input"
            type="text"
            placeholder="ABC123"
            value={courseCode}
            onChange={e => setCourseCode(e.target.value.toUpperCase())}
            maxLength={6}
            autoFocus
          />
        </CourseModal>
      )}

      {/* ── Reapply modal ── */}
      {reapplyCourse && (
        <CourseModal
          title="Resubmit Request"
          onClose={() => setReapplyCourse(null)}
          footer={
            <>
              <button className="course-modal-btn" onClick={() => setReapplyCourse(null)}>
                Cancel
              </button>
              <button
                className="course-modal-btn course-modal-btn--primary"
                onClick={handleReapply}
                disabled={reapplying}
              >
                {reapplying ? "Sending…" : "Resubmit"}
              </button>
            </>
          }
        >
          <p className="course-modal-text">
            Resubmit your enrollment request for <strong>{reapplyCourse.name}</strong>?
          </p>
        </CourseModal>
      )}

      {/* ── Leave course modal ── */}
      {leaveModal && (
        <CourseModal
          title="Leave Course"
          onClose={() => setLeaveModal(null)}
          footer={
            <>
              <button className="course-modal-btn" onClick={() => setLeaveModal(null)}>
                Cancel
              </button>
              <button className="course-modal-btn course-modal-btn--danger" onClick={confirmLeave}>
                Leave
              </button>
            </>
          }
        >
          <p className="course-modal-text">
            Leave <strong>{leaveModal.name}</strong>? This will cancel your enrollment.
          </p>
        </CourseModal>
      )}
    </div>
  );
};

export default Courses;
