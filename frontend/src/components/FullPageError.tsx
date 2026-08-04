// frontend/src/components/FullPageError.tsx
// Full-page error fallback for top-level ErrorBoundary.
'use client';

import type { ErrorInfo } from 'react';

interface FullPageErrorProps {
  error: Error;
  errorInfo?: ErrorInfo;
  onRetry?: () => void;
}

export function FullPageError({ error, errorInfo, onRetry }: FullPageErrorProps) {
  const isDev = process.env.NODE_ENV !== 'production'

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg, #fafafa)',
        color: 'var(--text, #111827)',
        fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)',
        padding: 32,
      }}
    >
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💥</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted, #6b7280)', marginBottom: 24 }}>
          {error.message || 'An unexpected error occurred.'}
        </p>
        {isDev && errorInfo?.componentStack && (
          <details style={{ marginBottom: 24, textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
              Component stack (dev only)
            </summary>
            <pre style={{
              marginTop: 8,
              padding: 12,
              background: 'var(--bg-subtle, #f3f4f6)',
              borderRadius: 6,
              fontSize: 11,
              overflow: 'auto',
              maxHeight: 200,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {errorInfo.componentStack}
            </pre>
          </details>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={onRetry ?? (() => window.location.reload())}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: '1px solid var(--border, #e5e7eb)',
              background: 'var(--bg, #fff)',
              color: 'var(--text, #111827)',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
