# Task 07 — Add `bun run storage:inspect` CLI

**Phase**: C (New value)
**Depends on**: Task 05
**Effort**: 1 hr
**Files touched**:
- `frontend/src/cli/commands/storage-inspect.ts` (new)
- `frontend/package.json` (add script)

## Context

The `/api/storage/health` endpoint (Task 06) is great for runtime debugging from the browser, but it requires the server to be running. This task adds a CLI that prints the same report to the terminal — useful for:
- Inspecting storage state before the server boots (e.g., to verify `VIVIM_STORAGE_PROVIDER` is set correctly).
- CI scripts that check migration progress.
- Quick local debugging without `curl`.

## Goal

1. Create `frontend/src/cli/commands/storage-inspect.ts` that prints a human-readable storage report.
2. Wire it as `bun run storage:inspect` in `frontend/package.json`.
3. Reuse the same probing logic as `/api/storage/health` (extract to a shared module).

## Spec

### Part 1: Extract the probing logic to a shared module

The `/api/storage/health/route.ts` (Task 06) has `probeStore()` and `STORE_NAMES` inline. Extract them to `frontend/src/storage/health/probe.ts` so both the route and the CLI can use them:

```ts
// storage/health/probe.ts
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
  // ... (move the probeStore body from Task 06 here verbatim)
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
```

Update `frontend/src/app/api/storage/health/route.ts` to import from the shared module:

```ts
// app/api/storage/health/route.ts (refactored)
import { NextResponse } from 'next/server';
import { getStorageProvider } from '@/storage/provider';
import { probeStorage } from '@/storage/health/probe';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const provider = getStorageProvider();
    const report = await probeStorage(provider);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
```

### Part 2: Create the CLI

Create `frontend/src/cli/commands/storage-inspect.ts` using `templates/storage-inspect-cli.ts.template`:

```ts
// cli/commands/storage-inspect.ts
import { getStorageProvider } from '../../storage/provider';
import { probeStorage, STORE_NAMES } from '../../storage/health/probe';

async function main() {
  const provider = getStorageProvider();
  const report = await probeStorage(provider);

  // Header
  console.log('');
  console.log('  vivim storage inspection');
  console.log('  ────────────────────────────────────────────────');
  console.log(`  provider:          ${report.provider}`);
  console.log(`  migration:         ${report.migrationProgress.migrated}/${report.migrationProgress.total} (${report.migrationProgress.pct}%)`);
  console.log(`  generated at:      ${report.generatedAt}`);
  console.log('');

  // Table header
  const rows = STORE_NAMES.map((name) => ({
    name,
    ...report.stores[name],
  }));

  // Sort: not-ready first, then by name
  rows.sort((a, b) => {
    if (a.ready !== b.ready) return a.ready ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  // Column widths
  const nameW = Math.max(...rows.map((r) => r.name.length), 20);
  const implW = Math.max(...rows.map((r) => r.impl.length), 24);

  console.log(`  ${'store'.padEnd(nameW)}  ${'impl'.padEnd(implW)}  ready  count  error`);
  console.log(`  ${'─'.repeat(nameW)}  ${'─'.repeat(implW)}  ─────  ─────  ──────────────────────────────`);

  for (const r of rows) {
    const ready = r.ready ? 'yes' : 'NO';
    const count = r.count === null ? '—' : String(r.count);
    const error = r.error ?? '';
    console.log(`  ${r.name.padEnd(nameW)}  ${r.impl.padEnd(implW)}  ${ready.padEnd(5)}  ${count.padEnd(5)}  ${error}`);
  }

  console.log('');
  console.log(`  ${rows.length} stores probed.`);
  console.log('');

  // Exit code: 0 if all ready, 1 if any not ready
  const allReady = rows.every((r) => r.ready);
  if (!allReady) {
    console.error('  ⚠  Some stores are not ready. See errors above.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('storage:inspect failed:', err);
  process.exit(1);
});
```

### Part 3: Wire the script

Add to `frontend/package.json` `scripts`:

```json
{
  "scripts": {
    "storage:inspect": "bun src/cli/commands/storage-inspect.ts"
  }
}
```

### Part 4: Verify

```bash
cd frontend
bun run storage:inspect
```

Expected output:

```
  vivim storage inspection
  ────────────────────────────────────────────────
  provider:          memory
  migration:         24/24 (100%)
  generated at:      2026-08-03T...

  store                  impl                      ready  count  error
  ────────────────────  ────────────────────────  ─────  ─────  ──────────────────────────────
  accountStore           MemoryAccountStore        yes    0
  agentStore             MemoryAgentStore          yes    0
  ...
  onboardingStore        MemoryOnboardingStore     yes    3
  ...

  24 stores probed.
```

Try with a different provider:

```bash
VIVIM_STORAGE_PROVIDER=prisma bun run storage:inspect
```

(After Task 08 — should print `NotImplementedErrorProxy` for 23 stores and `PrismaOnboardingStore` for `onboardingStore`, with exit code 1.)

## Files touched (summary)

| File | Action |
|---|---|
| `frontend/src/storage/health/probe.ts` | new (extracted from Task 06) |
| `frontend/src/app/api/storage/health/route.ts` | modified (import from shared module) |
| `frontend/src/cli/commands/storage-inspect.ts` | new |
| `frontend/package.json` | modified (add script) |

## Verification

1. `bun run tsc --noEmit` — passes.
2. `bun run storage:inspect` prints the table and exits 0 (with `VIVIM_STORAGE_PROVIDER=memory`).
3. The HTTP endpoint still works: `curl localhost:3000/api/storage/health` returns the same data.
4. After Task 08: `VIVIM_STORAGE_PROVIDER=prisma bun run storage:inspect` exits 1 and lists 23 `NotImplementedErrorProxy` rows.
5. `bun run storage:inspect 2>&1 | grep -c "yes"` — prints `24` (all stores ready, memory mode).

## Templates

- `templates/storage-inspect-cli.ts.template`

## Common pitfalls

- **Bun ESM resolution**: `bun src/cli/commands/storage-inspect.ts` works because Bun handles `.ts` files natively. If the project uses Node instead, you'd need `tsx` or a build step. Verify the runtime by checking `frontend/package.json`'s other scripts — if they use `bun run`, this matches.
- **Process exit**: without `process.exit(1)` on not-ready, the script exits 0 and CI can't detect problems. Don't forget it.
- **Import path**: the CLI is in `src/cli/commands/`, so the relative path to the provider is `../../storage/provider`. Double-check this; using `@/storage/provider` requires the `@/*` path alias configured in `tsconfig.json` (it usually is in Next.js projects).
