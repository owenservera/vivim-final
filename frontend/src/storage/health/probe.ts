/**
 * storage/health/probe.ts
 * --------------------------------------------------------------------
 * Shared storage health probing logic used by both /api/storage/health
 * and bun run storage:inspect CLI.
 */

import type { StorageProvider } from '../provider';

export interface StoreHealth {
  impl: string;
  ready: boolean;
  count: number | null;
  error?: string;
}

export interface StorageHealthReport {
  ok: boolean;
  provider: 'memory' | 'prisma' | 'test';
  stores: Record<string, StoreHealth>;
  migrationProgress: { migrated: number; total: number; pct: number };
  generatedAt: string;
}

export const STORE_NAMES = [
  'uiComponentStore', 'providerTypeStore', 'primitiveStore', 'providerStore',
  'accountStore', 'capabilityTierStore', 'userLayoutStore', 'canvasDefinitionStore',
  'workspaceStore', 'documentStore', 'mediaStore', 'automationStore',
  'agentStore', 'hitlGateStore', 'policyRuleStore', 'annotationStore',
  'shellCommandStore',
  'notificationStore', 'auditStore', 'rbacStore', 'templateStore',
  'presenceStore', 'searchIndex', 'onboardingStore',
  'documentEditStore', 'zLayerStore', 'drawerStore',
] as const;

function implName(store: unknown): string {
  if (store === null || store === undefined) return 'null';
  const ctor = (store as { constructor?: { name?: string } }).constructor;
  return ctor?.name ?? 'unknown';
}

export async function probeStore(store: unknown): Promise<StoreHealth> {
  // Detect NotImplementedErrorProxy (from PrismaStorageProvider stubs)
  if (store && typeof store === 'object' && '__notImplemented' in store) {
    return {
      impl: 'NotImplementedErrorProxy',
      ready: false,
      count: null,
      error: (store as { __message?: string }).__message ?? 'not implemented',
    };
  }

  try {
    const s = store as Record<string, unknown>;
    if (typeof s.list === 'function') {
      const result = await (s.list as (filter?: unknown) => Promise<unknown[]>)(undefined);
      const count = Array.isArray(result) ? result.length : null;
      return { impl: implName(store), ready: true, count };
    }
    if (typeof s.stats === 'function') {
      const result = await (s.stats as (userId?: string) => Promise<Record<string, unknown>>)('user:demo');
      const count = typeof result.total === 'number' ? result.total : null;
      return { impl: implName(store), ready: true, count };
    }
    if (typeof s.get === 'function' && typeof s.set === 'function') {
      return { impl: implName(store), ready: true, count: null };
    }
    return { impl: implName(store), ready: true, count: null };
  } catch (err) {
    return {
      impl: implName(store),
      ready: false,
      count: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function probeStorage(provider: StorageProvider): Promise<StorageHealthReport> {
  const stores: Record<string, StoreHealth> = {};
  for (const name of STORE_NAMES) {
    const store = (provider as unknown as Record<string, unknown>)[name];
    stores[name] = await probeStore(store);
  }
  const migrated = Object.values(stores).filter(
    (s) => s.impl !== 'NotImplementedErrorProxy' && s.impl !== 'null' && s.ready
  ).length;
  const total = STORE_NAMES.length;
  return {
    ok: true,
    provider: provider.name,
    stores,
    migrationProgress: {
      migrated,
      total,
      pct: Number(((migrated / total) * 100).toFixed(2)),
    },
    generatedAt: new Date().toISOString(),
  };
}
