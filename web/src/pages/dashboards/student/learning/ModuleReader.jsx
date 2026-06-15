// file path: web/src/pages/dashboards/student/learning/ModuleReader.jsx

import './ModuleReader.css';
import { useState, useEffect, useRef, useContext, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  BookOpen,
  ChevronDown,
  X,
  ArrowRight,
} from "lucide-react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { ThemeContext } from "../../../../context/ThemeContext";
import { AppContext } from "../../../../context/AppContext";

import Module1Content from "./modules/Module1Content";
import Module2Content from "./modules/Module2Content";
import Module3Content from "./modules/Module3Content";
import Module4Content from "./modules/Module4Content";
import Module5Content from "./modules/Module5Content";

import { MODULES_META } from "../../../../data/modulesMeta";
import { getDifficultyConfig } from "../../../../utils/difficulty";
import gsap from "gsap";

const contentMap = {
  1: <Module1Content />,
  2: <Module2Content />,
  3: <Module3Content />,
  4: <Module4Content />,
  5: <Module5Content />,
};

const STORAGE_KEY = (userId, moduleId) => `reader_progress_${userId}_${moduleId}`;

const loadProgress = (userId, moduleId) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(userId, moduleId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      scrollTop: typeof parsed.scrollTop === "number" ? parsed.scrollTop : 0,
      readSections: Array.isArray(parsed.readSections) ? parsed.readSections : [],
    };
  } catch { return null; }
};

const saveProgress = (userId, moduleId, scrollTop, readSections) => {
  try {
    localStorage.setItem(
      STORAGE_KEY(userId, moduleId),
      JSON.stringify({ scrollTop, readSections: [...readSections] })
    );
  } catch {}
};

// ── TocContent (mobile bottom sheet only) ─────────────────────────────────
const TocContent = ({ progressPct, currentModule, activeSection, scrollToSection, setTocSheetOpen, readSections }) => (
  <div className="flex flex-col h-full">
    <div className="px-4 pt-4 pb-3 border-b hairline flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-fg-subtle)',
            fontFamily: 'var(--font-ui)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <BookOpen size={12} />Contents
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent)', fontFamily: 'var(--font-ui)' }}>
          {progressPct}%
        </span>
      </div>
    </div>
    <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
      {currentModule.sections.map((section, i) => {
        const isActive = activeSection === section.id;
        const isRead   = readSections && readSections.has(section.id);
        return (
          <button
            key={section.id}
            onClick={() => { scrollToSection(section.id); setTocSheetOpen(false); }}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              background: isActive ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent',
              color: isActive ? 'var(--color-accent)' : 'var(--color-fg-muted)',
              fontWeight: isActive ? 600 : 400,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              lineHeight: 1.4,
            }}
          >
            <span style={{ flexShrink: 0, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isRead
                ? <CheckCircle size={13} style={{ color: 'var(--color-accent)' }} />
                : (
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%',
                    border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-hairline)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700,
                    color: isActive ? 'var(--color-accent)' : 'var(--color-fg-subtle)',
                  }}>
                    {i + 1}
                  </span>
                )}
            </span>
            <span style={{ lineHeight: 1.4 }}>{section.label}</span>
          </button>
        );
      })}
    </nav>
  </div>
);

// ── ModuleSwitcher ─────────────────────────────────────────────────────────
const ModuleSwitcher = ({ currentModule, completedModuleIds, setSwitcherOpen, goToModule }) => (
  <div
    className="absolute right-0 top-full mt-2 z-[90] overflow-hidden"
    style={{
      width: 272,
      background: 'var(--color-surface)',
      border: '1px solid var(--color-hairline)',
      borderRadius: 12,
      boxShadow: '0 20px 40px -8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)',
    }}
  >
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-hairline)',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)' }}>
        All Modules
      </span>
      <button
        onClick={() => setSwitcherOpen(false)}
        style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-fg-muted)', lineHeight: 0 }}
      >
        <X size={14} />
      </button>
    </div>
    <div style={{ paddingTop: 6, paddingBottom: 6 }}>
      {MODULES_META.map(mod => {
        const isCurrent = mod.id === currentModule.id;
        const isDone    = completedModuleIds.has(mod.id);
        const diff      = getDifficultyConfig(mod.difficulty);
        return (
          <button
            key={mod.id}
            onClick={() => { goToModule(mod); setSwitcherOpen(false); }}
            style={{
              width: '100%', textAlign: 'left',
              padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              background: isCurrent ? 'color-mix(in srgb, var(--color-accent) 6%, transparent)' : 'transparent',
              border: 'none', cursor: 'pointer',
              transition: 'background 120ms ease',
            }}
          >
            <span style={{ flexShrink: 0, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isDone
                ? <CheckCircle size={14} style={{ color: 'var(--color-accent)' }} />
                : isCurrent
                  ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)' }} />
                  : <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid var(--color-hairline)' }} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)', flexShrink: 0 }}>
                  {mod.id}
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 500,
                  color: isCurrent ? 'var(--color-accent)' : 'var(--color-fg)',
                  fontFamily: 'var(--font-ui)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {mod.title}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 500, color: isCurrent ? 'var(--color-accent)' : 'var(--color-fg-muted)', fontFamily: 'var(--font-ui)' }}>
                  <span className={`w-1 h-1 rounded-full ${diff.dot}`} />
                  {diff.label}
                </span>
                <span style={{ fontSize: 10, color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Clock size={10} />~{mod.estimated_duration} min
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════

const ModuleReader = () => {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const { setReaderMode } = useContext(ThemeContext);
  const { user } = useContext(AppContext);
  const userId = user?.id ?? 'anon';

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

  const scrollRef       = useRef(null);
  const contentRef      = useRef(null);
  const columnRef       = useRef(null);
  const headerRef       = useRef(null);
  const switcherRef     = useRef(null);
  const dwellTimers     = useRef(new Map());
  const readSectionsRef = useRef(new Set());
  const lastScrollY     = useRef(0);

  const [isCompleted,        setIsCompleted]        = useState(false);
  const [activeSection,      setActiveSection]      = useState(null);
  const [readSections,       setReadSections]       = useState(new Set());
  const [scrollProgress,     setScrollProgress]     = useState(0);
  const [completedModuleIds, setCompletedModuleIds] = useState(new Set());
  const [switcherOpen,       setSwitcherOpen]       = useState(false);
  const [tocSheetOpen,       setTocSheetOpen]       = useState(false);
  const [showQuizCTA,        setShowQuizCTA]        = useState(false);

  useEffect(() => { readSectionsRef.current = readSections; }, [readSections]);

  const currentModule = MODULES_META.find(m => m.id === parseInt(moduleId));
  const currentIndex  = MODULES_META.findIndex(m => m.id === parseInt(moduleId));
  useEffect(() => {
    if (!currentModule) navigate("/student/modules", { replace: true });
  }, [currentModule, navigate]);
  if (!currentModule) return null;

  const prevModule = currentIndex > 0 ? MODULES_META[currentIndex - 1] : null;
  const nextModule = currentIndex < MODULES_META.length - 1 ? MODULES_META[currentIndex + 1] : null;
  const difficulty  = getDifficultyConfig(currentModule.difficulty);
  const progressPct = currentModule.sections.length > 0
    ? Math.round((readSections.size / currentModule.sections.length) * 100)
    : 0;

  useEffect(() => { setReaderMode(true); return () => setReaderMode(false); }, [setReaderMode]);
  useEffect(() => {
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prior; };
  }, []);

  // Reset + fetch on module change
  useEffect(() => {
    setIsCompleted(false);
    setActiveSection(null);
    setScrollProgress(0);
    setSwitcherOpen(false);
    setTocSheetOpen(false);
    setShowQuizCTA(false);
    lastScrollY.current = 0;

    const saved = loadProgress(userId, moduleId);
    if (saved) {
      const restored = new Set(saved.readSections);
      setReadSections(restored);
      readSectionsRef.current = restored;
    } else {
      setReadSections(new Set());
      readSectionsRef.current = new Set();
    }
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    if (headerRef.current) headerRef.current.classList.remove('reader-header--hidden');

    const fetchAllProgress = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/module/module-progress`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const completedIds = new Set(
          (res.data || []).filter(p => p.completed).map(p => p.module_id)
        );
        setCompletedModuleIds(completedIds);
        if (completedIds.has(parseInt(moduleId))) setIsCompleted(true);
      } catch (err) { console.error("Error fetching progress:", err); }
    };
    fetchAllProgress();
  }, [moduleId]);

  // GSAP entrance on module change
  useEffect(() => {
    if (columnRef.current) {
      gsap.fromTo(
        columnRef.current,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
      );
    }
  }, [moduleId]);

  // Scroll: progress + auto-hide header + persist
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;

      // Auto-hide header
      const delta = scrollTop - lastScrollY.current;
      lastScrollY.current = scrollTop;
      if (headerRef.current) {
        if (scrollTop > 10 && delta > 0) {
          headerRef.current.classList.add('reader-header--hidden');
        } else {
          headerRef.current.classList.remove('reader-header--hidden');
        }
      }

      // Scroll progress bar
      const max = scrollHeight - clientHeight;
      const pct = max > 0 ? Math.min(100, (scrollTop / max) * 100) : 0;
      setScrollProgress(pct);
      saveProgress(userId, moduleId, scrollTop, readSectionsRef.current);
    };
    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, [moduleId]);

  // Active section detection with dwell
  useEffect(() => {
    if (!contentRef.current) return;
    const DWELL_MS = 1500;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const id = entry.target.getAttribute("data-section-id");
        if (!id) return;
        if (entry.isIntersecting) {
          setActiveSection(id);
          if (!dwellTimers.current.has(id)) {
            const handle = setTimeout(() => {
              setReadSections(prev => {
                const next = new Set([...prev, id]);
                readSectionsRef.current = next;
                return next;
              });
              dwellTimers.current.delete(id);
            }, DWELL_MS);
            dwellTimers.current.set(id, handle);
          }
        } else {
          const handle = dwellTimers.current.get(id);
          if (handle) { clearTimeout(handle); dwellTimers.current.delete(id); }
        }
      });
    }, { root: scrollRef.current, rootMargin: "0px 0px -40% 0px", threshold: 0 });

    const sections = contentRef.current.querySelectorAll("[data-section-id]");
    sections.forEach(el => observer.observe(el));
    return () => {
      observer.disconnect();
      dwellTimers.current.forEach(h => clearTimeout(h));
      dwellTimers.current.clear();
    };
  }, [moduleId]);

  // Module Switcher outside click
  useEffect(() => {
    if (!switcherOpen) return;
    const handler = e => {
      if (switcherRef.current && !switcherRef.current.contains(e.target)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [switcherOpen]);

  // Force header visible when switcher is open
  useEffect(() => {
    if (switcherOpen && headerRef.current) {
      headerRef.current.classList.remove('reader-header--hidden');
    }
  }, [switcherOpen]);

  const goBack     = useCallback(() => navigate("/student/modules"), [navigate]);
  const goToModule = (mod) => navigate(`/student/modules/${mod.id}`);

  // Keyboard: Escape closes dropdowns or navigates back
  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") {
        if (switcherOpen) { setSwitcherOpen(false); return; }
        goBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [switcherOpen, goBack]);

  const scrollToSection = useCallback((sectionId) => {
    if (!contentRef.current || !scrollRef.current) return;
    const el = contentRef.current.querySelector(`[data-section-id="${sectionId}"]`);
    if (!el) return;
    const containerTop = scrollRef.current.getBoundingClientRect().top;
    const elTop        = el.getBoundingClientRect().top;
    const offset       = elTop - containerTop + scrollRef.current.scrollTop - 80;
    scrollRef.current.scrollTo({ top: offset, behavior: "smooth" });
  }, [moduleId]);

  const markAsComplete = async () => {
    if (isCompleted) return;
    try {
      await axios.post(
        `${API_URL}/api/module/modules/${moduleId}/complete-module`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      setIsCompleted(true);
      setShowQuizCTA(true);
      setCompletedModuleIds(prev => new Set([...prev, parseInt(moduleId)]));
      toast.success("Module completed! Ready for the quiz?", {
        duration: 6000,
        action: { label: "Take quiz", onClick: () => navigate(`/student/quizzes/${moduleId}`) },
      });
    } catch (err) {
      console.error("Error marking complete:", err);
      toast.error("Failed to mark module complete. Please try again.");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-[color:var(--color-bg)] flex flex-col">

      {/* ── Fixed header ── */}
      <header ref={headerRef} className="reader-header">
        {/* Progress bar — child of header, moves with it on hide/show */}
        <div className="reader-progress" style={{ width: `${scrollProgress}%` }} />

        {/* Back */}
        <button onClick={goBack} className="reader-back">
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--color-hairline)' }} />

        {/* Title */}
        <span className="reader-header-title">{currentModule.title}</span>

        <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--color-hairline)' }} />

        {/* Controls */}
        <div className="reader-header-controls">

          {/* Mobile TOC toggle */}
          <button
            onClick={() => setTocSheetOpen(true)}
            className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-fg-muted)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
          >
            <BookOpen size={11} />
            {readSections.size}/{currentModule.sections.length}
          </button>

          {/* Module Switcher */}
          <div className="relative flex-shrink-0" ref={switcherRef}>
            <button
              className={`reader-switcher-btn${switcherOpen ? ' reader-switcher-btn--open' : ''}`}
              onClick={() => setSwitcherOpen(o => !o)}
            >
              <span>Module {currentModule.id} of {MODULES_META.length}</span>
              <ChevronDown size={12} style={{ transform: switcherOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} />
            </button>
            {switcherOpen && (
              <ModuleSwitcher
                currentModule={currentModule}
                completedModuleIds={completedModuleIds}
                setSwitcherOpen={setSwitcherOpen}
                goToModule={goToModule}
              />
            )}
          </div>

        </div>
      </header>

      {/* ── Scrollable content ── */}
      <main ref={scrollRef} className="reader-main">
        <div ref={columnRef} className="reader-layout" style={{ opacity: 0 }}>

          {/* Sticky sidebar TOC — desktop only */}
          <aside className="reader-sidebar">
            <div className="reader-sidebar-head">
              <span className="reader-sidebar-label">
                <BookOpen size={10} />Contents
              </span>
              <span className="reader-sidebar-count">
                {readSections.size}/{currentModule.sections.length}
              </span>
            </div>
            {currentModule.sections.map((section, i) => {
              const isRead   = readSections.has(section.id);
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  className={`reader-sidebar-row${isActive ? ' reader-sidebar-row--active' : ''}`}
                  onClick={() => scrollToSection(section.id)}
                >
                  <span className="reader-sidebar-indicator">
                    {isRead
                      ? <CheckCircle size={12} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                      : <span className="reader-sidebar-num">{i + 1}</span>}
                  </span>
                  <span>{section.label}</span>
                </button>
              );
            })}
          </aside>

          {/* Main content column */}
          <div className="reader-column">

          {/* Module header block */}
          <div className="reader-mod-header">
            <div className="reader-mod-eyebrow">
              Module {String(currentModule.id).padStart(2, '0')}
              <span className="w-8 h-px bg-current opacity-40 flex-shrink-0" />
            </div>
            <h1 className="reader-mod-title font-outfit">{currentModule.title}</h1>
            <div className="reader-mod-tags">
              <span className={`reader-mod-tag ${difficulty.style ?? ''}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${difficulty.dot}`} />
                {difficulty.label}
              </span>
              <span className="reader-mod-tag">
                <Clock size={10} />~{currentModule.estimated_duration} min
              </span>
              <span className="reader-mod-tag">
                {currentModule.sections.length} sections
              </span>
            </div>
            <p className="reader-mod-desc">{currentModule.description}</p>
            {isCompleted && (
              <span className="reader-mod-done">
                <CheckCircle size={12} /> Completed
              </span>
            )}
          </div>

          {/* Article content */}
          <div ref={contentRef} className="reader-article select-text">
            <SectionWrapper module={currentModule} />
          </div>

          {/* Bottom section */}
          <div className="reader-bottom">
            {!isCompleted ? (
              <div className="reader-complete-card">
                <p className="reader-complete-eyebrow">Finished reading?</p>
                <p className="reader-complete-title">Mark this module complete.</p>
                <p className="reader-complete-sub">Track your progress and unlock the quiz.</p>
                <button onClick={markAsComplete} className="primary-cta">
                  <CheckCircle size={14} /> Mark Complete
                </button>
              </div>
            ) : showQuizCTA && (
              <div className="reader-quiz-cta">
                <p className="reader-quiz-cta-eyebrow">Module Complete</p>
                <p className="reader-quiz-cta-title">Ready to test your knowledge?</p>
                <button
                  onClick={() => navigate(`/student/quizzes/${moduleId}`)}
                  className="primary-cta"
                >
                  Take Module Quiz <ArrowRight size={14} />
                </button>
              </div>
            )}

            <div className="reader-nav-grid">
              {prevModule ? (
                <button onClick={() => goToModule(prevModule)} className="reader-nav-prev">
                  <div className="reader-nav-label">
                    <ChevronLeft size={12} /> Previous
                  </div>
                  <p className="reader-nav-title">{prevModule.title}</p>
                </button>
              ) : <div />}

              {nextModule ? (
                <button onClick={() => goToModule(nextModule)} className="reader-nav-next">
                  <div className="reader-nav-label">
                    Next <ChevronRight size={12} />
                  </div>
                  <p className="reader-nav-title">{nextModule.title}</p>
                </button>
              ) : (
                <button onClick={goBack} className="reader-nav-next">
                  <div className="reader-nav-label">
                    All done! <CheckCircle size={12} />
                  </div>
                  <p className="reader-nav-title">Back to Modules</p>
                </button>
              )}
            </div>
          </div>

          </div>{/* /reader-column */}
        </div>{/* /reader-layout */}
      </main>

      {/* ── Mobile TOC bottom sheet ── */}
      {tocSheetOpen && (
        <>
          <div
            className="fixed inset-0 z-[70] lg:hidden"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setTocSheetOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[80] lg:hidden flex flex-col"
            style={{
              background: 'var(--color-surface)',
              borderTop: '1px solid var(--color-hairline)',
              borderRadius: '16px 16px 0 0',
              maxHeight: '70vh',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
            }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-hairline)',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <BookOpen size={12} />Contents
              </span>
              <button
                onClick={() => setTocSheetOpen(false)}
                style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-fg-muted)', lineHeight: 0, borderRadius: 8 }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TocContent
                progressPct={progressPct}
                currentModule={currentModule}
                activeSection={activeSection}
                scrollToSection={scrollToSection}
                setTocSheetOpen={setTocSheetOpen}
                readSections={readSections}
              />
            </div>
          </div>
        </>
      )}

    </div>,
    document.body
  );
};

// ── SectionWrapper (unchanged) ────────────────────────────────────────────
const SectionWrapper = ({ module }) => {
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!wrapRef.current) return;
    const sections = wrapRef.current.querySelectorAll("section[id]");
    sections.forEach(el => el.setAttribute("data-section-id", el.id));
  }, [module]);
  return <div ref={wrapRef}>{contentMap[module.id]}</div>;
};

export default ModuleReader;
