# vivim-canvas

The roadmap for redesigning the **primary user UI** as an infinite, programmable
HTML canvas with on-demand layer swapping — the `vivim-home` oracle shell.

## Contents

| Doc | What it is |
|-----|------------|
| [`00-vision-and-philosophy.md`](./00-vision-and-philosophy.md) | **Start here.** North-star vision (the user's verbatim prompts) + the 9 governing principles, the canvas model, core requirements → mechanisms, and open questions. |
| [`01-sota-2026-notes.md`](./01-sota-2026-notes.md) | SOTA-2026 synthesis: layer-swapper sketch, zero-build architecture, agent DSL, on-demand loading, and an implementation path (Phases A–C). |
| [`integration-source/`](./integration-source/) | Read-only concatenated snapshot of the existing repo source the canvas integrates with (3 parts + index). |

## How these relate

```
00-vision-and-philosophy.md   ← the "why" and the rules (tiebreaker)
        │
        ▼
01-sota-2026-notes.md         ← the "how" (2026 best practices + sketch)
        │
        ▼
integration-source/*.md       ← the "what exists" (source it plugs into)
        │
        ▼
docs/atomic-v3/phase-03-html-canvas/  ← the canvas primitive specs (3.1–3.13)
```

## Regenerating the source snapshot

```powershell
pwsh -NoProfile -File scripts/gen-canvas-source.ps1
```

## Status

Foundational / design phase. No canvas engine exists in `src/` yet; the canvas
primitive is spec'd in `docs/atomic-v3/phase-03-html-canvas/`. This folder adds
the **home oracle**, the **infinite layer model**, **on-demand swapping**, and the
**design-from-within** layer on top of that primitive.
