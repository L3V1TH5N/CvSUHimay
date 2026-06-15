// file path: web/src/pages/dashboards/InstructorDashboard.jsx

import { useContext, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { AppContext } from '../../context/AppContext';
import {
  LayoutDashboard, BookOpen, Users, BarChart3,
  Settings, LogOut,
} from 'lucide-react';
import DashboardNavbar    from './DashboardNavbar';
import LogoutConfirmModal from './components/modals/LogoutConfirmationModal';
import UserAvatar         from '../../components/UserAvatar';

const SIDEBAR_TRANSITION_MS = 200;

const useSidebarPref = () => {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('cvsuhimay.instructor.sidebar.collapsed') === 'true'; }
    catch { return false; }
  });
  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('cvsuhimay.instructor.sidebar.collapsed', String(next)); }
      catch { /* storage blocked */ }
      return next;
    });
  };
  return [collapsed, toggleCollapsed];
};

const useLabelAnimation = (collapsed, index) => {
  const labelRef      = useRef(null);
  const isFirstRender = useRef(true);

  useLayoutEffect(() => {
    if (!labelRef.current) return;
    gsap.set(labelRef.current, { opacity: collapsed ? 0 : 1, x: 0 });
  }, []);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!labelRef.current) return;

    if (collapsed) {
      const tween = gsap.to(labelRef.current, { opacity: 0, x: -6, duration: 0.15, ease: 'power2.in' });
      return () => tween.kill();
    } else {
      const tween = gsap.to(labelRef.current, { opacity: 1, x: 0, duration: 0.2, delay: index * 0.03, ease: 'power2.out' });
      return () => tween.kill();
    }
  }, [collapsed, index]);

  return labelRef;
};

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
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    setTooltip({ visible: false, text: '', rect: null });
  };
  return { handleEnter, handleLeave };
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

const NAV_GROUPS = [
  {
    label: 'Manage',
    items: [
      { name: 'Overview',            path: '/instructor/dashboard',           icon: LayoutDashboard, end: true },
      { name: 'Course Management',   path: '/instructor/dashboard/courses',   icon: BookOpen },
      { name: 'Student Management',  path: '/instructor/dashboard/students',  icon: Users },
      { name: 'Analytics & Reports', path: '/instructor/dashboard/analytics', icon: BarChart3 },
    ],
  },
];

const BOTTOM_NAV_ITEMS = [
  { name: 'Settings', path: '/instructor/dashboard/settings', icon: Settings },
];

const NAV_ITEM_INDICES = new Map(
  [
    ...NAV_GROUPS.flatMap(g => g.items),
    ...BOTTOM_NAV_ITEMS,
    { name: '__logout__' },
  ].map((item, i) => [item.name, i])
);

const NavItem = ({ item, collapsed, index = 0, showTooltips, onTooltipEnter, onTooltipLeave }) => {
  const Icon     = item.icon;
  const labelRef = useLabelAnimation(collapsed, index);

  return (
    <NavLink
      to={item.path}
      end={item.end}
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

const SidebarUserBlock = ({ user, collapsed }) => {
  const displayName = user?.full_name?.split(' ')[0] || user?.email || 'Instructor';
  const role        = user?.role || 'Instructor';

  return (
    <div className="relative overflow-hidden" style={{ height: 64 }}>
      {/* Expanded layer */}
      <div
        className="absolute inset-0 px-4 flex items-center gap-2.5"
        style={{
          opacity:       collapsed ? 0 : 1,
          transition:    `opacity ${SIDEBAR_TRANSITION_MS}ms ease`,
          pointerEvents: collapsed ? 'none' : 'auto',
        }}
      >
        <UserAvatar user={user} size={32} ring={false} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold ink truncate leading-none">{displayName}</p>
          <p className="text-[11px] ink-muted capitalize mt-0.5 leading-none">{role}</p>
        </div>
      </div>

      {/* Collapsed layer */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity:       collapsed ? 1 : 0,
          transition:    `opacity ${SIDEBAR_TRANSITION_MS}ms ease`,
          pointerEvents: collapsed ? 'auto' : 'none',
        }}
      >
        <UserAvatar user={user} size={30} ring={false} />
      </div>
    </div>
  );
};

const InstructorDashboard = () => {
  const { user, logout } = useContext(AppContext);
  const navigate         = useNavigate();

  const [collapsed, toggleCollapsed] = useSidebarPref();
  const [isMobile,  setIsMobile]     = useState(() => window.innerWidth < 768);
  const [sheetOpen, setSheetOpen]    = useState(false);

  const [showLogoutModal,  setShowLogoutModal]  = useState(false);
  const [tooltip,          setTooltip]          = useState({ visible: false, text: '', rect: null });
  const [tooltipContainer, setTooltipContainer] = useState(null);

  const touchStartX = useRef(null);

  const effectiveCollapsedForHook = isMobile ? false : collapsed;
  const logoutLabelRef = useLabelAnimation(
    effectiveCollapsedForHook,
    NAV_ITEM_INDICES.get('__logout__')
  );

  const { handleEnter: handleTooltipEnterDelayed, handleLeave: handleTooltipLeaveDelayed } = useDelayedTooltip();

  const handleTooltipEnter = (e, text) => handleTooltipEnterDelayed(e, text, setTooltip);
  const handleTooltipLeave = ()         => handleTooltipLeaveDelayed(setTooltip);

  useEffect(() => { setTooltipContainer(document.body); }, []);

  useEffect(() => {
    const mq      = window.matchMedia('(max-width: 767px)');
    const handler = e => { setIsMobile(e.matches); if (e.matches) setSheetOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleSidebarToggle = () => {
    if (isMobile) setSheetOpen(prev => !prev);
    else toggleCollapsed();
  };

  const handleTouchStart = e => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd   = e => {
    if (touchStartX.current === null) return;
    if (e.changedTouches[0].clientX - touchStartX.current < -40) setSheetOpen(false);
    touchStartX.current = null;
  };

  const confirmLogout = () => { logout(); navigate('/signin'); };

  const effectiveCollapsed = isMobile ? false : collapsed;
  const sidebarOpen        = isMobile ? sheetOpen : !collapsed;

  const sharedNavProps = {
    collapsed:      effectiveCollapsed,
    showTooltips:   effectiveCollapsed,
    onTooltipEnter: handleTooltipEnter,
    onTooltipLeave: handleTooltipLeave,
  };

  const sidebarContent = (
    <>
      {/* Brand header */}
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

      {/* User block */}
      {user && (
        <div className="border-b hairline flex-shrink-0">
          <SidebarUserBlock user={user} collapsed={effectiveCollapsed} />
        </div>
      )}

      {/* Nav groups */}
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

      {/* Bottom nav + logout */}
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
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default InstructorDashboard;
