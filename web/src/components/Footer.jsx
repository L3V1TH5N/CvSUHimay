// file path: web/src/components/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';

/* Bangus silhouette — decorative Field Journal end-mark, stroke-only */
function SvgFishMark() {
  return (
    <svg
      width="22" height="11" viewBox="0 0 22 11"
      fill="none" stroke="currentColor" strokeWidth="1.2"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 5.5 C5 1 12 1 16 5.5 C12 10 5 10 2 5.5Z" />
      <path d="M16 5.5 C18 3.5 21 2.5 21 5.5 C21 8.5 18 7.5 16 5.5Z" />
      <circle cx="6" cy="4.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

const Footer = () => {
  const year = new Date().getFullYear();

  const navItems = [
    ['/',             'Home'],
    ['/how-it-works', 'How it works'],
    ['/about',        'About'],
    ['/get-started',  'Begin'],
    ['/signin',       'Sign in'],
  ];

  return (
    <footer className="paper border-t hairline">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-9 pb-5">

        {/* ── Main grid ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-x-10 gap-y-7 mb-7">

          {/* Institution */}
          <div className="md:col-span-5">
            <div className="flex items-start gap-3 mb-3">
              <img
                src="/img/cvsu_logo.png"
                alt="CvSU"
                className="w-9 h-9 opacity-90 flex-shrink-0"
              />
              <div className="leading-[1.05]">
                {/* Institution name uses font-outfit — same class as all
                    display headings throughout the app. No more separate alias. */}
                <div className="font-outfit ink text-[17px]">
                  Cavite State University
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] ink-faint mt-1.5">
                  Naic Campus
                </div>
              </div>
            </div>
            <p className="text-[13px] leading-[1.6] ink-muted max-w-md">
              Developed for the{' '}
              <span className="ink font-medium">
                Fisheries &amp; Aquatic Sciences Department
              </span>
              {' '}— a procedural rehearsal for the deboning of milkfish.
            </p>
          </div>

          {/* Navigation */}
          <div className="md:col-span-4">
            <div className="text-[10px] uppercase tracking-[0.2em] ink-faint mb-3">
              Navigate
            </div>
            <ul className="space-y-2">
              {navItems.map(([to, label]) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="text-[13px] ink-muted link-accent"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Correspondence */}
          <div className="md:col-span-3">
            <div className="text-[10px] uppercase tracking-[0.2em] ink-faint mb-3">
              Correspondence
            </div>
            <a
              href="mailto:fisheries.naic@cvsu.edu.ph"
              className="block text-[13px] ink link-accent break-words"
            >
              fisheries.naic@cvsu.edu.ph
            </a>
          </div>
        </div>

        {/* ── Bottom rule ──────────────────────────────────────────── */}
        <div className="border-t hairline pt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[11px] ink-faint">
          <div className="flex items-center gap-2">
            <SvgFishMark />
            <span>© {year} CvSUHimay · All rights reserved</span>
          </div>
          <div className="md:text-right">
            <span className="ink-muted">G. Pangan</span>
            <span className="mx-2 opacity-50">·</span>
            <span className="ink-muted">J. Hilario</span>
            <span className="mx-2 opacity-50">·</span>
            <span className="ink-muted">F. Sarmiento</span>
            <span className="hidden md:inline mx-3 opacity-40">|</span>
            <span className="block md:inline mt-1 md:mt-0">BSCS · CvSU Naic · 2025</span>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;