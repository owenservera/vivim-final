# Canvas Integration Source — Index

This folder is a **read-only, concatenated snapshot** of the existing repo source
that the `vivim-canvas` system directly integrates with. It exists so the whole
integration surface can be read in one place while designing the canvas — without
hunting across `src/` and `web/`.

> ⚠️ **These are copies.** The source of truth is the live repo. If a file here
> disagrees with the repo, the repo wins. Regenerate with
> `pwsh -File <temp>/gen-canvas-source.ps1` (see below).

## Why these files?

No canvas engine exists in `src/` yet — the canvas is spec'd in
`docs/atomic-v3/phase-03-html-canvas/` (units 3.1–3.13) but not implemented.
So "files that talk to this system" means its **integration surface**: the
capability plane, runtime bridge, single I/O authority, core primitives, and the
server/web attach points the canvas will plug into.

Each inclusion maps to a principle in `../00-vision-and-philosophy.md`.

## The three parts

| File | Concern | Principle | Key files |
|------|---------|-----------|-----------|
| [`01-capability-plane.md`](./01-capability-plane.md) | Agentic-native spine — capabilities as one plane for humans + agents | P5, P6 | `unified-registry`, `capability-bootstrap`, `capability-resolution`, `mcp/*` |
| [`02-runtime-and-primitives.md`](./02-runtime-and-primitives.md) | Live mirror bridge, Governor Canon, plugin substrate, core primitives | P2, P3, P7 | `mirror-engine`, `chrome-governor`, `plugin-system`, `workflow-engine`, `adaptive-workspace` |
| [`03-server-and-web-shell.md`](./03-server-and-web-shell.md) | Where the canvas attaches — server host, WS, current web shell | P2 | `server/index`, `server/websocket`, `web/ui/actions/*`, `api-client` |

## Integration map (how the canvas will attach)

```
              ┌──────────────────────────────────────────────┐
              │        vivim-home canvas (pure HTML shell)     │
              └──────────────────────────────────────────────┘
                 │              │                │
     spawn/mutate│      events  │        attach  │
                 ▼              ▼                ▼
        ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
        │ Part 1      │  │ Part 2      │  │ Part 3      │
        │ Capability  │  │ Runtime +   │  │ Server +    │
        │ plane       │  │ primitives  │  │ web shell   │
        │             │  │             │  │             │
        │ unified-    │  │ mirror-     │  │ server/     │
        │ registry    │  │ engine      │  │ index+ws    │
        │ +bootstrap  │  │ governor    │  │ actions/    │
        │ +mcp tools  │  │ plugins     │  │ registry    │
        └─────────────┘  └─────────────┘  └─────────────┘
                 │              │                │
                 └──────────────┴────────────────┘
                    all mutation → capabilities → Governor (P7)
```

## Canvas units that will consume this surface

From `docs/atomic-v3/phase-03-html-canvas/`:

- **3.1** CanvasDefinition + CanvasRegistry → follows the storage-contract pattern
  in Part 1 (`capability-store.ts`) and error taxonomy in Part 2 (`errors.ts`).
- **3.5 / 3.6** Canvas mirror (agent/user) → built on the `mirror-engine.ts`
  contract in Part 2.
- **3.10 / 3.11** Canvas router + WS → attach to `server/index.ts` +
  `server/websocket.ts` in Part 3.
- **3.13** Canvas agent tools → register into `unified-registry.ts` /
  `capability-bootstrap.ts` in Part 1 (auto-exports to MCP in `src/mcp/*`).

## Regenerating

The snapshot is produced by a committed generator script:

```powershell
pwsh -NoProfile -File scripts/gen-canvas-source.ps1
```

It derives the repo root from its own location, reads the live files, wraps each
in a fenced block with its path + line count, and writes the three markdown parts
here. Re-run it whenever the integration surface changes.

---

_Snapshot generated 2026-07-12. ~200 KB across 3 files, ~23 source files._
