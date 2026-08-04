'use client';

import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';

export default function CanvasPage() {
  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <InfiniteCanvas />
    </main>
  );
}
