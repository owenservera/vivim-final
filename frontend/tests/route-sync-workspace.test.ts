/**
 * tests/route-sync-workspace.test.ts
 * --------------------------------------------------------------------
 * Phase 2 — routeSyncWorkspace scenario matrix (S101–S120).
 *
 * Validates the workspace-aware 5-level tree walk:
 *   workspace+surface+region → workspace+surface → workspace →
 *   cross-workspace → system
 *
 * Also covers the new card kinds: doc, video, audio, automation,
 * agent, shell.
 */

import { describe, expect, test, beforeAll } from 'bun:test';
import { routeSyncWorkspace } from '../src/engines/route-sync-workspace';
import type { WorkspaceRouteContext } from '../src/shared/workspace-route';
import type { WorkspaceRouteSyncDeps } from '../src/engines/route-sync-workspace';
import type { PlanTier } from '../src/shared/route-context';
import { CapabilityEventBus } from '../src/engines/capability-event-bus';
import { StructuredLogger } from '../src/engines/structured-logger';
import {
  MemoryCapabilityTierStore,
  MemoryUiComponentStore,
  MemoryWorkspaceStore,
} from '../src/storage/impl';
import type { UiComponent } from '../src/shared/ui-component';
import type { PrimitiveScope } from '../src/shared/conceptual-model';
import { ulid } from '../src/lib/ulid';

let deps: WorkspaceRouteSyncDeps;

beforeAll(async () => {
  const eventBus = CapabilityEventBus.getInstance();
  eventBus.removeAllListeners();
  eventBus.clearRecent();
  const logger = new StructuredLogger('warn');
  const uiComponentStore = new MemoryUiComponentStore();
  const workspaceStore = new MemoryWorkspaceStore();
  const capabilityTierStore = new MemoryCapabilityTierStore();

  // Ensure global workspace exists.
  await workspaceStore.getGlobal();

  // Seed a cross-workspace docs.viewer row (the universal default).
  await seedComponent(uiComponentStore, {
    primitiveId: 'slot:docs.viewer',
    scope: 'cross-type',
    ownerId: 'global',
    variant: null,
    componentKey: 'global.docs.viewer',
    displayName: 'cross-workspace:docs.viewer',
  });
  await seedComponent(uiComponentStore, {
    primitiveId: 'slot:media.player',
    scope: 'cross-type',
    ownerId: 'global',
    variant: null,
    componentKey: 'global.media.player',
    displayName: 'cross-workspace:media.player',
  });
  await seedComponent(uiComponentStore, {
    primitiveId: 'slot:automation.builder',
    scope: 'cross-type',
    ownerId: 'global',
    variant: null,
    componentKey: 'global.automation.builder',
    displayName: 'cross-workspace:automation.builder',
  });
  await seedComponent(uiComponentStore, {
    primitiveId: 'slot:agents.canvas',
    scope: 'cross-type',
    ownerId: 'global',
    variant: null,
    componentKey: 'global.agents.canvas',
    displayName: 'cross-workspace:agents.canvas',
  });
  await seedComponent(uiComponentStore, {
    primitiveId: 'slot:shell.terminal',
    scope: 'cross-type',
    ownerId: 'global',
    variant: null,
    componentKey: 'global.shell.terminal',
    displayName: 'cross-workspace:shell.terminal',
  });

  // Seed a workspace-scoped docs.viewer override for ws:global + docs surface.
  await seedComponent(uiComponentStore, {
    primitiveId: 'slot:docs.viewer',
    scope: 'provider', // reused for workspace tier
    ownerId: 'ws:global|docs',
    variant: null,
    componentKey: 'ws-global-docs.viewer',
    displayName: 'workspace+surface:docs.viewer',
  });

  // Seed a workspace-scoped automation.builder override for a child workspace.
  await seedComponent(uiComponentStore, {
    primitiveId: 'slot:automation.builder',
    scope: 'provider',
    ownerId: 'ws:research|automation',
    variant: null,
    componentKey: 'ws-research-automation.builder',
    displayName: 'workspace+surface:automation.builder (research)',
  });

  deps = { eventBus, logger, uiComponentStore, workspaceStore, capabilityTierStore };
});

function ctx(args: {
  workspaceId?: string;
  surfaceSlug?: string;
  cardKinds: string[];
  variant?: string;
}): WorkspaceRouteContext {
  return {
    traceId: ulid(),
    workspaceId: args.workspaceId ?? 'ws:global',
    surfaceSlug: args.surfaceSlug ?? 'docs',
    userId: 'user:1',
    providerIds: [],
    accountTiers: ['free' as PlanTier],
    cardKinds: args.cardKinds,
    variant: args.variant,
  };
}

function findCard(surface: Awaited<ReturnType<typeof routeSyncWorkspace>>, cardKind: string) {
  const c = surface.cards.find((x) => x.cardKind === cardKind);
  if (!c) throw new Error(`card not found: ${cardKind}`);
  return c;
}

// ════════════════════════════════════════════════════════════════════════
// BLOCK 11 — Workspace resolution tiers (S101–S110)
// ════════════════════════════════════════════════════════════════════════

describe('Block 11 — Workspace resolution tiers (S101–S110)', () => {
  test('S101 — global workspace docs.viewer resolves to workspace+surface tier', async () => {
    const surface = await routeSyncWorkspace(
      ctx({ workspaceId: 'ws:global', surfaceSlug: 'docs', cardKinds: ['doc'] }),
      deps,
    );
    expect(findCard(surface, 'doc').tier).toBe('workspace+surface');
    expect(findCard(surface, 'doc').fromSystemDefault).toBe(false);
  });

  test('S102 — child workspace docs.viewer falls to cross-workspace', async () => {
    // ws:research has no docs.viewer override at any workspace tier → cross-workspace.
    const surface = await routeSyncWorkspace(
      ctx({ workspaceId: 'ws:research', surfaceSlug: 'docs', cardKinds: ['doc'] }),
      deps,
    );
    expect(findCard(surface, 'doc').tier).toBe('cross-workspace');
  });

  test('S103 — research workspace automation.builder resolves to workspace+surface', async () => {
    const surface = await routeSyncWorkspace(
      ctx({ workspaceId: 'ws:research', surfaceSlug: 'automation', cardKinds: ['automation'] }),
      deps,
    );
    expect(findCard(surface, 'automation').tier).toBe('workspace+surface');
  });

  test('S104 — global workspace automation.builder falls to cross-workspace', async () => {
    const surface = await routeSyncWorkspace(
      ctx({ workspaceId: 'ws:global', surfaceSlug: 'automation', cardKinds: ['automation'] }),
      deps,
    );
    expect(findCard(surface, 'automation').tier).toBe('cross-workspace');
  });

  test('S105 — media.card cross-workspace shared across all workspaces', async () => {
    const surfGlobal = await routeSyncWorkspace(
      ctx({ workspaceId: 'ws:global', surfaceSlug: 'media', cardKinds: ['video'] }),
      deps,
    );
    const surfResearch = await routeSyncWorkspace(
      ctx({ workspaceId: 'ws:research', surfaceSlug: 'media', cardKinds: ['video'] }),
      deps,
    );
    expect(findCard(surfGlobal, 'video').tier).toBe('cross-workspace');
    expect(findCard(surfResearch, 'video').tier).toBe('cross-workspace');
    // Same component row shared.
    expect(findCard(surfGlobal, 'video').component?.id).toBe(
      findCard(surfResearch, 'video').component?.id,
    );
  });

  test('S106 — shell.terminal cross-workspace shared', async () => {
    const surface = await routeSyncWorkspace(
      ctx({ workspaceId: 'ws:global', surfaceSlug: 'shell', cardKinds: ['shell'] }),
      deps,
    );
    expect(findCard(surface, 'shell').tier).toBe('cross-workspace');
    expect(findCard(surface, 'shell').engineRef).toContain('engine:shell:');
  });

  test('S107 — agents.canvas cross-workspace shared', async () => {
    const surface = await routeSyncWorkspace(
      ctx({ workspaceId: 'ws:research', surfaceSlug: 'agents', cardKinds: ['agent'] }),
      deps,
    );
    expect(findCard(surface, 'agent').tier).toBe('cross-workspace');
  });

  test('S108 — z-depth propagates from the workspace surface row', async () => {
    const surfChat = await routeSyncWorkspace(
      ctx({ workspaceId: 'ws:global', surfaceSlug: 'chat', cardKinds: ['chat'] }),
      deps,
    );
    // The global workspace's chat surface has zDepth=0 (seeded).
    expect(surfChat.zDepth).toBe(0);
  });

  test('S109 — multiple card kinds resolved in one pass', async () => {
    const surface = await routeSyncWorkspace(
      ctx({
        workspaceId: 'ws:global',
        surfaceSlug: 'docs',
        cardKinds: ['doc', 'video', 'audio', 'automation', 'agent', 'shell'],
      }),
      deps,
    );
    expect(surface.cards).toHaveLength(6);
    // Each card has a tier + engineRef.
    for (const c of surface.cards) {
      expect(c.tier).toBeTruthy();
      expect(c.engineRef).toContain('engine:');
    }
  });

  test('S110 — unknown card kind falls to system default', async () => {
    const surface = await routeSyncWorkspace(
      ctx({ workspaceId: 'ws:global', surfaceSlug: 'docs', cardKinds: ['unknown-kind'] }),
      deps,
    );
    expect(findCard(surface, 'unknown-kind').tier).toBe('system');
    expect(findCard(surface, 'unknown-kind').fromSystemDefault).toBe(true);
    expect(findCard(surface, 'unknown-kind').component).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════
// BLOCK 12 — Workspace switch + re-resolve (S111–S120)
// ════════════════════════════════════════════════════════════════════════

describe('Block 12 — Workspace switch + re-resolve (S111–S120)', () => {
  test('S111 — switch from global to research re-resolves automation.builder tier', async () => {
    const surfGlobal = await routeSyncWorkspace(
      ctx({ workspaceId: 'ws:global', surfaceSlug: 'automation', cardKinds: ['automation'] }),
      deps,
    );
    const surfResearch = await routeSyncWorkspace(
      ctx({ workspaceId: 'ws:research', surfaceSlug: 'automation', cardKinds: ['automation'] }),
      deps,
    );
    expect(findCard(surfGlobal, 'automation').tier).toBe('cross-workspace');
    expect(findCard(surfResearch, 'automation').tier).toBe('workspace+surface');
  });

  test('S112 — traceId differs between two routeSyncWorkspace calls', async () => {
    const a = await routeSyncWorkspace(
      ctx({ cardKinds: ['doc'] }),
      deps,
    );
    const b = await routeSyncWorkspace(
      ctx({ cardKinds: ['doc'] }),
      deps,
    );
    expect(a.traceId).not.toBe(b.traceId);
  });

  test('S113 — surface not in workspace falls to zDepth=0', async () => {
    // ws:research has no 'shell' surface (only global does).
    const surface = await routeSyncWorkspace(
      ctx({ workspaceId: 'ws:research', surfaceSlug: 'shell', cardKinds: ['shell'] }),
      deps,
    );
    expect(surface.zDepth).toBe(0);
  });

  test('S114 — engineRef encodes the card kind + surface', async () => {
    const surface = await routeSyncWorkspace(
      ctx({ workspaceId: 'ws:global', surfaceSlug: 'docs', cardKinds: ['doc'] }),
      deps,
    );
    expect(findCard(surface, 'doc').engineRef).toBe('engine:doc:docs');
  });

  test('S115 — slotId mapping: doc → docs.viewer', async () => {
    const surface = await routeSyncWorkspace(
      ctx({ cardKinds: ['doc'] }),
      deps,
    );
    expect(findCard(surface, 'doc').slotId).toBe('docs.viewer');
  });

  test('S116 — slotId mapping: video → media.player', async () => {
    const surface = await routeSyncWorkspace(
      ctx({ surfaceSlug: 'media', cardKinds: ['video'] }),
      deps,
    );
    expect(findCard(surface, 'video').slotId).toBe('media.player');
  });

  test('S117 — slotId mapping: automation → automation.builder', async () => {
    const surface = await routeSyncWorkspace(
      ctx({ surfaceSlug: 'automation', cardKinds: ['automation'] }),
      deps,
    );
    expect(findCard(surface, 'automation').slotId).toBe('automation.builder');
  });

  test('S118 — slotId mapping: agent → agents.canvas', async () => {
    const surface = await routeSyncWorkspace(
      ctx({ surfaceSlug: 'agents', cardKinds: ['agent'] }),
      deps,
    );
    expect(findCard(surface, 'agent').slotId).toBe('agents.canvas');
  });

  test('S119 — slotId mapping: shell → shell.terminal', async () => {
    const surface = await routeSyncWorkspace(
      ctx({ surfaceSlug: 'shell', cardKinds: ['shell'] }),
      deps,
    );
    expect(findCard(surface, 'shell').slotId).toBe('shell.terminal');
  });

  test('S120 — resolvedAt + durationMs populated', async () => {
    const surface = await routeSyncWorkspace(
      ctx({ cardKinds: ['doc'] }),
      deps,
    );
    expect(surface.resolvedAt).toBeGreaterThan(0);
    expect(surface.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ── Helpers ────────────────────────────────────────────────────────────

async function seedComponent(
  store: MemoryUiComponentStore,
  input: {
    primitiveId: string;
    scope: PrimitiveScope;
    ownerId: string;
    variant: string | null;
    componentKey: string;
    displayName: string;
    html?: string;
    status?: 'draft' | 'published' | 'deprecated';
  },
): Promise<void> {
  const now = Date.now();
  const row: UiComponent = {
    id: `uc:${input.componentKey}:${ulid()}`,
    primitiveId: input.primitiveId,
    scope: input.scope,
    ownerId: input.ownerId,
    variant: input.variant,
    componentKey: input.componentKey,
    displayName: input.displayName,
    html: input.html ?? `<div data-comp="${input.displayName}"></div>`,
    css: '',
    scriptUrl: null,
    sandboxJson: '{}',
    constraintsJson: '{}',
    contractJson: '{}',
    archetype: null,
    version: 1,
    status: input.status ?? 'published',
    author: 'system',
    defaultRegion: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
  await store.upsert(row);
}
