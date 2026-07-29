'use client';

interface ErrorBannerProps {
  error: string | null;
  style?: Record<string, unknown>;
}

export function ErrorBanner({ error, style }: ErrorBannerProps) {
  if (!error) return null;
  return (
    <div
      style={{
        padding: 8,
        background: 'color-mix(in oklch, #ef4444 12%, var(--bg-elevated))',
        border: '1px solid #ef4444',
        borderRadius: 6,
        color: '#ef4444',
        fontSize: 11,
        marginBottom: 12,
        ...style,
      }}
    >
      {error}
    </div>
  );
}
