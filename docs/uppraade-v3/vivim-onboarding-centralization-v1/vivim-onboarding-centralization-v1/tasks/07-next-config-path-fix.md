# Task 07 — Remove hardcoded Windows path from `next.config.mjs`

**Phase**: C (Make install work)
**Depends on**: nothing
**Effort**: 5 min
**Files touched**:
- `frontend/next.config.mjs`

## Context

`frontend/next.config.mjs` contains:

```js
const nextConfig = {
  // ...
  turbopack: {
    root: "C:\\0-BlackBoxProject-0\\vivim-final\\frontend",  // ← hardcoded Windows path
  },
  // ...
};
```

This is a developer-machine leak. It breaks Turbopack on any machine that isn't `C:\0-BlackBoxProject-0\...`. Next.js 16's Turbopack auto-detects the root — the line is unnecessary.

## Goal

Delete the `turbopack.root` line. If `turbopack` becomes an empty object, delete the whole `turbopack` key.

## Spec

### Find the line

```bash
cd /home/z/my-project/vivim-final
grep -n "turbopack" frontend/next.config.mjs
grep -n "BlackBoxProject" frontend/next.config.mjs
```

### Edit

If the config looks like:

```js
export default {
  reactStrictMode: true,
  output: 'standalone',
  turbopack: {
    root: "C:\\0-BlackBoxProject-0\\vivim-final\\frontend",
  },
};
```

Change to:

```js
export default {
  reactStrictMode: true,
  output: 'standalone',
};
```

If there are other `turbopack` keys (e.g. `turbopack.rules`), keep them and only remove `root`:

```js
export default {
  reactStrictMode: true,
  output: 'standalone',
  turbopack: {
    // other keys preserved
    rules: { /* ... */ },
  },
};
```

## Acceptance criteria

- [ ] `grep -r "BlackBoxProject" frontend/` returns no matches.
- [ ] `grep -r "C:\\\\0-BlackBox" frontend/` returns no matches.
- [ ] `frontend/next.config.mjs` no longer has `turbopack.root`.
- [ ] `bun run dev` (from `frontend/`) boots without errors on a non-Windows machine.
- [ ] `bun run build` (from `frontend/`) succeeds.

## Verification

```bash
cd /home/z/my-project/vivim-final/frontend

# 1. Verify the line is gone
grep -n "BlackBoxProject" next.config.mjs  # should return nothing
grep -n "turbopack" next.config.mjs  # may still exist if other keys; that's fine

# 2. Boot dev server
bun run dev
# Should start without path errors

# 3. Build
bun run build
# Should succeed
```

## Notes

- This is the easiest task in the pack. Don't overthink it.
- If you find other hardcoded developer-machine paths in the repo (search for `C:\\\\0-`, `C:/0-`, `/Users/`, `/home/` followed by a username), flag them in a follow-up issue. They're not in scope for this pack but should be cleaned up.
