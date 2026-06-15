// file path: web/src/components/auth/AuthToolBackdrop.jsx
//
// Shared decorative backdrop for SignIn and GetStarted.
// Renders 5 tool SVGs (copied verbatim from LandingPage) as a quiet,
// absolutely-positioned ambient layer behind the auth form.
// No animation — still and silent.  Visible only at lg+.
// Light mode: rgba(120,120,120,0.18)  |  Dark mode: rgba(255,255,255,0.10)

/* ── Tool SVGs — stroke-only, aria-hidden, currentColor inherited from parent div ── */

/* Cutting board — handle nub at top, board body, three wood-grain lines */
function SvgCuttingBoard() {
  return (
    <svg
      width="72" height="90" viewBox="0 0 72 90"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="26" y="4" width="20" height="15" rx="3" />
      <rect x="6" y="17" width="60" height="68" rx="5" />
      <line x1="18" y1="34" x2="54" y2="34" />
      <line x1="18" y1="50" x2="54" y2="50" />
      <line x1="18" y1="66" x2="54" y2="66" />
    </svg>
  );
}

/* Bowl — elliptical rim, curved walls, inner base arc for depth */
function SvgBowl() {
  return (
    <svg
      width="88" height="60" viewBox="0 0 88 60"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <ellipse cx="44" cy="16" rx="40" ry="12" />
      <path d="M4 16 C4 46 84 46 84 16" />
      <path d="M20 43 C20 50 68 50 68 43" />
    </svg>
  );
}

/* Knife — tapered blade tip-up, bolster block, riveted handle */
function SvgKnife() {
  return (
    <svg
      width="28" height="110" viewBox="0 0 28 110"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 5 C19 5 22 18 23 44 L14 48 L5 44 C6 18 9 5 14 5Z" />
      <rect x="7" y="48" width="14" height="5" rx="1.5" />
      <rect x="8" y="53" width="12" height="52" rx="4" />
      <circle cx="14" cy="66" r="1.5" />
      <circle cx="14" cy="80" r="1.5" />
      <circle cx="14" cy="94" r="1.5" />
    </svg>
  );
}

/* Scissors — two handle rings, crossing blades, pivot dot at crossing */
function SvgScissors() {
  return (
    <svg
      width="62" height="90" viewBox="0 0 62 90"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <ellipse cx="16" cy="74" rx="13" ry="12" />
      <ellipse cx="46" cy="74" rx="13" ry="12" />
      <path d="M16 62 L30 40 L26 8" />
      <path d="M46 62 L32 40 L36 8" />
      <circle cx="31" cy="44" r="2.5" fill="currentColor" />
    </svg>
  );
}

/* Forceps — two converging arms, locking band, handle loops at base */
function SvgForceps() {
  return (
    <svg
      width="30" height="106" viewBox="0 0 30 106"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 5 C12 22 7 48 4 100" />
      <path d="M15 5 C18 22 23 48 26 100" />
      <path d="M6 72 C10 70 20 70 24 72" />
      <path d="M4 100 C2 104 6 106 6 102" />
      <path d="M26 100 C28 104 24 106 24 102" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   AuthToolBackdrop — decorative ambient layer for auth pages
   ══════════════════════════════════════════════════════════════════════════ */
export default function AuthToolBackdrop() {
  return (
    <div
      className="absolute inset-0 pointer-events-none z-0 hidden lg:block"
      aria-hidden="true"
    >
      {/* ── LEFT: Cutting board — upper-left, counter-clockwise ── */}
      <div
        className="absolute text-[rgba(120,120,120,0.18)] dark:text-[rgba(255,255,255,0.10)]"
        style={{ left: "5%", top: "14%", transform: "rotate(-12deg)" }}
      >
        <SvgCuttingBoard />
      </div>

      {/* ── LEFT: Bowl — lower-left, slight clockwise ── */}
      <div
        className="absolute text-[rgba(120,120,120,0.18)] dark:text-[rgba(255,255,255,0.10)]"
        style={{ left: "6%", bottom: "12%", transform: "rotate(8deg)" }}
      >
        <SvgBowl />
      </div>

      {/* ── RIGHT: Knife — upper-right, clockwise, tip upward ── */}
      <div
        className="absolute text-[rgba(120,120,120,0.18)] dark:text-[rgba(255,255,255,0.10)]"
        style={{ right: "6%", top: "10%", transform: "rotate(16deg)" }}
      >
        <SvgKnife />
      </div>

      {/* ── RIGHT: Scissors — mid-right, counter-clockwise ── */}
      <div
        className="absolute text-[rgba(120,120,120,0.18)] dark:text-[rgba(255,255,255,0.10)]"
        style={{ right: "4%", top: "50%", transform: "rotate(-8deg)" }}
      >
        <SvgScissors />
      </div>

      {/* ── RIGHT: Forceps — lower-right, moderate clockwise ── */}
      <div
        className="absolute text-[rgba(120,120,120,0.18)] dark:text-[rgba(255,255,255,0.10)]"
        style={{ right: "11%", bottom: "10%", transform: "rotate(10deg)" }}
      >
        <SvgForceps />
      </div>
    </div>
  );
}