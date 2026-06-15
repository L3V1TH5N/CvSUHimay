// file path: web/src/pages/dashboards/StudentDashboard.jsx

import { useContext, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { AppContext }   from '../../context/AppContext';
import { ThemeContext } from '../../context/ThemeContext';
import {
  LayoutDashboard, BookOpen, ClipboardList, FileText,
  Gamepad2, Trophy, GraduationCap,
  Settings, LogOut, Flame, ChevronRight,
} from 'lucide-react';
import { computeXP, rankAccent } from '../../utils/xp';
import DashboardNavbar    from './DashboardNavbar';
import Onboarding         from './student/onboarding/Onboarding';
import LogoutConfirmModal from './components/modals/LogoutConfirmationModal';
import UserAvatar from '../../components/UserAvatar';

// Single source of truth for the sidebar animation duration.
const SIDEBAR_TRANSITION_MS = 200;

// Persists the sidebar collapsed state to localStorage across reloads.
const useSidebarPref = () => {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('cvsuhimay.sidebar.collapsed') === 'true'; }
    catch { return false; }
  });
  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('cvsuhimay.sidebar.collapsed', String(next)); }
      catch { /* storage blocked */ }
      return next;
    });
  };
  return [collapsed, toggleCollapsed];
};

// Returns true for module reader routes where the entire shell is hidden.
const isReaderRoute = (pathname) =>
  /^\/student\/modules\/[^/]+/.test(pathname);

// Nav groups
const NAV_GROUPS = [
  {
    label: 'Study',
    items: [
      { name: 'Overview',       tourId: 'overview',       path: '/student',               icon: LayoutDashboard, end: true },
      { name: 'Courses',        tourId: 'courses',        path: '/student/courses',        icon: GraduationCap },
      { name: 'Modules',        tourId: 'modules',        path: '/student/modules',        icon: BookOpen      },
      { name: 'Quizzes',        tourId: 'quizzes',        path: '/student/quizzes',        icon: ClipboardList },
      { name: 'Deboning Guide', tourId: 'deboning-guide', path: '/student/deboning-guide', icon: FileText      },
    ],
  },
  {
    label: 'Practice',
    items: [
      { name: 'Simulator', tourId: 'simulations', path: '/student/simulator', icon: Gamepad2 },
    ],
  },
  {
    label: 'Progress',
    items: [
      { name: 'Leaderboard', tourId: 'leaderboard', path: '/student/leaderboard', icon: Trophy },
    ],
  },
];

const BOTTOM_NAV_ITEMS = [
  { name: 'Settings', tourId: 'settings', path: '/student/settings', icon: Settings },
];

// Flat index map for GSAP stagger
const NAV_ITEM_INDICES = new Map(
  [
    ...NAV_GROUPS.flatMap(g => g.items),
    ...BOTTOM_NAV_ITEMS,
    { name: '__logout__' },
  ].map((item, i) => [item.name, i])
);

const useLabelAnimation = (collapsed, index) => {
  const labelRef      = useRef(null);
  const isFirstRender = useRef(true);

  useLayoutEffect(() => {
    if (!labelRef.current) return;
    gsap.set(labelRef.current, { opacity: collapsed ? 0 : 1, x: 0 });
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!labelRef.current) return;

    if (collapsed) {
      const tween = gsap.to(labelRef.current, {
        opacity:  0,
        x:       -6,
        duration: 0.15,
        ease:     'power2.in',
      });
      return () => tween.kill();
    } else {
      const tween = gsap.to(labelRef.current, {
        opacity:  1,
        x:        0,
        duration: 0.2,
        delay:    index * 0.03,
        ease:     'power2.out',
      });
      return () => tween.kill();
    }
  }, [collapsed, index]);

  return labelRef;
};

const SidebarTooltip = ({ text, rect, container }) => {
  if (!rect || !text || !container) return null;
  return createPortal(
    <div
      style={{
        position:      'fixed',
        left:          rect.right + 10,
        top:           rect.top + rect.height / 2,
        transform:     'translateY(-50%)',
        zIndex:        9999,
        pointerEvents: 'none',
      }}
      className="bg-[color:var(--color-surface)] border border-[color:var(--color-border-strong)] shadow-lg px-3 py-1.5 text-[12px] ink whitespace-nowrap rounded-md"
    >
      {text}
    </div>,
    container
  );
};

const NavItem = ({ item, collapsed, index = 0, showTooltips, onTooltipEnter, onTooltipLeave }) => {
  const Icon = item.icon;
  const labelRef = useLabelAnimation(collapsed, index);

  return (
    <NavLink
      to={item.path}
      end={item.end}
      data-tour={item.tourId}
      onMouseEnter={e => { if (showTooltips) onTooltipEnter(e, item.name); }}
      onMouseLeave={() => { if (showTooltips) onTooltipLeave(); }}
      aria-label={item.name}
      className={({ isActive }) =>
        `cursor-pointer flex items-center py-2 text-[13.5px] border-l-[3px] ${
          isActive
            ? 'border-[color:var(--color-accent)] bg-[color:var(--color-surface-3)] ink font-medium'
            : 'border-transparent ink-muted hover:bg-[color:var(--color-surface-3)] hover:border-[color:var(--color-surface-3)]'
        }`
      }
      style={{
        paddingLeft:  collapsed ? 21 : 16,
        paddingRight: collapsed ? 0  : 16,
        gap:          collapsed ? 0  : 10,
        transition: [
          `padding-left  ${SIDEBAR_TRANSITION_MS}ms ease`,
          `padding-right ${SIDEBAR_TRANSITION_MS}ms ease`,
          `gap           ${SIDEBAR_TRANSITION_MS}ms ease`,
          'background-color 150ms ease',
          'border-color     150ms ease',
          'color            150ms ease',
        ].join(', '),
      }}
    >
      {({ isActive }) => (
        <>
          <Icon strokeWidth={isActive ? 2.25 : 1.75} className="w-4 h-4 flex-shrink-0" />
          <span
            ref={labelRef}
            className="whitespace-nowrap"
            style={{
              maxWidth:      collapsed ? 0   : 200,
              overflow:      'hidden',
              transition:    `max-width ${SIDEBAR_TRANSITION_MS}ms ease`,
              display:       'inline-block',
              pointerEvents: 'none',
            }}
          >
            {item.name}
          </span>
        </>
      )}
    </NavLink>
  );
};


const AvatarRing = ({ user, xpInfo }) => {
  const R    = 15;
  const CIRC = 2 * Math.PI * R;
  const offset      = CIRC * (1 - xpInfo.progress);
  const accentColor = rankAccent(xpInfo.level).token;

  return (
    <div className="relative w-9 h-9 flex-shrink-0">
      <svg
        width="36" height="36" viewBox="0 0 36 36"
        className="absolute inset-0"
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        <circle
          cx="18" cy="18" r={R}
          fill="none" stroke="currentColor" strokeWidth="2"
          className="text-[color:var(--color-surface-3)] opacity-60"
        />
        <circle
          cx="18" cy="18" r={R}
          fill="none" strokeWidth="2" stroke={accentColor}
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={`${offset}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-[3px] rounded-full overflow-hidden">
        <UserAvatar user={user} size={30} ring={false} />
      </div>
    </div>
  );
};

const SidebarUserBlock = ({ user, collapsed }) => {
  const xpInfo      = computeXP(user?.xp_points || 0);
  const accentColor = rankAccent(xpInfo.level).token;
  const displayName = user?.full_name?.split(' ')[0] || user?.email || 'Student';
  const xpPercent   = Math.round(xpInfo.progress * 100);
  const streak      = user?.current_streak ?? 0;

  return (
    <NavLink
      to="/student/profile"
      data-tour="profile"
      className={({ isActive }) =>
        `block transition-colors group ${
          isActive
            ? 'bg-[color:var(--color-surface-2)]'
            : 'hover:bg-[color:var(--color-surface-2)]'
        }`
      }
    >
      <div className="relative overflow-hidden" style={{ height: 92 }}>
        {/* Expanded layer */}
        <div
          className="absolute inset-0 px-4 py-3.5"
          style={{
            opacity:       collapsed ? 0 : 1,
            transition:    `opacity ${SIDEBAR_TRANSITION_MS}ms ease`,
            pointerEvents: collapsed ? 'none' : 'auto',
          }}
        >
          <div className="flex items-center gap-2.5 mb-2.5">
            <UserAvatar user={user} size={32} ring={false} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold ink truncate leading-none">{displayName}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <p
                  className="text-[10px] font-semibold leading-none uppercase tracking-[0.08em] shrink-0"
                  style={{ color: accentColor }}
                >
                  Lv.{xpInfo.level}
                </p>
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-[0.08em] leading-none shrink-0"
                  style={{
                    color:           accentColor,
                    backgroundColor: `${accentColor}18`,
                    border:          `1px solid ${accentColor}30`,
                  }}
                >
                  {xpInfo.rank}
                </span>
                {streak > 0 && (
                  <span className="flex items-center gap-0.5 shrink-0">
                    <Flame className="w-2.5 h-2.5" strokeWidth={2.25} style={{ color: 'var(--color-flame)' }} />
                    <span className="text-[10px] font-semibold tabular-nums leading-none" style={{ color: 'var(--color-flame)' }}>
                      {streak}
                    </span>
                  </span>
                )}
              </div>
            </div>
            <ChevronRight
              className="w-3.5 h-3.5 ink-faint flex-shrink-0 transition-opacity opacity-25 group-hover:opacity-70"
              strokeWidth={2}
            />
          </div>
          <div>
            <div className="h-[5px] rounded-full bg-[color:var(--color-surface-3)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width:           `${xpPercent}%`,
                  backgroundColor: accentColor,
                  transition:      'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />
            </div>
            <p className="text-[10px] ink-faint mt-1 tabular-nums leading-none">
              {xpInfo.xpIntoLevel}
              <span className="opacity-40 mx-0.5">/</span>
              {xpInfo.xpNeeded} XP
            </p>
          </div>
        </div>

        {/* Collapsed layer */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1"
          style={{
            opacity:       collapsed ? 1 : 0,
            transition:    `opacity ${SIDEBAR_TRANSITION_MS}ms ease`,
            pointerEvents: collapsed ? 'auto' : 'none',
          }}
        >
          <AvatarRing user={user} xpInfo={xpInfo} />
          <span
            className="text-[9px] font-bold tabular-nums leading-none"
            style={{ color: accentColor }}
          >
            {xpInfo.level}
          </span>
        </div>
      </div>
    </NavLink>
  );
};

// Tooltip delay helper
const useDelayedTooltip = () => {
  const timeoutRef = useRef(null);
  const handleEnter = (e, text, setTooltip) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({ visible: true, text, rect });
    }, 300);
  };
  const handleLeave = (setTooltip) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setTooltip({ visible: false, text: '', rect: null });
  };
  return { handleEnter, handleLeave };
};

const StudentDashboard = () => {
  const { user, logout }  = useContext(AppContext);
  const { readerMode }    = useContext(ThemeContext);
  const navigate          = useNavigate();

  const [collapsed, toggleCollapsed] = useSidebarPref();
  const [isMobile,  setIsMobile]     = useState(() => window.innerWidth < 768);
  const [sheetOpen, setSheetOpen]    = useState(false);

  const [showLogoutModal,       setShowLogoutModal]       = useState(false);
  const [tooltip,               setTooltip]               = useState({ visible: false, text: '', rect: null });
  const [tooltipContainer,      setTooltipContainer]      = useState(null);
  const [showOnboarding,        setShowOnboarding]        = useState(false);
  const [onboardingInitialStep, setOnboardingInitialStep] = useState('welcome');

  const onboardingChecked = useRef(false);
  const touchStartX       = useRef(null);
  const location          = useLocation();
  const inReader          = readerMode || isReaderRoute(location.pathname);

  const effectiveCollapsedForHook = isMobile ? false : collapsed;
  const logoutLabelRef = useLabelAnimation(
    effectiveCollapsedForHook,
    NAV_ITEM_INDICES.get('__logout__')
  );

  const { handleEnter: handleTooltipEnterDelayed, handleLeave: handleTooltipLeaveDelayed } = useDelayedTooltip();

  const handleTooltipEnter = (e, text) => {
    handleTooltipEnterDelayed(e, text, setTooltip);
  };
  const handleTooltipLeave = () => {
    handleTooltipLeaveDelayed(setTooltip);
  };

  useEffect(() => { setTooltipContainer(document.body); }, []);

  useEffect(() => {
    const mq      = window.matchMedia('(max-width: 767px)');
    const handler = e => { setIsMobile(e.matches); if (e.matches) setSheetOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (onboardingChecked.current || !user) return;
    onboardingChecked.current = true;
    if (user.role !== 'student') return;
    if (!user.onboarding_completed) {
      setOnboardingInitialStep('welcome');
      setShowOnboarding(true);
    } else if (!user.tour_completed) {
      setOnboardingInitialStep('tour');
      setShowOnboarding(true);
    }
  }, [user]);

  const handleSidebarToggle = () => {
    if (isMobile) setSheetOpen(prev => !prev);
    else toggleCollapsed();
  };

  const forceSidebarOpen = () => {
    if (isMobile) setSheetOpen(true);
    else if (collapsed) toggleCollapsed();
  };

  const handleTouchStart = e => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd   = e => {
    if (touchStartX.current === null) return;
    if (e.changedTouches[0].clientX - touchStartX.current < -40) setSheetOpen(false);
    touchStartX.current = null;
  };

  const confirmLogout = () => { logout(); navigate('/signin'); };

  const effectiveCollapsed = isMobile ? false : collapsed;
  const sidebarOpen = isMobile ? sheetOpen : !collapsed;

  const sharedNavProps = {
    collapsed:      effectiveCollapsed,
    showTooltips:   effectiveCollapsed,
    onTooltipEnter: handleTooltipEnter,
    onTooltipLeave: handleTooltipLeave,
  };

  if (inReader) {
    return <div className="bg-[color:var(--color-bg)]"><Outlet /></div>;
  }

  const sidebarContent = (
    <>
      <div
        className="h-[56px] flex items-center overflow-x-hidden flex-shrink-0 relative border-b hairline"
        style={{
          paddingLeft:  effectiveCollapsed ? 18 : 16,
          paddingRight: effectiveCollapsed ? 0  : 16,
          gap:          effectiveCollapsed ? 0  : 12,
          transition:   `padding-left ${SIDEBAR_TRANSITION_MS}ms ease, padding-right ${SIDEBAR_TRANSITION_MS}ms ease, gap ${SIDEBAR_TRANSITION_MS}ms ease`,
        }}
      >
        <img
          src="/img/fish_logo.png"
          alt="CvSUHimay"
          className="w-7 h-7 object-contain flex-shrink-0"
          style={{
            filter:
              'drop-shadow(1px 0 0 var(--color-accent)) ' +
              'drop-shadow(-1px 0 0 var(--color-accent)) ' +
              'drop-shadow(0 1px 0 var(--color-accent)) ' +
              'drop-shadow(0 -1px 0 var(--color-accent))',
          }}
        />
        <div
          className="font-outfit-wordmark text-[18px] whitespace-nowrap overflow-hidden"
          style={{
            opacity:       effectiveCollapsed ? 0   : 1,
            maxWidth:      effectiveCollapsed ? 0   : 180,
            transition:    `opacity ${SIDEBAR_TRANSITION_MS}ms ease, max-width ${SIDEBAR_TRANSITION_MS}ms ease`,
            pointerEvents: 'none',
          }}
        >
          <span className="display-accent">CvSU</span><span className="ink">Himay</span>
        </div>
      </div>

      {user && (
        <div className="border-b hairline flex-shrink-0">
          <SidebarUserBlock user={user} collapsed={effectiveCollapsed} />
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-2 overflow-x-hidden">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
            <div className="relative h-6 flex items-end overflow-hidden">
              {gi > 0 && (
                <div
                  className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-px bg-[color:var(--color-border)]"
                  style={{
                    opacity:    effectiveCollapsed ? 1 : 0,
                    transition: `opacity ${SIDEBAR_TRANSITION_MS}ms ease`,
                  }}
                />
              )}
              {group.label && (
                <p
                  className="px-4 pb-1 text-[10px] uppercase tracking-[0.18em] font-semibold ink-faint select-none whitespace-nowrap"
                  style={{
                    opacity:    effectiveCollapsed ? 0 : 1,
                    transition: `opacity ${SIDEBAR_TRANSITION_MS}ms ease`,
                  }}
                >
                  {group.label}
                </p>
              )}
            </div>
            <div className="space-y-1">
              {group.items.map(item => (
                <NavItem
                  key={item.name}
                  item={item}
                  index={NAV_ITEM_INDICES.get(item.name)}
                  {...sharedNavProps}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex-shrink-0 py-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {BOTTOM_NAV_ITEMS.map(item => (
            <NavItem
              key={item.name}
              item={item}
              index={NAV_ITEM_INDICES.get(item.name)}
              {...sharedNavProps}
            />
          ))}
          <button
            data-tour="signout"
            onClick={() => setShowLogoutModal(true)}
            onMouseEnter={e => { if (effectiveCollapsed) handleTooltipEnter(e, 'Sign out'); }}
            onMouseLeave={() => { if (effectiveCollapsed) handleTooltipLeave(); }}
            aria-label="Sign out"
            className="w-full cursor-pointer flex items-center py-2 text-[13.5px] border-l-[3px] border-transparent ink-muted hover:bg-[color:var(--color-surface-3)] hover:border-[color:var(--color-surface-3)]"
            style={{
              paddingLeft:  effectiveCollapsed ? 21 : 16,
              paddingRight: effectiveCollapsed ? 0  : 16,
              gap:          effectiveCollapsed ? 0  : 10,
              transition: [
                `padding-left  ${SIDEBAR_TRANSITION_MS}ms ease`,
                `padding-right ${SIDEBAR_TRANSITION_MS}ms ease`,
                `gap           ${SIDEBAR_TRANSITION_MS}ms ease`,
                'background-color 150ms ease',
                'border-color     150ms ease',
              ].join(', '),
            }}
          >
            <LogOut strokeWidth={1.75} className="w-4 h-4 flex-shrink-0" />
            <span
              ref={logoutLabelRef}
              className="whitespace-nowrap"
              style={{
                maxWidth:      effectiveCollapsed ? 0   : 100,
                overflow:      'hidden',
                transition:    `max-width ${SIDEBAR_TRANSITION_MS}ms ease`,
                display:       'inline-block',
                pointerEvents: 'none',
              }}
            >
              Sign out
            </span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
      {showOnboarding && (
        <Onboarding
          onComplete={() => setShowOnboarding(false)}
          onForceSidebarOpen={forceSidebarOpen}
          initialStep={onboardingInitialStep}
        />
      )}
      {tooltip.visible && tooltip.rect && (
        <SidebarTooltip {...tooltip} container={tooltipContainer} />
      )}
      {isMobile && sheetOpen && (
        <div
          onClick={() => setSheetOpen(false)}
          aria-hidden="true"
          className="bg-black/40 backdrop-blur-sm"
          style={{ position: 'fixed', inset: 0, zIndex: 50 }}
        />
      )}
      <aside
        className="sidebar-shell bg-[color:var(--color-bg)] border-r border-[color:var(--color-hairline)] flex flex-col flex-shrink-0 overflow-hidden"
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchEnd={isMobile   ? handleTouchEnd   : undefined}
        style={
          isMobile ? {
            position:   'fixed',
            left:       0,
            top:        0,
            height:     '100dvh',
            zIndex:     50,
            width:      'var(--shell-sidebar-w)',
            transform:  sheetOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: `transform ${SIDEBAR_TRANSITION_MS}ms ease`,
          } : {
            position:   'relative',
            zIndex:     20,
            width:      collapsed ? 'var(--shell-sidebar-w-collapsed)' : 'var(--shell-sidebar-w)',
            transition: `width ${SIDEBAR_TRANSITION_MS}ms ease`,
          }
        }
      >
        {sidebarContent}
      </aside>
      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        className="min-w-0"
      >
        <DashboardNavbar sidebarOpen={sidebarOpen} onSidebarToggle={handleSidebarToggle} />
        <main data-tour="main" style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default StudentDashboard;