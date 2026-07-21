// web/ui/src/ml/ml-boot.ts
// Registers the host-canvas ML slot defaults into the UI component registry
// (sdk/canvas/register-slot). Called once at chat-surface mount. Idempotent.

'use client';

import { registerDefault } from '@/sdk/canvas/register-slot';
import { RelatedNodes } from '@/components/canvas/RelatedNodes';

let booted = false;

export function bootMlSlots(): void {
  if (booted) return;
  booted = true;
  // canvas.related lives in the sidebar; re-ranks knowledge locally.
  registerDefault('canvas.related', RelatedNodes as unknown as import('@/sdk/canvas/register-slot').AnyComponent);
}
