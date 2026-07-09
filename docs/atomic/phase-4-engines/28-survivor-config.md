# Unit 4.28: Survivor — src/config.ts (port/verify)

**Phase:** 4 | **File:** `src/config.ts` (survive as-is)
**Depends:** 1.4 CapStoreDb | **Produces:** Centralized env config used by server + engines
**Source:** `01-merged-epic.md` §Survivor Components, `02-merged-architecture.md` §Boot Sequence

## Purpose

Ported survivor. `src/config.ts` provides centralized environment configuration (DATABASE_URL, PORT, etc.) used by the server and engine constructors. Copy from current codebase without modification.

## Required Exports

```typescript
// Must export at minimum:
export const config: {
  port: number;              // default 9420
  databaseUrl: string;       // from env DATABASE_URL
  authToken?: string;        // optional bearer token
  nodeEnv: 'development' | 'production' | 'test';
};
export function getConfig(): typeof config;
```

## Tests
- [ ] File exists at `src/config.ts`
- [ ] Exports `config` object with `port`, `databaseUrl`, `nodeEnv`
- [ ] `config.port` defaults to 9420
- [ ] `config.databaseUrl` reads from `process.env.DATABASE_URL`
- [ ] `import { config } from '@/config.js'` resolves

## Gate
- `bunx tsc --noEmit` passes
- Server entry (`src/server/index.ts`) can import config
