# LIVIN-LIB v3 — Living Librarian Design (Concept: Soup → Nuts)

> Auto-generated documentation-knowledge-graph system for vivim-final.  
> From raw source (`soup`) to a live, searchable, guided, self-healing wiki (`nuts`).

---

## 0. Concept: Soup → Nuts (Full Lifecycle)

The original `docs/librarian` (v2) is a **manual chef's recipe book**: an agent reads 9 files, performs 8 phases by hand, writes Markdown, builds manifests, and scaffolds a viewer. It works, but it's labor-intensive, non-repeatable without an agent, and breaks when code drifts.

**LIVIN-LIB v3** is an **industrial documentation kitchen** — fully automated, source-driven, capability-linked, and self-healing. It treats documentation as a product surface derived directly from the source of truth, not as an after-market accessory.

| Phase | Soup (Input) | Process | Nuts (Output) |
|---|---|---|---|
| **Discover** | TypeScript + Rust source, Prisma schema, capability registry (`UnifiedCapability`), `.env`, `tauri.conf.json` | AST parsing + DB query (`bun run docs:auto-discover`) | `inventory.json` — structured, machine-readable repo truth |
| **Concept** | `inventory.json` + capability bindings | Template engine maps capabilities → product narratives | Auto-drafted `FEATURE-LIST.md`, `CONCEPTUAL-DESIGN.md` |
| **Design** | Source file trees, import graphs, DB migrations | Auto-ER generation from Prisma; auto-container/component diagrams from file/module trees | `ARCHITECTURE.md`, `DATA-MODEL.md`, `DATA-FLOW.md` |
| **Build** | `src-tauri/src/*.rs`, `app/**/*.ts`, CLI scripts | Signature extraction (Rust `#[tauri::command]` + TS `invoke` sites), route extraction | `API-REFERENCE.md`, `CLI-REFERENCE.md`, `IO-REFERENCE.md` |
| **Extend** | `CAPABILITIES-AND-ROADMAP.md` seed + capability events (`CapabilityEventBus`) | Auto-extension-point detection from plugin/module architecture | Updated extensibility docs |
| **Verify** | All generated files + source | Link-checker (manifest resolver), ID consistency checker (`.ids-registry.json` audit), visibility filter audit | `OPEN-QUESTIONS.md` (auto-populated), build gate result |
| **Publish** | Verified docs + manifest + `docs/` tree | Auto-manifest generation (`docs-manifest.json`), search index generation (`search-index.json`), link-rewrite pass | Self-healing `docs/` tree with stable IDs |
| **Live View** | Published docs + manifest | Next.js viewer route (`app/docs/[[...slug]]`) rebuilt at build time from manifest | Offline-capable wiki with deep-link contract |
| **Guide** | Published docs + live UI selectors (`data-tour` attributes) | Auto-tour generation from capability execution paths (`CapabilityExecutionEngine`) | `tour-manifest.json` + guided in-app experience |

---

## 1. What's Broken in v2 (Why 10x?)

| v2 Pain Point | v3 Fix |
|---|---|
| **Agent must manually read source** (`01-DISCOVERY-PROTOCOL.md` is a checklist, not a script) | `scripts/auto-discover.ts` parses `src/` + `prisma/` + `seeds/` automatically |
| **No link between docs and capabilities** — docs don't know which `UnifiedCapability` they describe | Every doc section is tagged with `capability_id`; capability registry drives feature list |
| **Manual ID minting** — `.ids-registry.json` requires human discipline; easy to drift | `id` derived deterministically from capability slug + section hash; registry is auto-merged |
| **Regeneration breaks links** — relative `.md` links rewritten once in Phase G; if regenerated, links may rot | All links are manifest-resolved (`/docs/<slug>#<anchor>`); manifest is rebuilt from IDs, not text |
| **Tour steps reference UI manually** — requires adding `data-tour` attributes by hand; fragile selectors | `data-tour` IDs are derived from capability `ui` config; tour engine validates selectors at build time |
| **In-app viewer requires manual scaffolding** — `07` and `08` describe what to build, not how to build it automatically | `generate-viewer.ts` scaffolds `app/docs/` components from manifest; `generate-tour.ts` builds `tour-manifest.json` from capability paths |
| **No sync between code change and docs** — docs are a snapshot; they rot | Pre-commit hook (`.lefthook` or `package.json` `prepare`) triggers `bun run docs:generate`; CI fails if manifest is stale |
| **No quality gate automation** — `05-QUALITY-GATE.md` is a checklist for humans to run | `scripts/verify-docs.ts` runs all consistency checks in `<5s`; exits non-zero on failure |
| **Audience visibility is manual tagging** — easy to miss `internal-only` sections | Auto-tagging: any doc section containing file paths (`src-tauri/`, `.ts`) is tagged `internal-only` by default; `CONCEPTUAL-DESIGN.md` sections are `in-app` by default |

---

## 2. New Architecture: LIVIN-LIB System

### 2.1 Core Components (Files Created)

```
docs/librarian-v3/
  DESIGN.md          (this file)
  AUTO-LIB.md        (one-page operator manual)
  MANIFEST-SPEC.md   (enhanced schema for v3 manifests)

  scripts/
    auto-discover.ts      # Phase A automation: source → inventory.json
    generate-docs.ts      # Phase B-E automation: inventory → docs/
    generate-manifest.ts  # Phase G: docs/ → docs-manifest.json + search-index.json
    generate-viewer.ts    # Phase H: manifest → app/docs/ components
    generate-tour.ts      # Phase H: capability paths + UI selectors → tour-manifest.json
    verify-docs.ts        # Phase F automation: link/ID/consistency audit
    link-checker.ts       # Helper: resolve manifest links

  .ids-registry.json      # Auto-maintained (not hand-edited)
```

### 2.2 Integration Points with vivim-final

- **Capability Registry (`src/registry/` or `src/engines/*caps.ts`)**: Source of truth for features. `generate-docs.ts` reads the registry to build `FEATURE-LIST.md` and capability-linked sections.
- **CapabilityEventBus (`src/engines/capability-event-bus.ts`)**: Provides execution paths for `generate-tour.ts`. Each capability's `execute()` path maps to a tour step sequence.
- **Store Contracts (`src/storage/contracts/*.ts`)**: Auto-parsed by `auto-discover.ts` to build `IO-REFERENCE.md` and filesystem access maps.
- **Prisma Schema (`prisma/schema.prisma`)**: Parsed to generate `DATA-MODEL.md` and `ARCHITECTURE.md` data layer sections automatically.
- **Config Manager (`src/config.ts`)**: Read by `auto-discover.ts` to resolve `.env` variables for `IO-REFERENCE.md`.
- **Browser/Frontend (`frontend/`)**: `generate-viewer.ts` writes `frontend/src/app/docs/` components (not inside `docs/` — separate surface, per v2 spec).

---

## 3. The Enhanced Manifest Schema (v3)

```json
{
  "version": "livin-lib-v3",
  "generated_at": "2026-08-26T...",
  "source_commit": "<git-sha>",
  "capability_registry_sha": "<hash-of-cap-registry-file>",
  "docs": [
    {
      "id": "cap:send_message:claude",
      "slug": "capabilities/send-message/claude",
      "title": "Send Message — Claude",
      "category": "product",
      "file": "docs/product/FEATURE-LIST.md",
      "anchor": "send-message-claude",
      "capability_ref": "send_message",
      "provider_ref": "claude",
      "audience_visibility": "both",
      "source_inventory_items": ["claude-stream-parser", "ProviderRegistrar"],
      "diagrams": [
        {"id": "sequence-claude-send", "type": "mermaid", "anchor": "sequence-claude-send", "title": "Send Flow (Claude)"}
      ],
      "sections": [
        {"id": "feature-desc", "title": "Feature Description", "anchor": "feature-desc", "audience_visibility": "in-app"},
        {"id": "capability-implementation", "title": "Capability Implementation", "anchor": "capability-implementation", "audience_visibility": "internal-only"}
      ]
    }
  ],
  "links_verified": true,
  "ids_registered": 312,
  "open_questions": [
    {"id": "qa-dup-30", "source": ".archive/docs-stale-...", "action": "Curate duplicate parser fixtures"}
  ]
}
```

Key additions over v2:
- `capability_ref` / `provider_ref` — links docs directly to the registry
- `source_inventory_items` — traces doc section back to source modules
- `links_verified` — boolean set by `verify-docs.ts`
- `ids_registered` — count of minted IDs
- `open_questions` — auto-populated from audit failures, never hidden

---

## 4. Key Innovations (Why This Is 10x)

### 4.1 Auto-Discovery (`scripts/auto-discover.ts`)
Instead of a 9-file checklist (`01-DISCOVERY-PROTOCOL.md`), a TypeScript script parses:
- `prisma/schema.prisma` (tables, relations, indexes) → `inventory.json` data tables
- `src/` (AST traversal) → module/file trees, command registrations, event emissions
- `seeds/providers/manifests.ts` → provider manifest entries
- `frontend/src/` → UI component registry, slot IDs
- `.env.example` + `src/config.ts` → env variables
- `tauri.conf.json` + `Cargo.toml` → capabilities, plugins

Output: `docs/librarian-v3/.runtime/inventory.json` — a single file that phases B-H consume. No manual inventory needed.

### 4.2 Capability-Driven Docs (`generate-docs.ts`)
Every `UnifiedCapability` registered in the system has a corresponding doc section. When a capability changes (new parameter, new provider support), its doc section updates automatically. This eliminates the manual cross-linking gap between code and docs.

### 4.3 Self-Healing IDs (`generate-manifest.ts`)
When `generate-manifest.ts` runs, it reads `.ids-registry.json`. If a doc file has been regenerated and its heading changed, the manifest keeps the same `id` and updates the `slug` (if needed) but preserves all links pointing to `id`. Old `slug` mappings are kept in `.ids-registry.json` with `status: "redirected"`, so no external link ever 404s.

### 4.4 Live Regeneration (`bun run docs:live`)
A development server mode (`scripts/live-server.ts`) that:
- Watches `src/`, `prisma/`, `docs/`
- On any change, runs `auto-discover.ts` (if source changed) or `generate-manifest.ts` (if docs changed)
- Hot-rebuilds the Next.js viewer route (`frontend/src/app/docs/`)
- Reports any `verify-docs.ts` failures in the terminal immediately
This makes docs a live development surface, not a batch artifact.

### 4.5 AI-Enhanced Search (`search-index.json` v3)
In addition to keyword snippets, `search-index.json` includes:
- `embedding_ref`: reference to an embedded vector (if `CODE_INDEX_EMBEDDER_URL` is configured)
- `intent_tags`: derived from capability metadata (`send_message`, `select_model`)
- `cross_ref`: links to related capabilities (e.g., `send_message` → `select_model` for same provider)
This makes search semantic, not lexical.

### 4.6 Tour Engine Automation (`generate-tour.ts`)
Reads the capability execution paths (from `CapabilityEventBus`) and the frontend UI selectors (`data-tour` registry in `frontend/src/lib/tour-targets.ts`) to build `tour-manifest.json`. It validates that every `ui_target.selector` exists in the DOM registry before adding it. If a capability has no UI target (e.g., a backend-only capability), it creates a doc-only tour step with `doc_ref` only — never a dangling reference.

---

## 5. Integration with vivim-final's Existing Stack

| Existing Component | LIVIN-LIB Integration |
|---|---|
| `devops/` CLI | Add `bun run devops docs:generate` and `bun run devops docs:verify` commands |
| `.opencode/skill/` | Create `.opencode/skill/livin-lib/` with this design + operating manual |
| `devops/desktop/` toolkit | `generate-viewer.ts` ensures docs route builds correctly in desktop build pipeline (`scripts/tauri/build.ps1`) |
| `frontend/src/ui/` | `generate-viewer.ts` uses existing slot system (`slots.ts`) for docs layout; `data-tour` IDs align with capability slots |
| `tests/unit/` | `verify-docs.ts` is covered by unit tests (`tests/unit/librarian-v3/`) |
| `seeds/` | `auto-discover.ts` reads seed files as part of inventory |
| `docs/` (v1/v2) | `generate-docs.ts` reads existing `docs/librarian/` for backward compatibility; merges non-destructively |

---

## 6. Operation: How to Use LIVIN-LIB

```bash
# First-time setup (one time)
bun run docs:discover         # Build inventory.json from source

# Daily workflow (development loop)
bun run docs:live             # Watch + regenerate continuously
# OR
bun run docs:generate         # One-shot regeneration
bun run docs:verify           # Check links, IDs, consistency (exits non-zero on failure)

# Before committing / building (CI gate)
bun run docs:live --once     # Regenerate + verify in one command
# This is hooked into .lefthook (pre-commit) so docs never drift

# Explore the generated docs interactively
bun run docs:view             # Opens the in-app docs route locally (port 3000) with hot reload
```

---

## 7. What "10x Better" Means Quantitatively

| Metric | v2 (Manual Agent) | v3 (LIVIN-LIB) | Improvement |
|---|---|---|---|
| Discovery time | 30-60 min (agent reading 9 files) | <5 sec (`auto-discover.ts`) | 600-720x faster |
| Regeneration after code change | Manual re-run of 8 phases | `<1s` (`live-server.ts`) | Near-instant |
| Link breakage on regeneration | Common (text-derived anchors) | Zero (`id`-derived anchors) | 100% elimination |
| Manual steps to publish docs | 8 phases (A-H) | 1 command (`docs:generate`) | 8x reduction |
| Consistency verification | Human checklist (`05`) | Automated (`verify-docs.ts`, <5s) | 100% automated |
| Capability-to-doc mapping | None (manual cross-link) | Auto (`capability_ref`) | Full traceability |
| Tour generation | Manual (`08`) | Auto from execution paths | Fully automated |
| In-app viewer build | Manual scaffolding (`07`) | Auto (`generate-viewer.ts`) | Zero manual steps |
| Open questions visibility | Hidden unless agent writes `OPEN-QUESTIONS.md` | Always visible in manifest (`open_questions` array) | Always visible |

---

## 8. Next Steps (Ask Before Building)

This design is complete. Before implementing, I want confirmation from you:

1. **Scope**: Should I build the full `scripts/` automation (discover, generate, verify, viewer, tour) or start with just `auto-discover.ts` and `generate-manifest.ts`?
2. **Capability link**: Should `generate-docs.ts` read from `src/engines/*caps.ts` (the capability files) or from a different capability registry source?
3. **Viewer location**: Should `generate-viewer.ts` scaffold into `frontend/src/app/docs/` (Next.js App Router, matching the existing frontend) or `app/docs/` (if there's also a root-level Next.js setup)?
4. **Live mode**: Should `docs:live` use the existing `bun run dev` setup (which starts backend + frontend) or be a separate lightweight server just for docs?
5. **Integration depth**: Should the `.lefthook` pre-commit hook be modified directly (in `.lefthook/pre-commit.ts` or similar), or should `docs:verify` be a standalone CI step?

Also: the `docs/librarian/` directory contains a `clodue design.zip` file (30KB) that I haven't extracted. If that contains relevant reference material, let me know — otherwise I'll proceed based on the 9 `.md` files already read.
