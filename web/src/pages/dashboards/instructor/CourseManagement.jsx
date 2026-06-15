// file path: web/src/pages/dashboards/instructor/CourseManagement.jsx

import './CourseManagement.css';
import { useState, useEffect, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";
import { AppContext } from "../../../context/AppContext";
import { Copy, Check, X, MoreHorizontal, BookOpen, Archive, SearchX, ArrowRight } from "lucide-react";
import gsap from "gsap";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const ACCENT_PALETTE = ["#4f6bed","#0d9488","#d97706","#e11d48","#7c3aed","#16a34a","#ea580c","#0891b2"];
const courseAccent = (str = "") => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length];
};

const CourseManagement = () => {
  const { token } = useContext(AppContext);
  const navigate  = useNavigate();
  const contentRef = useRef(null);

  const [courses,          setCourses]          = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [activeTab,        setActiveTab]        = useState("active");
  const [searchTerm,       setSearchTerm]       = useState("");
  const [showCreateModal,  setShowCreateModal]  = useState(false);
  const [showEditModal,    setShowEditModal]    = useState(false);
  const [selectedCourse,   setSelectedCourse]   = useState(null);
  const [copiedCode,       setCopiedCode]       = useState(null);

  useEffect(() => { fetchCourses(); }, []);

  useEffect(() => {
    if (contentRef.current && !loading) {
      gsap.fromTo(contentRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
    }
  }, [loading]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/courses/instructor/my-courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCourses(response.data.courses);
    } catch (error) {
      console.error("Failed to fetch courses:", error);
      toast.error("Failed to load courses");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (courseData) => {
    try {
      const response = await axios.post(`${API_URL}/api/courses/instructor/create`, courseData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Course created! Code: ${response.data.course_code}`);
      setShowCreateModal(false);
      fetchCourses();
    } catch (error) {
      toast.error("Failed to create course");
    }
  };

  const handleUpdateCourse = async (courseId, courseData) => {
    try {
      await axios.put(`${API_URL}/api/courses/instructor/${courseId}`, courseData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Course updated successfully");
      setShowEditModal(false);
      setSelectedCourse(null);
      fetchCourses();
    } catch (error) {
      toast.error("Failed to update course");
    }
  };

  const handleDeleteCourse = async (courseId, courseName) => {
    if (!window.confirm(`Are you sure you want to delete "${courseName}"? This action cannot be undone.`)) return;
    try {
      await axios.delete(`${API_URL}/api/courses/instructor/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Course deleted successfully");
      fetchCourses();
    } catch (error) {
      toast.error("Failed to delete course");
    }
  };

  const handleArchiveCourse = async (courseId, currentStatus) => {
    const newStatus = currentStatus === "active" ? "archived" : "active";
    try {
      await axios.put(`${API_URL}/api/courses/instructor/${courseId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Course ${newStatus === "archived" ? "archived" : "activated"} successfully`);
      fetchCourses();
    } catch (error) {
      toast.error("Failed to update course status");
    }
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success("Code copied!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const tabCourses = courses.filter(c => c.status === activeTab);
  const filtered   = tabCourses.filter(c =>
    (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.code_name || "").toLowerCase().includes(searchTerm.toLowerCase())
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
        <header className="cm-ph">
          <h1 className="cm-ph-title">Course <span className="it">Management.</span></h1>
          <button className="cm-create-btn" onClick={() => setShowCreateModal(true)}>
            + Create Course
          </button>
        </header>

        {/* Controls */}
        <div className="cm-controls">
          <div className="cm-tab-rail">
            {[
              { key: "active",   label: "Active"   },
              { key: "archived", label: "Archived" },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`cm-tab-pill${activeTab === key ? " active" : ""}`}
                onClick={() => { setActiveTab(key); setSearchTerm(""); }}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="cm-course-count">
            {searchTerm
              ? `Showing ${filtered.length} of ${tabCourses.length}`
              : `${tabCourses.length} course${tabCourses.length !== 1 ? "s" : ""}`
            }
          </span>
          <input
            className="cm-search"
            type="text"
            placeholder="Search courses…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Card grid / empty states */}
        {filtered.length > 0 ? (
          <div className="cm-grid">
            {filtered.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                copiedCode={copiedCode}
                onCopy={copyToClipboard}
                onView={() => navigate(`/instructor/dashboard/courses/${course.id}`)}
                onEdit={() => { setSelectedCourse(course); setShowEditModal(true); }}
                onArchive={() => handleArchiveCourse(course.id, course.status)}
                onDelete={() => handleDeleteCourse(course.id, course.name)}
              />
            ))}
          </div>
        ) : tabCourses.length === 0 ? (
          <div className="cm-empty">
            <div className="cm-empty-icon">
              {activeTab === "active" ? <BookOpen size={34} /> : <Archive size={34} />}
            </div>
            <p className="cm-empty-title">
              {activeTab === "active" ? "No active courses yet." : "No archived courses."}
            </p>
            {activeTab === "active" ? (
              <>
                <p className="cm-empty-sub">Create your first course to get started.</p>
                <button className="cm-create-btn" onClick={() => setShowCreateModal(true)}>
                  + Create Course
                </button>
              </>
            ) : (
              <p className="cm-empty-sub">Archived courses will appear here.</p>
            )}
          </div>
        ) : (
          <div className="cm-empty">
            <div className="cm-empty-icon">
              <SearchX size={34} />
            </div>
            <p className="cm-empty-title">No results found.</p>
            <p className="cm-empty-sub">No courses match &ldquo;{searchTerm}&rdquo;.</p>
          </div>
        )}

      </div>

      {showCreateModal && (
        <CourseModal
          title="Create New Course"
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateCourse}
        />
      )}

      {showEditModal && selectedCourse && (
        <CourseModal
          title="Edit Course"
          course={selectedCourse}
          onClose={() => { setShowEditModal(false); setSelectedCourse(null); }}
          onSubmit={(data) => handleUpdateCourse(selectedCourse.id, data)}
        />
      )}
    </div>
  );
};

// ── Course Card ───────────────────────────────────────────────────────────────
const CourseCard = ({ course, copiedCode, onCopy, onView, onEdit, onArchive, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <div className="cm-card" onClick={onView} style={{ borderTopColor: courseAccent(course.name) }}>

      {/* Title + inline menu — eliminates the old dead-space top row */}
      <div className="cm-card-header">
        <h3 className="cm-card-title">{course.name}</h3>
        <div ref={menuRef} className="cm-card-menu" onClick={e => e.stopPropagation()}>
          <button className="cm-card-menu-btn" onClick={() => setMenuOpen(o => !o)}>
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className="cm-card-dropdown">
              <button className="cm-card-dropdown-item" onClick={() => { setMenuOpen(false); onEdit(); }}>Edit</button>
              <button className="cm-card-dropdown-item" onClick={() => { setMenuOpen(false); onArchive(); }}>
                {course.status === "active" ? "Archive" : "Activate"}
              </button>
              <button className="cm-card-dropdown-item cm-card-dropdown-item--danger" onClick={() => { setMenuOpen(false); onDelete(); }}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Identifiers: code name · enrollment code [copy] */}
      <div className="cm-card-ids" onClick={e => e.stopPropagation()}>
        {course.code_name && <span className="cm-card-codename">{course.code_name}</span>}
        {course.code_name && <span className="cm-card-sep">·</span>}
        <code className="cm-card-enrollcode">{course.course_code}</code>
        <button className="cm-card-copy" onClick={() => onCopy(course.course_code)} aria-label="Copy enrollment code">
          {copiedCode === course.course_code ? <Check size={10} /> : <Copy size={10} />}
        </button>
      </div>

      {/* Stats — pending badge only renders when count > 0 */}
      <div className="cm-card-stats">
        <span>{course.student_count || 0} students</span>
        {(course.pending_count || 0) > 0 && (
          <span className="cm-card-pending-badge">{course.pending_count} pending</span>
        )}
      </div>
      <span className="cm-card-view-hint">
        View details <ArrowRight size={10} />
      </span>

    </div>
  );
};

// ── Course Modal ──────────────────────────────────────────────────────────────
const CourseModal = ({ title, course, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    code_name:   course?.code_name   || "",
    name:        course?.name        || "",
    description: course?.description || "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Course name is required");
      return;
    }
    try {
      setSubmitting(true);
      await onSubmit(formData);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="cm-modal-backdrop" onClick={onClose} />
      <div className="cm-modal">
        <div className="cm-modal-header">
          <span className="cm-modal-title">{title}</span>
          <button className="cm-modal-close" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="cm-modal-body">
            <div className="cm-modal-field">
              <label className="cm-modal-label">Course Code</label>
              <input
                className="cm-modal-input"
                type="text"
                value={formData.code_name}
                onChange={e => setFormData({ ...formData, code_name: e.target.value })}
                placeholder="GNED 07"
                maxLength={32}
              />
            </div>
            <div className="cm-modal-field">
              <label className="cm-modal-label">Course Name *</label>
              <input
                className="cm-modal-input"
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Fish Deboning 101"
                required
              />
            </div>
            <div className="cm-modal-field" style={{ marginBottom: 0 }}>
              <label className="cm-modal-label">Description</label>
              <textarea
                className="cm-modal-textarea"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the course…"
                rows={4}
              />
            </div>
          </div>
          <div className="cm-modal-footer">
            <button type="button" className="cm-modal-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="cm-modal-btn cm-modal-btn--primary" disabled={submitting}>
              {submitting ? "Saving…" : (course ? "Update Course" : "Create Course")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default CourseManagement;
