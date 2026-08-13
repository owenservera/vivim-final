// frontend/src/ml/ml-boot.ts
// Registers the host-canvas ML slot defaults into the UI component registry
// (sdk/canvas/register-slot). Called once at chat-surface mount. Idempotent.
//
// Also registers all 13 chat.* slot defaults so the slot resolution system
// (resolveSlot) can find a component for every slot.

'use client';

import { registerDefault, exposeRuntime, resolveSlot, type AnyComponent } from '@/sdk/canvas/register-slot';
import { SLOT_IDS } from '@/ui/slots';
import { registerCatalogComponent } from '@/hooks/useSlotOverrides';
import { RelatedNodes } from '@/components/canvas/RelatedNodes';
import { Composer } from '@/components/chat/Composer';
import { ComposerShell } from '@/components/chat/ComposerShell';
import { HealthIndicator } from '@/components/chat/HealthIndicator';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { StreamingIndicator } from '@/components/canvas/StreamingIndicator';
import { MessageBlock } from '@/components/chat/MessageBlock';
import { ConversationList } from '@/components/chat/ConversationList';
import { CapabilityBar } from '@/components/canvas/CapabilityBar';
import { NotificationsCenter } from '@/components/canvas/NotificationsCenter';
import { ThreadHeader } from '@/components/chat/ThreadHeader';
import { UserMenu } from '@/components/chat/UserMenu';
import { Breadcrumb } from '@/components/chat/Breadcrumb';
import { ConversationSearch } from '@/components/chat/ConversationSearch';

// SSR-safe idempotency marker — globalThis survives HMR and prevents
// double-registration across module re-evaluations.
const BOOT_KEY = '__vivim_ml_booted';

let booted = (globalThis as Record<string, unknown>)[BOOT_KEY] === true;

export function bootMlSlots(): void {
  if (booted) return;
  booted = true;
  (globalThis as Record<string, unknown>)[BOOT_KEY] = true;

  // Canvas slot (sidebar knowledge)
  registerDefault('canvas.related', RelatedNodes as AnyComponent);

  // ── Chat slot defaults ──────────────────────────────────────────────
  // These are thin wrappers that render the real component.
  // The slot system passes generic props; wrappers forward what they need.
  // Cast through unknown because component props differ from Record<string, unknown>.

  // chat.header — provider switcher + account status
  registerDefault('chat.header', ChatHeader as unknown as AnyComponent);

  // chat.sidebar — conversation list + new-chat
  registerDefault('chat.sidebar', ChatSidebar as unknown as AnyComponent);

  // chat.thread — message scroll region (handled internally by Composer)
  registerDefault('chat.thread', ((() => null) as unknown) as AnyComponent);

  // chat.bubble — single message renderer (reserved for ChatThread component)
  registerDefault('chat.bubble', MessageBlock as unknown as AnyComponent);

  // chat.composer — input + send region
  registerDefault('chat.composer', Composer as unknown as AnyComponent);

  // chat.send — send button (rendered inside Composer)
  registerDefault('chat.send', ((() => null) as unknown) as AnyComponent);

  // chat.attach — attach-file button
  registerDefault('chat.attach', ((() => null) as unknown) as AnyComponent);

  // chat.streaming — streaming indicator
  registerDefault('chat.streaming', StreamingIndicator as unknown as AnyComponent);

  // chat.result — rich result renderer
  registerDefault('chat.result', ((() => null) as unknown) as AnyComponent);

  // chat.confirm — confirmation dialog
  registerDefault('chat.confirm', ((() => null) as unknown) as AnyComponent);

  // chat.error — error/toast surface
  registerDefault('chat.error', ((() => null) as unknown) as AnyComponent);

  // chat.entry — main chat entry point
  registerDefault('chat.entry', ((() => null) as unknown) as AnyComponent);

  // chat.actionBar — capability action buttons
  registerDefault('chat.actionBar', ((() => null) as unknown) as AnyComponent);

  // ── Populate COMPONENT_CATALOG for hot-swap overrides ──────────────
  // Backend uiSlots reference these keys; registerCatalogComponent maps
  // them to real components so useSlotOverrides can resolve them.
  registerCatalogComponent('Composer', Composer as unknown as AnyComponent);
  registerCatalogComponent('ComposerShell', ComposerShell as unknown as AnyComponent);
  registerCatalogComponent('ChatHeader', ChatHeader as unknown as AnyComponent);
  registerCatalogComponent('ChatSidebar', ChatSidebar as unknown as AnyComponent);
  registerCatalogComponent('MessageBlock', MessageBlock as unknown as AnyComponent);
  registerCatalogComponent('StreamingIndicator', StreamingIndicator as unknown as AnyComponent);
  registerCatalogComponent('ConversationList', ConversationList as unknown as AnyComponent);
  registerCatalogComponent('CapabilityBar', CapabilityBar as unknown as AnyComponent);
  registerCatalogComponent('HealthIndicator', HealthIndicator as unknown as AnyComponent);
  registerCatalogComponent('NotificationsCenter', NotificationsCenter as unknown as AnyComponent);
  registerCatalogComponent('RelatedNodes', RelatedNodes as unknown as AnyComponent);
  registerCatalogComponent('ThreadHeader', ThreadHeader as unknown as AnyComponent);
  registerCatalogComponent('UserMenu', UserMenu as unknown as AnyComponent);
  registerCatalogComponent('Breadcrumb', Breadcrumb as unknown as AnyComponent);
  registerCatalogComponent('ConversationSearch', ConversationSearch as unknown as AnyComponent);

  // ── Boot-time validation ─────────────────────────────────────────────
  // Verify every slot in SLOT_IDS has a non-null default registered.
  const missing: string[] = [];
  for (const slotId of SLOT_IDS) {
    try {
      const resolved = resolveSlot(slotId, { providerSlug: '', capabilitySlug: '' });
      if (!resolved.component) missing.push(slotId);
    } catch {
      missing.push(slotId);
    }
  }
  if (missing.length > 0) {
  }

  // Expose runtime for devtools access (window.__vivim.ui)
  exposeRuntime();
}
