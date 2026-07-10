# Unit 11.3: Profile Allocator

**Phase:** 11 | **File:** `src/executor/profile-allocator.ts`
**Depends:** 1.4 CapStoreDb | **Produces:** Chrome profile directory management
**Source:** cap-store `src/executor/profile-allocator.ts` (133 lines, port to vivim-final)

## Purpose
Manages Chrome profile directories in `chrome-profiles/{providerSlug}/{accountId}/`. Ensures each provider+account combo gets an isolated, dedicated Chrome profile that persists across sessions.

## Interface
```typescript
export class ProfileAllocator {
  constructor(private baseDir?: string) {}

  async allocate(providerSlug: string, accountId: string): Promise<string>;
  async release(providerSlug: string, accountId: string): Promise<void>;
  async list(): Promise<Array<{ providerSlug: string; accountId: string; path: string; lastUsed: Date }>>;
  async clean(olderThanDays?: number): Promise<number>;
  getPath(providerSlug: string, accountId: string): string;
}

export const DEFAULT_PROFILE_BASE = 'chrome-profiles';
```

## Required Capabilities
- Create profile directories at `chrome-profiles/{providerSlug}/{accountId}/` (creates parent dirs)
- Return absolute path to profile directory
- Persistent: same provider+account always gets same directory
- `release()`: update last-used timestamp
- `list()`: enumerate all existing profiles with metadata
- `clean()`: remove profiles older than N days (stale cleanup)
- Thread-safe concurrent access (async, no shared state corruption)

## Tests
- [ ] `allocate('claude', 'acc_123')` creates `chrome-profiles/claude/acc_123/` and returns path
- [ ] Same provider+account returns same path on repeated calls
- [ ] Different accounts return different paths
- [ ] `list()` returns all allocated profiles
- [ ] `clean(0)` removes profiles older than 0 days (all)
- [ ] `release()` updates lastUsed timestamp

## Gate
- `bun run typecheck` passes
- `bun test tests/unit/executor/profile-allocator.test.ts` passes
- Profile directories created and cleaned correctly

## Port Notes
Port from cap-store `src/executor/profile-allocator.ts`. Use standard node:fs/promises for directory operations. Adapt to vivim-final's base directory convention.
