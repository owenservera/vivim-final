# Findings: Stale DevOps/Desktop Tooling vs Tauri V2 Windows Build

**Date:** 2026-08-04  
**Context:** Tauri v2 Windows build process was upgraded per `docs/upggrade-v4/tauri-v2-windows-fix`. The devops/desktop tooling has not been reconciled with the new build pipeline.

## Status of Upgrade Bundle (already applied to repo)

| File | Bundle version | Repo version | Applied? |
|---|---|---|---|
| `src-tauri/tauri.conf.json` | `visible:false`, nsis-only, no updater | ✅ identical (v1.3.14) | Yes |
| `src-tauri/src/lib.rs` | backend-ready listener, window.show() | ✅ identical (217 lines) | Yes |
| `src-tauri/Cargo.toml` | no tauri-plugin-updater | ✅ identical | Yes |
| `src-tauri/capabilities/default.json` | no updater:default | ✅ identical | Yes |
| `frontend/next.config.mjs` | `output:"export"`, no turbopack | ✅ identical | Yes |
| `scripts/tauri/build.ps1` | 3-step: sidecar → frontend → cargo tauri | ✅ identical | Yes |
| `scripts/tauri/build-sidecar.ps1` | calls compile-sidecar.ts + UPX | ✅ identical | Yes |
| `scripts/_shared.ps1` | Resolve-Bun helper | ✅ exists | Yes |
| Obsolete files deleted | installer.nsi, launch.bat, build-installer.ps1 | ✅ all absent | Yes |

## Finding 1: gateBuild uses old build commands (STALE — BLOCKER)

**File:** `devops/desktop/index.ts:214, 241`

The `gateBuild` function (G1 gate of the desktop loop) does NOT use the new `scripts/tauri/build.ps1` pipeline. Instead it calls:

- **Line 214:** `spawnStreaming('bun', ['run', 'scripts/tauri/compile-sidecar.ts'], ...)` — calls the TS compiler directly, bypassing the `build-sidecar.ps1` wrapper.
- **Line 241:** `spawnStreaming('bunx', ['tauri', 'build', '--bundles', 'nsis'], ...)` — uses `bunx tauri` instead of `cargo tauri`.

**The canonical pipeline** (per `build.ps1` and `production-build.ts:362-366`) is:
```powershell
pwsh scripts/tauri/build.ps1   # which internally: build-sidecar.ps1 → prepare-frontend.ts → cargo tauri build --bundles nsis
```

**`production-build.ts` already does it correctly** — it references `scripts/tauri/build.ps1` as the command. But `devops/desktop/index.ts` reimplements the 3 steps inline with outdated commands.

**Fix:** `gateBuild` should invoke `pwsh scripts/tauri/build.ps1` as a single call, matching `production-build.ts`.

## Finding 2: prepare-frontend.ts has dead regex patches (STALE — LOW)

**File:** `scripts/tauri/prepare-frontend.ts:17-18`

```typescript
  .replace(/output:\s*"standalone"/, 'output: "export"')
  .replace(/turbopack:\s*\{[^}]*\},?/, '') // Remove hardcoded turbopack.root
```

The actual `frontend/next.config.mjs` already has `output: "export"` and no `turbopack` block. These regex patches are **no-ops** — they match nothing. The patching-then-restoring dance is now pointless overhead (and the `originalConfig` restore still works, but is unnecessary).

**Fix:** Simplify `prepare-frontend.ts` to just run `bun run build` in the frontend dir (the config is already correct), then verify `out/` exists.

## Finding 3: UPX compression skipped in compile-sidecar (STALE — MEDIUM)

**File:** `scripts/tauri/compile-sidecar.ts:9, 175`

```
// Line 9:  NOTE: UPX compression is skipped because it corrupts Bun's self-extracting binary format
// Line 175: [compile] Step 3: UPX skipped (corrupts Bun compiled binaries — see bun docs)
```

**AGENTS.md** (the canonical project instructions) states:
> - **Tool:** UPX v5.2.0 (`winget install UPX.UPX`)
> - **Optimal settings:** Level 3 with `--no-lzma` for speed/ratio balance
> - **Results:** Level 3: 45.6 MB (46.94% ratio) ← **Production default**
> - **All compressed binaries verified working** (`--version` returns `1.3.14`)

**Conflict:** `build-sidecar.ps1` (the new wrapper) says "Compile sidecar with UPX compression" in its header comment and output message, but the TS file it delegates to explicitly skips UPX. The `production-build.ts` and the bundle's `build.ps1` expect UPX to be part of the sidecar build.

**Fix:** Add UPX compression step to `compile-sidecar.ts` (level 3, `--no-lzma`, applied after compile), matching AGENTS.md expectations.

## Finding 4: actionBuild is a dry-check, not a builder (STALE — LOW)

**File:** `devops/desktop/actions.ts:109-142`

The `actionBuild` function only calls `needsBuild()` (hash fingerprint check) and returns `{changed, ...}`. It **does not execute any build**. The actual build only happens inside `gateBuild` (the `run` action in `index.ts`).

This isn't strictly a bug — it's a "should I build?" checker. But the action is named `build` and documented as checking if sources changed. A user running `bun run devops desktop-loop build --version 1.3.14` gets a hash comparison, not an actual build.

**Fix:** Either rename to `build-check` or have `actionBuild` optionally delegate to `build.ps1` when `--build` flag is passed. This is a design/UX gap, not a correctness bug.

## Finding 5: DEFAULT_PORT mismatch risk (INFO)

**Files:** `devops/desktop/state.ts:21`, `src-tauri/src/lib.rs:11`

- `state.ts` `DEFAULT_PORT = 9421`
- `lib.rs` `DEFAULT_PORT: u16 = 9421`

✅ These match. The sidecar is spawned with `--port 9421` and devops polls port 9421. No staleness here — but worth noting that `lib.rs` parses the actual port from stdout (`extract_port_from_line`) and stores it in runtime state, so if the port shifts (e.g., 9421 in use), `actionReadyz`/`probe` default to 9421 and may fail.

## Summary: Priority Fix Order

| Priority | Fix | Files |
|---|---|---|
| **P0** | gateBuild → use `pwsh scripts/tauri/build.ps1` instead of inline `compile-sidecar.ts` + `bunx tauri` | `devops/desktop/index.ts:214, 241` |
| **P1** | Restore UPX compression in compile-sidecar.ts (level 3, `--no-lzma`) | `scripts/tauri/compile-sidecar.ts` |
| **P2** | Simplify prepare-frontend.ts (remove dead regex patches) | `scripts/tauri/prepare-frontend.ts` |
| **P3** | Rename/clarify actionBuild as dry-check | `devops/desktop/actions.ts`, `devops/desktop/cli.ts` |
