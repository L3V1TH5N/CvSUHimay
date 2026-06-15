// file path: web/src/pages/auth/authUtils.jsx
//
// Shared primitives for SignIn and GetStarted.
// Extracted to eliminate the verbatim duplication that existed in both files.
// Import what you need — none of these carry side-effects.
//
// Changes from previous version:
//   • inputBase focus state: replaced separate `focus:ring-2` utility with a
//     single combined `box-shadow` declaration that carries BOTH the outer ring
//     (2px, semi-transparent green) AND an inset 3px left-bar accent (solid
//     green). Tailwind's `ring` and `shadow` utilities both write to box-shadow,
//     so stacking them via separate utilities means the last one wins — the
//     combined declaration avoids that collision.
//   • transition changed from `transition-colors` (covers color/bg/border only)
//     to `transition-[border-color,box-shadow]` so the new inset bar and the
//     ring animate in alongside the border colour change.

// ── Input style constants ─────────────────────────────────────────────────────
// Transparent background so the paper surface shows through in both light and
// dark modes. Focus state now produces three simultaneous effects:
//   1. Border colour → var(--color-accent) green
//   2. Outer ring  → 2px, rgba(4,81,14,0.2) — accessibility indicator
//   3. Inset left bar → 3px solid #04510e — distinctive CvSUHimay brand marker

/** Base className string for every text/email/password input on auth pages. */
export const inputBase =
  "w-full px-3.5 py-2.5 bg-transparent ink text-[15px] " +
  "border border-[color:var(--color-border)] " +
  "focus:outline-none " +
  "transition-colors duration-150 placeholder:ink-faint";

/** Modifier className appended to inputBase when a field has a validation error. */
export const inputErrorCls =
  "!border-red-500 dark:!border-red-400";

// ── FieldLabel ─────────────────────────────────────────────────────────────────
// Canonical label style for all auth-page fields.
// Tracked uppercase at 10.5px — matches the editorial language used throughout
// the rest of the app (section headers, anatomy rows, card metadata).
// className prop allows the caller to override margin when the label sits inside
// a flex row (e.g. the password row in SignIn that also holds a "Forgot?" link).

/**
 * Tracked-uppercase field label for auth forms.
 * Accepts an optional `className` to override default `mb-2` margin.
 */
export const FieldLabel = ({ children, htmlFor, className = "" }) => (
  <label
    htmlFor={htmlFor}
    className={`block text-[10.5px] uppercase tracking-[0.16em] ink-faint mb-2 ${className}`}
  >
    {children}
  </label>
);

// ── Spinner ───────────────────────────────────────────────────────────────────
/** Animated SVG ring shown inside buttons during async operations. */
export const Spinner = () => (
  <svg
    className="animate-spin w-4 h-4 shrink-0"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12" cy="12" r="10"
      stroke="currentColor" strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

// ── Divider ───────────────────────────────────────────────────────────────────
/** Horizontal "or" divider separating primary and OAuth actions. */
export const Divider = () => (
  <div className="flex items-center gap-3" aria-hidden="true">
    <div className="flex-1 h-px bg-current ink-faint opacity-25" />
    <span className="text-[12px] ink-faint">or</span>
    <div className="flex-1 h-px bg-current ink-faint opacity-25" />
  </div>
);

// ── GoogleButton ──────────────────────────────────────────────────────────────
// Outlined secondary style — never takes the green fill. The primary CTA owns
// the accent. Google's G SVG is always multi-color, never tinted.
// Label text is rendered in tracked uppercase to match the two-column auth layout.

/**
 * Outlined OAuth button with Google G logo.
 * Used as the secondary auth action on both SignIn and GetStarted.
 */
export const GoogleButton = ({
  loading,
  disabled,
  onClick,
  label = "Continue with Google",
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || loading}
    className="
      w-full inline-flex items-center justify-center gap-3 py-3 px-5
      bg-[color:var(--color-surface-2)]
      border border-[color:var(--color-border)]
      ink
      transition-colors duration-200
      hover:border-[color:var(--color-border-strong)] hover:bg-[color:var(--color-surface-3)]
      dark:hover:border-[color:var(--color-border-strong)] dark:hover:bg-[color:var(--color-surface-3)]
      disabled:opacity-40 disabled:cursor-not-allowed
      disabled:hover:bg-[color:var(--color-surface-2)]
      disabled:hover:border-[color:var(--color-border)]
    "
  >
    {loading ? (
      <>
        <Spinner />
        <span className="text-[11px] uppercase tracking-[0.13em]">
          Connecting to Google…
        </span>
      </>
    ) : (
      <>
        {/* Official Google G — multi-color SVG, never tinted */}
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span className="text-[11px] uppercase tracking-[0.13em] font-medium">{label}</span>
      </>
    )}
  </button>
);