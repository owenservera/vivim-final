/**
 * MemoryBrowser stub — placeholder until Phase 3 ports the real component.
 */
'use client';

import { useState } from 'react';

interface MemoryEntry {
  id: string;
  key: string;
  value: string;
}

export function MemoryBrowser() {
  const [entries] = useState<MemoryEntry[]>([]);

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Memory Browser</h3>
      {entries.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>No memory entries yet.</p>
      ) : (
        <ul>
          {entries.map((e) => (
            <li key={e.id}>{e.key}: {e.value}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
