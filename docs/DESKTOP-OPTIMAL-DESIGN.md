# Optimal Tauri v2 Desktop App Design

## Architecture: Dual Sidecar (Bun Compiled)

```
┌─────────────────────────────────────────────────────────────┐
│  Tauri v2 Windows App                                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Rust Shell (src-tauri/src/lib.rs)                   │   │
│  │                                                      │   │
│  │  app.setup() ───────────────┐                        │   │
│  │                              │                        │   │
│  │   ┌──────────────────────────▼──────────────────┐     │   │
│  │   │  spawn vivim-server.exe (Bun backend)        │     │   │
│  │   │  → 127.0.0.1:9421                           │     │   │
│  │   │  → /api/*, /health, /readyz                 │     │   │
│  │   └──────────────────────────┬──────────────────┘     │   │
│  │                              │                        │   │
│  │   ┌──────────────────────────▼──────────────────┐     │   │
│  │   │  spawn vivim-web.exe (Bun frontend server)   │     │   │
│  │   │  → localhost:3000                           │     │   │
│  │   │  → serves .next/standalone/server.js        │     │   │
│  │   │  → rewrites /api/* → 127.0.0.1:9421        │     │   │
│  │   └──────────────────────────┬──────────────────┘     │   │
│  │                              │                        │   │
│  │   ┌──────────────────────────▼──────────────────┐     │   │
│  │   │  WebViewWindow: "main"                      │     │   │
│  │   │  → navigates to http://localhost:3000        │     │   │
│  │   │  → 1280×800, min 960×600                    │     │   │
│  │   │  → via window_url() after frontend ready    │     │   │
│  │   └─────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  MSI/NSIS Installer:                                        │
│  ├─ vivim-server-x86_64-pc-windows-msvc.exe (Bun backend)   │
│  ├─ vivim-web-x86_64-pc-windows-msvc.exe (Bun frontend)     │
│  └─ resources/.next/standalone/ (Next.js runtime)            │
└─────────────────────────────────────────────────────────────┘
```

## Why This Works

| Constraint | How It's Met |
|------------|-------------|
| 70+ Next.js route handlers | Keep working — Next.js server runs unchanged |
| Frontend rewrites /api/* | Keep working — next.config.mjs proxy to 9421 |
| One Entry Point invariant | Sidecar 1 (9421) is still the capability gateway |
| No extra runtime deps | Both sidecars are standalone `.exe` — Bun runtime embedded |
| Tauri v2 standards | Uses shell plugin, plugin-based architecture, capabilities |

## Key File Changes

### src-tauri/src/lib.rs
- `spawn_frontend()` — second sidecar spawner mirroring `spawn_backend()`
- After both ready, create WebView window pointing to `http://localhost:3000`
- Wait for `backend-ready` + `frontend-ready` events before building window

### src/desktop/sidecar-web.ts (NEW)
- 10-line Bun script compiled to `vivim-web.exe`
- Spawns `bun run server.js` from resource-bundled `.next/standalone/`
- Waits for server to bind, then prints `frontend listening on localhost:3000`

### tauri.conf.json
- `frontendDist` unused in production (dev-only for `devUrl`)
- In production, window loads from URL set by Rust
- Add `resources` glob for `.next/standalone/**`
- Remove unused `tray-icon` feature, updater pubkey

### capabilities/default.json
- Add `shell:allow-execute` for `vivim-web` sidecar
- Add `core:default` window permissions

## Implementation Order

| Step | Change | Effort |
|------|--------|--------|
| 1 | Create `src/desktop/sidecar-web.ts` + update build script | small |
| 2 | Add `spawn_frontend()` to `lib.rs` | small |
| 3 | Programmatic window creation after both ready | medium |
| 4 | Bundle `.next/standalone/` as Tauri resource | small |
| 5 | Generate `.ico` from PNGs | small |
| 6 | Generate updater signing keys | small |
| 7 | Install `@tauri-apps/api` + wire `withGlobalTauri: true` | medium |
| 8 | Fix `_shared.ps1` missing dependency | small |
| 9 | Prune unused Cargo features | trivial |
| 10 | Auto-run DB migration on first launch | medium |
