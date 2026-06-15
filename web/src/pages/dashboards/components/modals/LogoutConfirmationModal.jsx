// web/src/components/modals/LogoutConfirmModal.jsx
//
// Extracted from DashboardNavbar so chrome doesn't own a modal concern.
// Props mirror the inline version exactly — callers need no changes beyond
// updating their import path.
//
// Design notes:
//   HEADING   — font-suisse: decision moments earn the editorial voice.
//   CONFIRM   — near-black fill (var(--color-fg) in dark / ink literal in light).
//               Red = error; leaving is a deliberate choice, not an error.
//   BACKDROP  — 2px blur keeps context visible without distraction.
// ─────────────────────────────────────────────────────────────────────────────

import { X, AlertTriangle } from 'lucide-react';

// Renders a centred modal asking the user to confirm sign-out.
const LogoutConfirmModal = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      {/* Backdrop — subtle blur keeps surrounding context visible */}
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-[2px]" />

      <div
        className="relative bg-[color:var(--color-surface)]
          border border-[color:var(--color-hairline)]
          shadow-2xl shadow-zinc-900/15 dark:shadow-zinc-900/60
          w-full max-w-[340px] p-6 flex flex-col gap-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Warning icon */}
        <div className="w-10 h-10 bg-[color:var(--color-surface-2)]
          flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-[color:var(--color-fg-muted)]" />
        </div>

        <div>
          <h3 className="font-suisse text-[22px] text-[color:var(--color-fg)] mb-2 leading-tight">
            Sign out?
          </h3>
          <p className="text-[13px] text-[color:var(--color-fg-muted)] leading-relaxed">
            Your progress is saved. You can sign back in at any time.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Cancel — ghost/outlined, matches quiz-back-btn pattern */}
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-[10px] font-semibold tracking-[0.14em] uppercase
              border border-[color:var(--color-hairline)] bg-transparent
              text-[color:var(--color-fg-muted)]
              hover:border-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)]
              transition-colors duration-150"
          >
            Cancel
          </button>

          {/* Confirm — inverted fill, hover turns accent green */}
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-[10px] font-semibold tracking-[0.14em] uppercase
              bg-[color:var(--color-fg)] text-[color:var(--color-bg)] border border-transparent
              hover:bg-red-600 hover:border-red-600 hover:text-white
              transition-colors duration-150"
          >
            Sign out
          </button>
        </div>

        {/* Close button — top-right */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-6 h-6
            flex items-center justify-center
            text-[color:var(--color-fg-subtle)]
            hover:text-[color:var(--color-fg-muted)]
            hover:bg-[color:var(--color-surface-2)]
            transition-colors duration-150"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default LogoutConfirmModal;