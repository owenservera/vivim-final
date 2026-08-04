'use client';

import { useState } from 'react';
import { classify, type ClassifiedError } from '@/lib/errorClassifier';

interface ErrorBannerProps {
  error: string | Error | ClassifiedError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  style?: Record<string, unknown>;
  /** Show compact variant (single line). */
  compact?: boolean;
}

export function ErrorBanner({ error, onRetry, onDismiss, style, compact }: ErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (!error || dismissed) return null;

  const classified: ClassifiedError =
    typeof error === 'string'
      ? classify(new Error(error))
      : error instanceof Error
        ? classify(error)
        : error;

  const borderColor =
    classified.type === 'network'
      ? 'var(--color-warning, #f59e0b)'
      : 'var(--color-error, #ef4444)'

  const icon = classified.type === 'network' ? '⚠' : classified.type === 'auth' ? '🔒' : '✕'

  if (compact) {
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: 'var(--color-error-surface, #fef2f2)',
          border: `1px solid ${borderColor}`,
          borderRadius: 6,
          color: 'var(--color-error, #ef4444)',
          fontSize: 12,
          ...style,
        }}
      >
        <span aria-hidden>{icon}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {classified.message}
        </span>
        {classified.retryable && onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: '2px 8px',
              border: `1px solid ${borderColor}`,
              borderRadius: 4,
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 11,
              whiteSpace: 'nowrap',
            }}
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={() => { setDismissed(true); onDismiss(); }}
            aria-label="Dismiss error"
            style={{
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      style={{
        padding: 12,
        background: 'var(--color-error-surface, #fef2f2)',
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        color: 'var(--color-error, #ef4444)',
        fontSize: 13,
        marginBottom: 12,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span aria-hidden style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontWeight: 600 }}>{classified.title}</span>
        {onDismiss && (
          <button
            onClick={() => { setDismissed(true); onDismiss(); }}
            aria-label="Dismiss error"
            style={{
              marginLeft: 'auto',
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>
      <div style={{ color: 'var(--text-muted, #6b7280)', fontSize: 12, marginBottom: classified.retryable && onRetry ? 8 : 0 }}>
        {classified.message}
      </div>
      {classified.retryable && onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '4px 12px',
            border: `1px solid ${borderColor}`,
            borderRadius: 4,
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
