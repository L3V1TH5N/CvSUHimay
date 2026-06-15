// file path: CvSUHimayEditorial\web\src\components\Navbar.jsx

import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sun, Moon, Menu, X, ArrowUpRight } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { ThemeContext } from '../context/ThemeContext';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout }            = useContext(AppContext);
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);

  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    const close = (e) => {
      if (!e.target.closest('[data-user-menu]')) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  /* Close mobile menu on route change */
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleDashboard = () => {
    if (!user) return;
    if (user.role === 'admin')           navigate('/admin/dashboard');
    else if (user.role === 'instructor') navigate('/instructor/dashboard');
    else                                 navigate('/student/dashboard');
  };

  /* ── Desktop nav link — mono caps with hover underline ───────────────── */
  const NavLink = ({ to, children }) => {
    const active = isActive(to);
    return (
      <Link
        to={to}
        className={`group relative text-[11px] uppercase tracking-[0.16em] font-medium px-1 py-2 link-accent transition-colors duration-200
          ${active ? 'ink' : 'ink-muted'}`}
      >
        <span>{children}</span>
        <span
          className={`absolute left-0 right-0 -bottom-0.5 h-px bg-current transition-opacity duration-300
            ${active ? 'opacity-90' : 'opacity-0 group-hover:opacity-60'}`}
        />
      </Link>
    );
  };

  /* ── Auth initial bubble ─────────────────────────────────────────────── */
  const initial =
    user?.first_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 paper border-b hairline">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between h-20">

            {/* ── Brand ─────────────────────────────────────────────── */}
            <Link to="/" className="flex items-center gap-3 group">
              <img
                src="/img/fish_logo.png"
                alt="CvSUHimay"
                className="h-12 w-auto object-contain transition-opacity duration-200 group-hover:opacity-80"
                style={{
                  filter:
                    'drop-shadow(1px 0 0 var(--color-accent)) ' +
                    'drop-shadow(-1px 0 0 var(--color-accent)) ' +
                    'drop-shadow(0 1px 0 var(--color-accent)) ' +
                    'drop-shadow(0 -1px 0 var(--color-accent))',
                }}
              />
              <div className="hidden sm:block leading-none">
                <span className="font-outfit-wordmark text-2xl leading-none">
                  <span className="display-accent">CvSU</span>
                  <span className="ink">Himay</span>
                </span>
              </div>
            </Link>

            {/* ── Desktop nav ───────────────────────────────────────── */}
            <div className="hidden md:flex items-center gap-7">
              <NavLink to="/">Home</NavLink>
              <NavLink to="/how-it-works">How it works</NavLink>
              <NavLink to="/about">About</NavLink>

              <span className="w-px h-5 bg-[rgba(28,25,23,0.18)] dark:bg-[rgba(201,197,191,0.18)]" />

              {user ? (
                <div className="relative" data-user-menu>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2.5 text-[11px] uppercase tracking-[0.16em] font-medium ink-muted link-accent"
                  >
                    <span className="w-7 h-7 flex items-center justify-center
                      bg-[#1f1813] dark:bg-[#ece2cb]
                      text-[#f6efde] dark:text-[#0d0b09]
                      text-[11px] font-semibold select-none">
                      {initial}
                    </span>
                    <span className="hidden lg:block max-w-[120px] truncate">
                      {user.first_name ?? user.email}
                    </span>
                    <svg
                      className={`w-3 h-3 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-3 w-56 anim-dropdown
                      bg-[#f7f3ea] dark:bg-[#0d1418]
                      border hairline">
                      <div className="px-4 pt-3 pb-2 text-[10px] uppercase tracking-[0.18em] ink-faint border-b hairline">
                        Signed in as
                      </div>
                      <div className="px-4 py-3 ink text-[14px] truncate">
                        {user.first_name ?? user.email}
                      </div>
                      <div className="border-t hairline" />
                      <button
                        onClick={() => { handleDashboard(); setUserMenuOpen(false); }}
                        className="w-full text-left px-4 py-3 text-[11px] uppercase tracking-[0.16em] font-medium ink-muted link-accent hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                      >
                        Dashboard →
                      </button>
                      <div className="border-t hairline" />
                      <button
                        onClick={() => { logout(); setUserMenuOpen(false); }}
                        className="w-full text-left px-4 py-3 text-[11px] uppercase tracking-[0.16em] font-medium ink-muted link-accent hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link
                    to="/signin"
                    className="text-[11px] uppercase tracking-[0.16em] font-medium ink-muted link-accent"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/get-started"
                    className="group inline-flex items-center gap-2.5 px-5 py-2.5
                      bg-[#1a1410] dark:bg-[#ece6d8]
                      text-[#f7f3ea] dark:text-[#0d1418]
                      text-[10px] uppercase tracking-[0.18em] font-medium
                      transition-colors duration-300
                      hover:bg-[#04510e] hover:text-white
                      dark:hover:bg-[#04510e] dark:hover:text-white"
                  >
                    Begin
                    <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </>
              )}

              <button
                onClick={toggleTheme}
                aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                className="w-7 h-7 flex items-center justify-center ink-muted link-accent"
              >
                {isDarkMode
                  ? <Sun  className="w-4 h-4 anim-icon" key="sun"  />
                  : <Moon className="w-4 h-4 anim-icon" key="moon" />}
              </button>
            </div>

            {/* ── Mobile triggers ───────────────────────────────────── */}
            <div className="md:hidden flex items-center gap-1">
              <button
                onClick={toggleTheme}
                aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                className="w-9 h-9 flex items-center justify-center ink-muted link-accent"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                className="w-9 h-9 flex items-center justify-center ink-muted link-accent"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile menu ─────────────────────────────────────────────── */}
        {mobileOpen && (
          <div className="md:hidden border-t hairline paper">
            <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-col">

              <div className="text-[10px] uppercase tracking-[0.18em] ink-faint mb-4">
                Menu
              </div>

              {[
                ['/',             'Home'],
                ['/how-it-works', 'How it works'],
                ['/about',        'About'],
              ].map(([to, label]) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={`py-3 text-[12px] uppercase tracking-[0.16em] font-medium border-b hairline link-accent transition-colors duration-200 ${isActive(to) ? 'ink' : 'ink-muted'}`}
                >
                  {label}
                </Link>
              ))}

              <div className="border-t hairline my-4" />

              {user ? (
                <>
                  <div className="text-[10px] uppercase tracking-[0.18em] ink-faint mb-3">
                    Signed in
                  </div>
                  <div className="ink text-[15px] mb-4">
                    {user.first_name ?? user.email}
                  </div>
                  <button
                    onClick={() => { handleDashboard(); setMobileOpen(false); }}
                    className="text-left py-3 text-[12px] uppercase tracking-[0.16em] font-medium ink-muted link-accent"
                  >
                    Dashboard →
                  </button>
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="text-left py-3 text-[12px] uppercase tracking-[0.16em] font-medium ink-muted link-accent"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/signin"
                    onClick={() => setMobileOpen(false)}
                    className="py-3 text-[12px] uppercase tracking-[0.16em] font-medium ink-muted border-b hairline link-accent"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/get-started"
                    onClick={() => setMobileOpen(false)}
                    className="mt-5 inline-flex items-center justify-between gap-3 px-5 py-3.5
                      bg-[#1a1410] dark:bg-[#ece6d8]
                      text-[#f7f3ea] dark:text-[#0d1418]
                      text-[11px] uppercase tracking-[0.18em] font-medium"
                  >
                    <span>Begin</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Spacer — keeps page content below the fixed nav */}
      <div className="h-20" />
    </>
  );
};

export default Navbar;
