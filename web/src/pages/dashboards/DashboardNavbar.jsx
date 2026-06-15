// file path: web/src/pages/dashboards/DashboardNavbar.jsx
//
// Owns: breadcrumb resolution, notification bell (full list + unread badge),
//       theme toggle, and sidebar-toggle button (with GSAP scaleX flip).
//
// Does NOT own: logout — that lives in the sidebar footer strip in StudentDashboard.jsx.
// Does NOT own: user identity display — that's the SidebarUserBlock in StudentDashboard.jsx.
//
// GSAP micro-animation (toggle icon):
// ─────────────────────────────────────
// The PanelLeft icon is wrapped in a <span ref={panelIconRef}>.
// On mount, useLayoutEffect sets scaleX to the correct initial state
// synchronously (before paint) so there is no flash of the wrong orientation.
// On every subsequent sidebarOpen change, useEffect drives a smooth scaleX
// tween via GSAP:
//   scaleX( 1) = sidebar open  → icon in its natural left-panel orientation
//   scaleX(-1) = sidebar closed → icon mirrored, signalling "panel is hidden"
// This is the same pattern used by VS Code / Linear for their sidebar toggles.

import { useState, useContext, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import {
  Bell, BellOff, X, CheckCheck,
  CheckCircle2,
  Moon, Sun,
  PanelLeft, Search,
} from 'lucide-react';
import axios from 'axios';
import { AppContext }  from '../../context/AppContext';
import { ThemeContext } from '../../context/ThemeContext';
import { NOTIFICATION_CONFIG, formatTimeAgo } from '../../constants/notifications';

const API_URL = import.meta.env.VITE_API_URL;

// Page breadcrumb metadata keyed by exact pathname.
// section: de-emphasised label above the page title (can be null).
// title:   the dominant page anchor shown at 15px semibold.
const PAGE_META = {
  '/student':                { section: null,       title: 'Overview'       },
  '/student/courses':        { section: 'Study',    title: 'Courses'        },
  '/student/modules':        { section: 'Study',    title: 'Modules'        },
  '/student/quizzes':        { section: 'Study',    title: 'Quizzes'        },
  '/student/deboning-guide': { section: 'Study',    title: 'Deboning Guide' },
  '/student/simulator':      { section: 'Practice', title: 'Simulator'      },
  '/student/leaderboard':    { section: 'Compete',  title: 'Leaderboard'    },
  '/student/profile':        { section: null,       title: 'Profile'        },
  '/student/settings':       { section: null,       title: 'Settings'       },

  '/instructor/dashboard':         { section: null, title: 'Overview' },
  '/instructor/dashboard/profile': { section: null, title: 'Profile'  },

  '/admin/dashboard':              { section: null, title: 'Overview' },
  '/admin/dashboard/profile':      { section: null, title: 'Profile'  },
};

// Resolves breadcrumb section + page title from the current pathname.
// Falls back to a capitalised slug for any unregistered route.
const resolveMeta = (pathname) => {
  if (PAGE_META[pathname]) return PAGE_META[pathname];

  // Dynamic segments — derive a sensible label without listing every possible ID.
  if (/^\/student\/modules\/[^/]+$/.test(pathname))
    return { section: 'Study', title: 'Module' };
  if (/^\/student\/quizzes\/[^/]+$/.test(pathname))
    return { section: 'Study', title: 'Quiz' };
  if (/^\/student\/courses\/[^/]+$/.test(pathname))
    return { section: 'Study', title: 'Course' };

  // Generic fallback — capitalise the last path segment.
  const seg   = pathname.split('/').filter(Boolean).pop() || 'dashboard';
  const title = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
  return { section: null, title };
};

// Reusable square icon-only toolbar button class.
const ICON_BTN =
  'w-8 h-8 flex items-center justify-center rounded-md hover:bg-[color:var(--color-surface-2)] transition-colors';

// How recently a full list fetch must have completed before we skip a re-fetch on bell open.
const NOTIF_STALE_MS = 10_000;

// ── DashboardNavbar ──────────────────────────────────────────────────────────
// `sidebarOpen`  — passed from StudentDashboard; drives the GSAP scaleX flip.
// `onSidebarToggle` — callback to toggle the sidebar in StudentDashboard.
const DashboardNavbar = ({ sidebarOpen, onSidebarToggle }) => {
  const { user }                    = useContext(AppContext);
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const location                    = useLocation();
  const navigate                    = useNavigate();

  const [notifOpen,    setNotifOpen]    = useState(false);
  const [notifTab,     setNotifTab]     = useState('all');
  const [notifs,       setNotifs]       = useState([]);
  const [unread,       setUnread]       = useState(0);
  const [notifLoading, setNotifLoading] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const notifRef = useRef(null);

  // Tracks when the notification list was last fetched so we avoid redundant
  // re-fetches when the bell is opened in quick succession.
  const lastFetchedAtRef = useRef(0);

  // Ref for the PanelLeft wrapper — GSAP targets this element for scaleX animation.
  const panelIconRef = useRef(null);

  const { section: pageSection, title: pageTitle } = resolveMeta(location.pathname);

  // Memoised view of the notification list for the active tab.
  const visibleNotifs = useMemo(
    () => notifTab === 'unread' ? notifs.filter(n => !n.is_read) : notifs,
    [notifs, notifTab]
  );

  // ── GSAP: set initial scaleX synchronously before paint ─────────────────
  // Using useLayoutEffect ensures the icon starts in the correct orientation
  // (mirrored if sidebar is closed) without any flash of the default state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!panelIconRef.current) return;
    gsap.set(panelIconRef.current, { scaleX: sidebarOpen ? 1 : -1 });
  }, []); // intentional empty deps — runs once on mount to set initial state

  // ── GSAP: animate scaleX on every sidebarOpen toggle ────────────────────
  // scaleX( 1) = sidebar open  (natural orientation — left panel highlighted)
  // scaleX(-1) = sidebar closed (horizontally mirrored — signals "panel hidden")
  // Tween is killed on cleanup to prevent stale animations if the component
  // unmounts mid-animation (e.g., navigating away while the sidebar is toggling).
  useEffect(() => {
    if (!panelIconRef.current) return;
    const tween = gsap.to(panelIconRef.current, {
      scaleX:   sidebarOpen ? 1 : -1,
      duration: 0.22,
      ease:     'power2.inOut',
    });
    return () => tween.kill();
  }, [sidebarOpen]);

  // Fetches the count-only endpoint and updates the unread badge.
  // This is the single source of truth for `unread` — never derive it from the list.
  const fetchUnreadCount = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/notifications/unread-count`);
      setUnread(Number(res.data.count));
    } catch { /* silent — stale badge stays visible */ }
  };

  // Fetches the full notification list without touching the unread count.
  // Updates lastFetchedAtRef so the bell-open staleness guard works correctly.
  const fetchNotifs = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/notifications`);
      setNotifs(res.data.notifications);
      lastFetchedAtRef.current = Date.now();
    } catch { /* silent — stale list stays visible */ }
  };

  // Mount: parallel fetch of list + count so the badge and panel are both
  // fresh immediately on render without a waterfall.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [listRes, countRes] = await Promise.all([
          axios.get(`${API_URL}/api/notifications`),
          axios.get(`${API_URL}/api/notifications/unread-count`),
        ]);
        if (cancelled) return;
        setNotifs(listRes.data.notifications);
        setUnread(Number(countRes.data.count));
        lastFetchedAtRef.current = Date.now();
      } catch {
        if (!cancelled) { setNotifs([]); setUnread(0); }
      } finally {
        if (!cancelled) setNotifLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Bell-open effect: re-fetch the full list only if it has gone stale.
  // Cheap re-opens (< NOTIF_STALE_MS) reuse the cached list.
  useEffect(() => {
    if (!notifOpen) return;
    const now = Date.now();
    if (now - lastFetchedAtRef.current < NOTIF_STALE_MS) return;
    fetchNotifs();
  }, [notifOpen]);

  // Polling: count only — cheap, runs every 30 s while the tab is visible.
  // Tab-focus handler catches re-activations mid-session.
  useEffect(() => {
    const onFocus = () => fetchUnreadCount();
    window.addEventListener('focus', onFocus);
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchUnreadCount();
    }, 30_000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(id); };
  }, []);

  // Closes the notification panel when a click lands outside its ref.
  useEffect(() => {
    const handler = e => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Optimistically marks a notification as read; reverts on API failure.
  const handleNotifClick = async (notif) => {
    if (!notif.is_read) {
      const prevNotifs = notifs;
      const prevUnread = unread;
      setUnread(prev => Math.max(0, prev - 1));
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      try {
        await axios.patch(`${API_URL}/api/notifications/${notif.id}/read`);
      } catch {
        setUnread(prevUnread);
        setNotifs(prevNotifs);
      }
    }
    if (notif.link) { setNotifOpen(false); navigate(notif.link); }
  };

  // Optimistically marks all notifications as read; reverts on API failure.
  const handleMarkAllRead = async () => {
    if (isMarkingAllRead) return;
    const prevNotifs = notifs;
    const prevUnread = unread;
    setUnread(0);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    setIsMarkingAllRead(true);
    try {
      await axios.patch(`${API_URL}/api/notifications/read-all`);
    } catch {
      setUnread(prevUnread);
      setNotifs(prevNotifs);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  // Optimistically removes a notification from the list; reverts on API failure.
  const handleDismiss = async (e, notif) => {
    e.stopPropagation();
    const prevNotifs = notifs;
    if (!notif.is_read) setUnread(prev => Math.max(0, prev - 1));
    setNotifs(prev => prev.filter(n => n.id !== notif.id));
    try {
      await axios.delete(`${API_URL}/api/notifications/${notif.id}`);
    } catch {
      setNotifs(prevNotifs);
      if (!notif.is_read) setUnread(prev => prev + 1);
    }
  };

  // Prevents a re-render-induced tab flash when clicking the already-active tab.
  const handleTabChange = (tab) => {
    if (tab === notifTab) return;
    setNotifTab(tab);
  };

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] h-[var(--shell-rail-h)] flex items-center justify-between px-4 lg:px-6 bg-[color:var(--color-shell-rail)] border-b hairline flex-shrink-0">

      {/* ── Left — sidebar toggle + breadcrumb ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={onSidebarToggle}
          aria-label="Toggle sidebar"
          aria-expanded={sidebarOpen}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className={ICON_BTN}
        >
          {/* Wrapper span carries the GSAP scaleX transform.
              Wrapping the Lucide SVG in a span avoids potential ref-forwarding
              issues across Lucide versions and keeps the animation target clear. */}
          <span ref={panelIconRef} style={{ display: 'inline-flex' }}>
            <PanelLeft className="w-4 h-4 ink-muted" />
          </span>
        </button>

        {/* Breadcrumb — stacked layout: de-emphasised section label above,
            dominant page title below. Both collapse gracefully when section is null. */}
        <div className="flex flex-col justify-center relative top-px">
          {pageSection && (
            <span className="text-[9px] uppercase tracking-[0.2em] ink-faint font-medium leading-none mb-0.5">
              {pageSection}
            </span>
          )}
          <span className="text-[15px] font-semibold ink leading-none">
            {pageTitle}
          </span>
        </div>
      </div>

      {/* ── Right — notifications + theme toggle ── */}
      <div className="flex items-center gap-1">

        {/* Notification bell */}
        <div ref={notifRef} className="relative">
          <button
            data-tour="notifications"
            onClick={() => setNotifOpen(!notifOpen)}
            aria-label="Notifications"
            aria-expanded={notifOpen}
            className={`${ICON_BTN} relative`}
          >
            <Bell className="w-4 h-4 ink-muted" />
            {/* Unread badge — hidden when count is zero */}
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[color:var(--color-accent)] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            // Stronger border + shadow so the panel reads clearly as a floating layer
            // on the warm paper background where a hairline alone would disappear.
            <div className="absolute right-0 top-full mt-2 w-[340px] bg-[color:var(--color-surface)] border border-[color:var(--color-border-strong)] shadow-xl shadow-black/[0.08] rounded-md anim-dropdown z-[var(--z-dropdown)] overflow-hidden">

              {/* Panel header row */}
              <div className="flex items-center justify-between px-4 py-3 border-b hairline">
                <span className="text-[11px] uppercase tracking-[0.18em] font-semibold ink">Notifications</span>
                {unread > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={isMarkingAllRead}
                    className="flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] notif-secondary-action hover:text-[color:var(--color-accent)] transition-colors disabled:opacity-50"
                  >
                    <CheckCheck className="w-3 h-3" />
                    {isMarkingAllRead ? 'Marking…' : 'Mark all read'}
                  </button>
                )}
              </div>

              {/* All / Unread tabs */}
              <div className="flex border-b hairline">
                {['all', 'unread'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`flex-1 py-2.5 text-[10px] uppercase tracking-[0.16em] transition-colors flex items-center justify-center gap-1.5 ${
                      notifTab === tab
                        ? 'ink font-semibold border-b-2 border-[color:var(--color-accent)]'
                        : 'ink-faint hover:text-[color:var(--color-fg-muted)]'
                    }`}
                  >
                    {tab}
                    {/* Unread pill — only shown on the 'unread' tab when there are items */}
                    {tab === 'unread' && unread > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] text-[9px] font-semibold">
                        {unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Notification list */}
              <div className="max-h-[360px] overflow-y-auto divide-y hairline">
                {notifLoading ? (
                  // Loading spinner — minimal, centered
                  <div className="py-10 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full border-2 border-[color:var(--color-surface-3)] border-t-[color:var(--color-accent)] animate-spin" />
                  </div>
                ) : visibleNotifs.length === 0 ? (
                  // Empty state — contextual copy for tab in view
                  <div className="py-10 flex flex-col items-center gap-2 text-center px-6">
                    {notifTab === 'unread' ? (
                      <>
                        <CheckCircle2 className="w-8 h-8 ink-faint opacity-40 mb-1" />
                        <p className="text-[13px] font-medium ink">All caught up</p>
                        <p className="text-[12px] ink-muted">No unread notifications.</p>
                      </>
                    ) : (
                      <>
                        <BellOff className="w-8 h-8 ink-faint opacity-40 mb-1" />
                        <p className="text-[13px] font-medium ink">No notifications yet</p>
                        <p className="text-[12px] ink-muted">You'll see updates here when activity happens.</p>
                      </>
                    )}
                  </div>
                ) : (
                  visibleNotifs.map(notif => {
                    const cfg  = NOTIFICATION_CONFIG[notif.type] || NOTIFICATION_CONFIG.default;
                    const Icon = cfg.icon;
                    return (
                      <div key={notif.id} className="group relative flex items-start">
                        <button
                          onClick={() => handleNotifClick(notif)}
                          className={`flex-1 flex items-start gap-3 px-4 py-3 transition-colors text-left hover:bg-[color:var(--color-surface-2)] ${
                            !notif.is_read ? 'bg-[color:var(--color-accent-soft)]/20' : ''
                          }`}
                        >
                          {/* Unread dot stacked above the notification type icon */}
                          <span className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0 w-4">
                            {!notif.is_read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-accent)]" />
                            )}
                            <Icon className="w-4 h-4 ink-faint" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium ink leading-snug">{notif.title}</p>
                            <p className="text-[12px] ink-muted leading-relaxed mt-0.5">{notif.message}</p>
                            <p className="text-[10px] ink-faint mt-1 uppercase tracking-[0.1em]">
                              {formatTimeAgo(notif.created_at)}
                            </p>
                          </div>
                        </button>

                        {/* Dismiss — only visible on row hover */}
                        <button
                          onClick={e => handleDismiss(e, notif)}
                          title="Dismiss"
                          className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded flex items-center justify-center hover:bg-[color:var(--color-surface-3)] ink-muted"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle — sun / moon with icon-swap animation */}
        <button data-tour="theme" onClick={toggleTheme} aria-label="Toggle theme" className={ICON_BTN}>
          {isDarkMode
            ? <Sun  key="sun"  className="w-4 h-4 ink-muted anim-icon" />
            : <Moon key="moon" className="w-4 h-4 ink-muted anim-icon" />
          }
        </button>

        {/* Logout intentionally removed from the navbar.
            Session management (logout button + confirmation modal) lives in
            the sidebar footer strip inside StudentDashboard.jsx. */}
      </div>
    </header>
  );
};

export default DashboardNavbar;