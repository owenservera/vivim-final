'use client';

import { useEffect, useState } from 'react';

interface TypingIndicatorProps {
  delay?: number;
}

export function TypingIndicator({ delay = 500 }: TypingIndicatorProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '8px 12px',
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>thinking</span>
      <span className="typing-dot" style={{ animationDelay: '0ms' }} />
      <span className="typing-dot" style={{ animationDelay: '150ms' }} />
      <span className="typing-dot" style={{ animationDelay: '300ms' }} />
    </div>
  );
}
