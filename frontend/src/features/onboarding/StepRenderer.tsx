'use client';

/**
 * features/onboarding/StepRenderer.tsx
 * --------------------------------------------------------------------
 * Rich step content renderer.
 *
 * Features:
 *   - Text with basic markdown (bold, code, links)
 *   - Media support (image, gif, video, code blocks)
 *   - Action buttons (primary + secondary)
 *   - Keyboard shortcut hints
 *   - Responsive layout (stacks on mobile)
 *   - ARIA labels for accessibility
 */

import type { OnboardingStep } from '../../shared/onboarding';

interface StepRendererProps {
  step: OnboardingStep;
  stepIdx: number;
  totalSteps: number;
  onNext: () => void;
  onAction?: (command: string) => void;
  onDismiss: () => void;
}

/** Parse basic markdown: **bold**, `code`, [link](url). */
function renderBody(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Simple regex-based parser for inline markdown
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold
      parts.push(<strong key={match.index} style={{ fontWeight: 600 }}>{match[2]}</strong>);
    } else if (match[4]) {
      // Code
      parts.push(
        <code
          key={match.index}
          style={{
            padding: '1px 5px',
            borderRadius: 4,
            background: 'var(--muted, #f3f4f6)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.9em',
          }}
        >
          {match[4]}
        </code>,
      );
    } else if (match[6] && match[7]) {
      // Link
      parts.push(
        <a
          key={match.index}
          href={match[7]}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--accent, #3b82f6)',
            textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}
        >
          {match[6]}
        </a>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function StepRenderer({
  step,
  stepIdx,
  totalSteps,
  onNext,
  onAction,
  onDismiss,
}: StepRendererProps) {
  const isLast = stepIdx === totalSteps - 1;

  return (
    <div
      role="dialog"
      aria-label={step.ariaLabel ?? step.title}
      aria-live="polite"
      style={{
        width: 340,
        maxWidth: 'calc(100vw - 48px)',
        background: 'var(--bg-elevated, #fff)',
        border: '1px solid var(--border-strong, #e5e7eb)',
        borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        padding: 0,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        color: 'var(--text, #111)',
        overflow: 'hidden',
        animation: 'step-enter 300ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Media (if present) */}
      {step.media && (
        <div style={{
          borderBottom: '1px solid var(--border, #e5e7eb)',
          overflow: 'hidden',
        }}>
          {step.media.type === 'image' || step.media.type === 'gif' ? (
            <img
              src={step.media.src}
              alt={step.media.alt}
              style={{
                width: '100%',
                height: 160,
                objectFit: 'cover',
                display: 'block',
              }}
              loading="lazy"
            />
          ) : step.media.type === 'video' ? (
            <video
              src={step.media.src}
              autoPlay
              loop
              muted
              playsInline
              style={{
                width: '100%',
                height: 160,
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : step.media.type === 'code' ? (
            <pre style={{
              margin: 0,
              padding: '12px 16px',
              background: 'var(--muted, #f3f4f6)',
              fontSize: 12,
              fontFamily: 'var(--font-mono, monospace)',
              lineHeight: 1.5,
              overflow: 'auto',
              maxHeight: 160,
            }}>
              <code>{step.media.src}</code>
            </pre>
          ) : null}
          {step.media.caption && (
            <div style={{
              padding: '8px 16px',
              fontSize: 11,
              color: 'var(--text-muted, #6b7280)',
              fontStyle: 'italic',
            }}>
              {step.media.caption}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '16px 20px' }}>
        {/* Header with step counter + dismiss */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-muted, #6b7280)',
            letterSpacing: '0.02em',
          }}>
            {stepIdx + 1} / {totalSteps}
          </span>
          <button
            onClick={onDismiss}
            aria-label="Skip tour"
            style={{
              padding: '2px 8px',
              border: '1px solid var(--border, #e5e7eb)',
              background: 'transparent',
              color: 'var(--text-muted, #6b7280)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'inherit',
              transition: 'color 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text, #111)';
              e.currentTarget.style.borderColor = 'var(--text-muted, #6b7280)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted, #6b7280)';
              e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)';
            }}
          >
            Skip
          </button>
        </div>

        {/* Title */}
        <h3 style={{
          margin: '0 0 6px',
          fontSize: 15,
          fontWeight: 600,
          lineHeight: 1.3,
          letterSpacing: '-0.01em',
        }}>
          {step.title}
        </h3>

        {/* Body with markdown */}
        <p style={{
          margin: '0 0 16px',
          fontSize: 13,
          lineHeight: 1.55,
          color: 'var(--text-muted, #6b7280)',
        }}>
          {renderBody(step.body)}
        </p>

        {/* Keyboard hint */}
        {step.keyboardHint && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 14,
            fontSize: 11,
            color: 'var(--text-muted, #6b7280)',
          }}>
            <kbd style={{
              padding: '2px 6px',
              border: '1px solid var(--border, #e5e7eb)',
              borderRadius: 4,
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 10,
              background: 'var(--muted, #f3f4f6)',
            }}>
              {step.keyboardHint}
            </kbd>
            <span>to try it now</span>
          </div>
        )}

        {/* Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                aria-hidden="true"
                style={{
                  width: i === stepIdx ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i <= stepIdx
                    ? 'var(--accent, #3b82f6)'
                    : 'var(--border, #e5e7eb)',
                  opacity: i === stepIdx ? 1 : i < stepIdx ? 0.5 : 1,
                  transition: 'width 300ms cubic-bezier(0.16, 1, 0.3, 1), background 300ms ease',
                }}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            {step.secondaryAction && (
              <button
                onClick={() => step.secondaryAction?.command && onAction?.(step.secondaryAction.command)}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  color: 'var(--text-muted, #6b7280)',
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--muted, #f3f4f6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {step.secondaryAction.label}
              </button>
            )}

            {step.action && (
              <button
                onClick={() => {
                  if (step.action?.command) onAction?.(step.action.command);
                  if (!step.interactive) onNext();
                }}
                style={{
                  padding: '6px 14px',
                  background: step.action.primary
                    ? 'var(--accent, #3b82f6)'
                    : 'var(--foreground, #111)',
                  color: step.action.primary
                    ? 'var(--accent-fg, #fff)'
                    : 'var(--background, #fff)',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  transition: 'transform 0.12s ease, opacity 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {step.action.label}
              </button>
            )}

            {!step.action && (
              <button
                onClick={onNext}
                style={{
                  padding: '6px 14px',
                  background: 'var(--accent, #3b82f6)',
                  color: 'var(--accent-fg, #fff)',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  transition: 'transform 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {isLast ? 'Finish' : 'Next'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes step-enter {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
