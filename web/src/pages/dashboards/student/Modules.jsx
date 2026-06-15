// file path: web/src/pages/dashboards/student/Modules.jsx

import './Modules.css';
import { useState, useEffect, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";
import { ArrowRight, CheckCircle, Clock, Hash, X } from "lucide-react";
import { MODULES_META } from "../../../data/modulesMeta";
import { getDifficultyConfig } from "../../../utils/difficulty";
import { AppContext } from "../../../context/AppContext";
import { computeXP } from "../../../utils/xp";
import gsap from "gsap";

// ── Skeleton ──────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="mod-skeleton">
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div className="mod-skeleton-line" style={{ height: 11, width: '20%' }} />
      <div className="mod-skeleton-line" style={{ height: 11, width: '16%' }} />
    </div>
    <div className="mod-skeleton-line" style={{ height: 18, width: '80%', marginTop: 4 }} />
    <div className="mod-skeleton-line" style={{ height: 13, width: '100%' }} />
    <div className="mod-skeleton-line" style={{ height: 13, width: '70%' }} />
    <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
      <div className="mod-skeleton-line" style={{ height: 22, width: 68 }} />
      <div className="mod-skeleton-line" style={{ height: 22, width: 55 }} />
    </div>
    <div className="mod-skeleton-line" style={{ height: 4, width: '100%', marginTop: 'auto' }} />
  </div>
);

// ── ReadingProgressRing (SVG ring indicator, functionality unchanged) ──────
const ReadingProgressRing = ({ progress, isCompleted }) => {
  const R    = 10;
  const CIRC = 2 * Math.PI * R;
  return (
    <div className="relative w-6 h-6 flex-shrink-0">
      <svg width="24" height="24" viewBox="0 0 24 24" className="absolute inset-0"
        style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx="12" cy="12" r={R} fill="none" stroke="currentColor" strokeWidth="2"
          className="text-[color:var(--color-surface-3)] opacity-60" />
        <circle cx="12" cy="12" r={R} fill="none" strokeWidth="2"
          className="text-[color:var(--color-accent)]"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - progress / 100)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease', opacity: isCompleted ? 1 : 0.5 }} />
      </svg>
      {isCompleted && (
        <CheckCircle className="w-3 h-3 absolute inset-0 m-auto text-[color:var(--color-accent)]" />
      )}
    </div>
  );
};

// ── ExpandingCard overlay ─────────────────────────────────────────────────
const ExpandingCard = ({ module, originRect, isCompleted, onClose, onRead }) => {
  const [phase, setPhase] = useState("enter");
  const vw         = window.innerWidth;
  const vh         = window.innerHeight;
  const expandedW  = Math.min(440, vw - 32);
  const expandedH  = Math.min(572, vh - 64);
  const expandedT  = Math.max(16, (vh - expandedH) / 2);
  const expandedL  = (vw - expandedW) / 2;
  const difficulty = getDifficultyConfig(module.difficulty);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("open")));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = () => { setPhase("closing"); setTimeout(onClose, 300); };
  const atOrigin    = phase === "enter" || phase === "closing";
  const isOpen      = phase === "open";
  const contentDelay = Math.round(460 * 0.38);

  const panelStyle = {
    position: "fixed", zIndex: 50,
    top:    atOrigin ? originRect.top    : expandedT,
    left:   atOrigin ? originRect.left   : expandedL,
    width:  atOrigin ? originRect.width  : expandedW,
    height: atOrigin ? originRect.height : expandedH,
    overflow: "hidden",
    background: 'var(--color-surface)',
    border: '1px solid var(--color-hairline)',
    transition: phase === "enter" ? "none" : phase === "open"
      ? `top 460ms cubic-bezier(0.16,1,0.3,1), left 460ms cubic-bezier(0.16,1,0.3,1), width 460ms cubic-bezier(0.16,1,0.3,1), height 460ms cubic-bezier(0.16,1,0.3,1), box-shadow 460ms cubic-bezier(0.16,1,0.3,1)`
      : `top 300ms cubic-bezier(0.4,0,0.2,1), left 300ms cubic-bezier(0.4,0,0.2,1), width 300ms cubic-bezier(0.4,0,0.2,1), height 300ms cubic-bezier(0.4,0,0.2,1), box-shadow 300ms cubic-bezier(0.4,0,0.2,1)`,
    boxShadow: isOpen
      ? "0 25px 60px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)"
      : "0 4px 16px -4px rgba(0,0,0,0.12)",
  };

  const contentStyle = {
    transition: isOpen
      ? `opacity 220ms ease-out ${contentDelay}ms, transform 320ms cubic-bezier(0.16,1,0.3,1) ${contentDelay}ms`
      : "opacity 90ms ease-in, transform 90ms ease-in",
    opacity:   isOpen ? 1 : 0,
    transform: isOpen ? "translateY(0)" : "translateY(7px)",
  };

  return (
    <>
      <div
        style={{ transition: `opacity ${isOpen ? 253 : 300}ms cubic-bezier(0.16,1,0.3,1)`, opacity: isOpen ? 1 : 0 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={handleClose}
      />
      <div style={panelStyle}>
        <div style={contentStyle} className="h-full flex flex-col">

          {/* Header */}
          <div className="flex items-start justify-between p-6 pb-4 flex-shrink-0">
            <div>
              <p className="mod-modal-eyebrow">
                Module {module.id}
              </p>
              <h2 className="mod-modal-title">
                {module.title}
              </h2>
            </div>
            <button onClick={handleClose} style={{ padding: 6, color: 'var(--color-fg-muted)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, marginLeft: 8, lineHeight: 0, transition: 'color 120ms ease' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--color-fg)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-fg-muted)'}
            >
              <X size={16} />
            </button>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 px-6 pb-4 flex-shrink-0 flex-wrap">
            <span className="mod-card-tag">{difficulty.label}</span>
            <span className="mod-card-tag"><Clock size={10} />~{module.estimated_duration} mins</span>
            <span className="mod-card-tag"><Hash size={10} />{module.sections.length} sections</span>
            {isCompleted && (
              <span className="mod-card-tag" style={{ color: 'var(--color-accent)', borderColor: 'var(--color-accent)' }}>
                <CheckCircle size={10} /> Completed
              </span>
            )}
          </div>

          {/* Description */}
          <div className="px-6 pb-4 flex-shrink-0">
            <p className="mod-modal-desc">
              {module.description}
            </p>
          </div>

          <div style={{ height: 1, background: 'var(--color-hairline)', margin: '0 24px', flexShrink: 0 }} />

          {/* Table of contents */}
          <div className="px-6 pt-4 pb-2 flex-1 overflow-y-auto min-h-0">
            <p className="mod-modal-contents-label">
              Contents
            </p>
            <ol>
              {module.sections.map((section, i) => (
                <li key={section.id} className="mod-modal-section-item">
                  <span className="mod-modal-section-num">
                    {i + 1}
                  </span>
                  <span className="mod-modal-section-label">
                    {section.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* CTA */}
          <div className="p-6 pt-4 flex-shrink-0">
            <button className="mod-expand-cta" onClick={() => onRead(module.id)}>
              {isCompleted ? "Review Module" : "Read Module"}
              <ArrowRight size={14} />
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

// ── Module Card ───────────────────────────────────────────────────────────
const ModuleCard = ({ module, isCompleted, readingProgress, onSelect }) => {
  const cardRef    = useRef(null);
  const contentRef = useRef(null);
  const difficulty = getDifficultyConfig(module.difficulty);

  const handleClick = () => {
    const el = cardRef.current, content = contentRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (content) {
      content.style.transition = "none";
      content.style.opacity    = "0";
      content.style.transform  = "translateY(5px)";
    }
    el.style.visibility = "hidden";
    onSelect(module, rect, () => {
      el.style.visibility = "";
      requestAnimationFrame(() => {
        if (content) {
          content.style.transition = `opacity 180ms ease-out, transform 180ms cubic-bezier(0.16,1,0.3,1)`;
          content.style.opacity    = "1";
          content.style.transform  = "translateY(0)";
        }
      });
    });
  };

  const progressPct = readingProgress ?? 0;
  const statusKey   = isCompleted ? 'done' : progressPct > 0 ? 'progress' : 'none';
  const statusLabel = { done: 'Read', progress: 'In progress', none: 'Not started' }[statusKey];
  const ctaLabel    = isCompleted ? 'Review' : progressPct > 0 ? 'Continue' : 'Start';

  return (
    <div
      ref={cardRef}
      className="mod-card"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
    >
      <div ref={contentRef}>
        <div className="mod-card-top">
          <span className="mod-card-num">{String(module.id).padStart(2, '0')}</span>
          <div className="mod-card-status">
            <span className={`mod-status-dot mod-status-dot--${statusKey}`} />
            <span className={`mod-status-label mod-status-label--${statusKey}`}>{statusLabel}</span>
          </div>
        </div>

        <h3 className="mod-card-title">{module.title}</h3>
        <p className="mod-card-desc">{module.description}</p>

        <div className="mod-card-tags">
          <span className="mod-card-tag">{difficulty.label}</span>
          <span className="mod-card-tag"><Clock size={10} />{module.estimated_duration} min</span>
          <span className="mod-card-tag">{module.sections.length} sections</span>
        </div>

        <div className="mod-card-footer">
          <div className="mod-card-bar"><i style={{ width: `${progressPct}%` }} /></div>
          <span className="mod-card-pct">{progressPct}%</span>
          <span className="mod-card-cta">{ctaLabel} <ArrowRight size={10} /></span>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────
const Modules = () => {
  const navigate = useNavigate();
  const { user } = useContext(AppContext);
  const userId   = user?.id ?? 'anon';

  const [moduleProgress,     setModuleProgress]     = useState({});
  const [fetchError,         setFetchError]         = useState(false);
  const [loading,            setLoading]            = useState(true);
  const [readingProgressMap, setReadingProgressMap] = useState({});
  const [filter,             setFilter]             = useState('all');
  const [selected,           setSelected]           = useState(null);
  const restoreRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => { fetchModuleProgress(); }, []);

  useEffect(() => {
    if (contentRef.current && !loading) {
      gsap.fromTo(contentRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
    }
  }, [loading]);

  const fetchModuleProgress = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const res = await axios.get(`${API_URL}/api/module/module-progress`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const map = {};
      res.data.forEach(p => { map[p.module_id] = p.completed; });
      setModuleProgress(map);
      setFetchError(false);
    } catch {
      toast.error("Failed to load module progress.");
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const readMap = {};
    MODULES_META.forEach(mod => {
      try {
        const raw = localStorage.getItem(`reader_progress_${userId}_${mod.id}`);
        if (raw) {
          const data     = JSON.parse(raw);
          const sections = Array.isArray(data.readSections) ? data.readSections : [];
          readMap[mod.id] = sections.length > 0 && mod.sections.length > 0
            ? Math.round((sections.length / mod.sections.length) * 100) : 0;
        } else {
          readMap[mod.id] = 0;
        }
      } catch { readMap[mod.id] = 0; }
    });
    setReadingProgressMap(readMap);
  }, [userId, moduleProgress]);

  const completedCount = Object.values(moduleProgress).filter(Boolean).length;
  const xpInfo         = computeXP(user?.xp_points || 0);

  const getStatus = (modId) => {
    if (moduleProgress[modId]) return 'completed';
    if ((readingProgressMap[modId] ?? 0) > 0) return 'in-progress';
    return 'not-started';
  };

  const filteredModules = MODULES_META.filter(mod =>
    filter === 'all' ? true : getStatus(mod.id) === filter
  );

  const handleSelect = (module, rect, restore) => {
    restoreRef.current = restore;
    setSelected({ module, rect });
  };
  const handleClose = () => {
    restoreRef.current?.();
    restoreRef.current = null;
    setSelected(null);
  };

  const FILTERS = [
    { key: 'all',         label: 'All' },
    { key: 'not-started', label: 'Not Started' },
    { key: 'in-progress', label: 'In Progress' },
    { key: 'completed',   label: 'Completed' },
  ];

  if (loading) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--color-surface-3)] border-t-[color:var(--color-accent)] animate-spin" />
        <p className="text-[12px] uppercase tracking-[0.16em] ink-faint">Loading modules…</p>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div ref={contentRef} className="px-8 lg:px-10 py-8 lg:py-10" style={{ opacity: 0 }}>

        <header className="mod-ph">
          <h1 className="mod-ph-title">Learning <span className="it">Modules.</span></h1>
          <div className="mod-ph-sub">
            <span><b>{completedCount}</b> of {MODULES_META.length} completed</span>
            <span className="sep" />
            <span>Lv.{xpInfo.level} · <span className="mod-ph-xp">{(user?.xp_points || 0).toLocaleString()} XP</span></span>
          </div>
          <div className="mod-overall-bar">
            <i style={{ width: `${(completedCount / MODULES_META.length) * 100}%` }} />
          </div>
        </header>

        <div className="mod-filter-rail">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`mod-filter-pill${filter === f.key ? ' active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {fetchError && (
          <div className="mod-error">
            Could not load module progress.
            <button onClick={fetchModuleProgress}>Retry</button>
          </div>
        )}

        <div className="mod-grid">
          {filteredModules.length === 0
            ? <div className="mod-empty">No modules match that filter.</div>
            : filteredModules.map(module => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  isCompleted={!!moduleProgress[module.id]}
                  readingProgress={readingProgressMap[module.id] || 0}
                  onSelect={handleSelect}
                />
              ))
          }
        </div>

      </div>

      {selected && (
        <ExpandingCard
          module={selected.module}
          originRect={selected.rect}
          isCompleted={!!moduleProgress[selected.module.id]}
          onClose={handleClose}
          onRead={(id) => { handleClose(); navigate(`/student/modules/${id}`); }}
        />
      )}
    </div>
  );
};

export default Modules;
