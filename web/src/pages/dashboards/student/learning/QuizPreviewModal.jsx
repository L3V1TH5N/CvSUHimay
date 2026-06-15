// File path: web/src/pages/dashboards/student/learning/QuizPreviewModal.jsx
//
// Confirmation modal shown before a quiz starts or is retaken.
// Displays quiz metadata, prior attempt summary, and an in-progress resume notice.
// onStart receives { freshStart: boolean } — callers use this to pass nav state.

import { useState } from "react";
import { X, Clock, Target, CheckCircle2, RotateCcw, ArrowRight, AlertCircle } from "lucide-react";

const STORAGE_KEY   = (id) => `quiz_session_v3_${id}`;
const getSavedPhase = (moduleId) => {
  try {
    const data = JSON.parse(sessionStorage.getItem(STORAGE_KEY(moduleId)));
    return data?.phase ?? null;
  } catch {
    return null;
  }
};

// ── Shared inline style tokens ────────────────────────────────────────────
const s = {
  eyebrow: {
    fontSize: 10,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    fontWeight: 600,
    color: 'var(--color-fg-subtle)',
    fontFamily: 'var(--font-ui)',
    marginBottom: 6,
  },
  hairline: { height: 1, background: 'var(--color-hairline)', margin: '0 -24px' },
};

// ── MetaTile — editorial stat cell ───────────────────────────────────────
const MetaTile = ({ icon, label, value }) => (
  <div style={{
    padding: '12px 8px',
    borderRight: '1px solid var(--color-hairline)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 4,
  }}>
    <div style={{ color: 'var(--color-fg-subtle)', lineHeight: 0 }}>{icon}</div>
    <p style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
      {label}
    </p>
    <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-fg)', letterSpacing: '-0.025em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </p>
  </div>
);

// ── Modal ─────────────────────────────────────────────────────────────────
export default function QuizPreviewModal({ quiz, progress, onStart, onClose }) {
  // quiz:     { id, title, description, totalQuestions, timePerQuestion, passPercent }
  // progress: { attempt_count, best_score, avg_percentage } | null

  const [ctaHover,    setCtaHover]    = useState(false);
  const [cancelHover, setCancelHover] = useState(false);

  const savedPhase = getSavedPhase(quiz.id);
  const isResume   = savedPhase === "quiz";
  // Retake if results screen saved OR prior completed attempt exists
  const isRetake   = savedPhase === "results" || (!isResume && !!progress?.attempt_count);

  const everPassed = progress?.best_score != null
    && progress.best_score >= quiz.totalQuestions * (quiz.passPercent / 100);

  let ctaLabel, CtaIcon;
  if (isResume)      { ctaLabel = "Resume";  CtaIcon = ArrowRight; }
  else if (isRetake) { ctaLabel = "Retake";  CtaIcon = RotateCcw;  }
  else               { ctaLabel = "Start";   CtaIcon = ArrowRight; }

  const handleStart = () => {
    // freshStart=true only when retaking over a saved results screen.
    // Resuming an in-progress session must NOT set freshStart.
    onStart({ freshStart: savedPhase === "results" });
  };

  const hasPriorAttempts = !isResume && (progress?.attempt_count ?? 0) > 0;
  const avgPct = Number(progress?.avg_percentage ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-fg)',
        maxWidth: 480, width: '100%',
        boxShadow: '0 24px 56px -12px rgba(0,0,0,0.28)',
      }}>

        {/* Header */}
        <div style={{ padding: '22px 24px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={s.eyebrow}>
              {isResume ? "Resume quiz" : isRetake ? "Retake quiz" : "Start quiz"}
            </p>
            <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--color-fg)', lineHeight: 1.3, marginBottom: quiz.description ? 6 : 0 }}>
              {quiz.title}
            </h3>
            {quiz.description && (
              <p style={{ fontSize: 13, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-ui)', lineHeight: 1.55 }}>
                {quiz.description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-fg-muted)', lineHeight: 0, flexShrink: 0, transition: 'color 120ms ease' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-fg)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-fg-muted)'}
          >
            <X size={16} />
          </button>
        </div>

        <div style={s.hairline} />

        {/* Meta stat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <MetaTile icon={<Target size={14} />} label="Questions" value={quiz.totalQuestions} />
          <MetaTile icon={<Clock size={14} />}  label="Time / Q"  value={`${quiz.timePerQuestion}s`} />
          <div style={{
            padding: '12px 8px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 4,
          }}>
            <div style={{ color: 'var(--color-fg-subtle)', lineHeight: 0 }}><CheckCircle2 size={14} /></div>
            <p style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>Pass</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-accent)', letterSpacing: '-0.025em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {quiz.passPercent}%
            </p>
          </div>
        </div>

        {/* Resume notice */}
        {isResume && (
          <>
            <div style={s.hairline} />
            <div style={{
              margin: '0',
              padding: '14px 24px',
              borderLeft: '3px solid #d97706',
              background: 'color-mix(in srgb, #d97706 5%, transparent)',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <AlertCircle size={14} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12.5, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>
                Unfinished attempt on this quiz. <strong style={{ color: 'var(--color-fg)' }}>Resume</strong> will continue where you left off.
              </p>
            </div>
          </>
        )}

        {/* Prior attempt summary */}
        {hasPriorAttempts && (
          <>
            <div style={s.hairline} />
            <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Attempts', value: progress.attempt_count },
                { label: 'Best',     value: `${progress.best_score ?? '—'}/${quiz.totalQuestions}` },
                {
                  label: 'Avg',
                  value: `${avgPct}%`,
                  color: avgPct >= quiz.passPercent ? 'var(--color-accent)' : '#d97706',
                },
                ...(everPassed ? [{ label: 'Status', value: 'Passed', color: 'var(--color-accent)' }] : []),
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
                    {label}
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: color ?? 'var(--color-fg)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={s.hairline} />

        {/* Actions */}
        <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            onMouseEnter={() => setCancelHover(true)}
            onMouseLeave={() => setCancelHover(false)}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: `1px solid ${cancelHover ? 'var(--color-fg)' : 'var(--color-hairline)'}`,
              cursor: 'pointer',
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontWeight: 600,
              fontFamily: 'var(--font-ui)',
              color: cancelHover ? 'var(--color-fg)' : 'var(--color-fg-muted)',
              transition: 'border-color 140ms ease, color 140ms ease',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            onMouseEnter={() => setCtaHover(true)}
            onMouseLeave={() => setCtaHover(false)}
            style={{
              padding: '10px 20px',
              background: ctaHover ? 'var(--color-accent)' : 'var(--color-fg)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontWeight: 700,
              fontFamily: 'var(--font-ui)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background-color 200ms ease',
            }}
          >
            {ctaLabel} <CtaIcon size={12} />
          </button>
        </div>

      </div>
    </div>
  );
}
