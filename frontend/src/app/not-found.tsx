'use client';

import { Icon } from '@/components/canvas/Icon';

export default function NotFound() {
  return (
    <main
      id="main-content"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
        <Icon name="alert" size={48} style={{ color: 'var(--muted-foreground)', marginBottom: 16 }} />\n        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
          404
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
          This page doesn't exist. It may have been moved or the URL may be incorrect.
        </p>
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 'var(--radius)',
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Return to Canvas
        </a>
      </div>
    </main>
  );
}
