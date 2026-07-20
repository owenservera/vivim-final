# db-agent — Capability Import Toolkit

One-time importer that brings the source app's capability set
(`C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store`) into vivim-final's
taxonomy pool. **Dry-run by default** — it only writes when you pass `--apply`.

## Source of Truth

The source app defines capabilities across:
- `src/server/v02-batch1.ts` … `v02-batch10.ts` (per-provider capability objects)
- a "holes" list (~150 global chat-type capabilities)
- a claude.ai capability set (~50, ~28 confirmed)

vivim-final's target is `seeds/taxonomy/pool.taxonomy.json` (currently 226 nodes). The
importer maps source capability objects → pool `TaxonomyNode` shape so they flow through
the existing pipeline: `pool.taxonomy.json` → `taxonomy-seed.ts` → DB → boot registry.

## Usage

```bash
# 1. Dry-run: scan source, report how many new nodes would be added (NO writes)
bun run scripts/db-reports/capability-import.ts --dry-run

# 2. Apply: append missing capabilities to pool.taxonomy.json
bun run scripts/db-reports/capability-import.ts --apply

# 3. Then re-seed + regenerate + restart (see devops-db)
bun run seed -- --file seeds/taxonomy/taxonomy-seed.ts
bun run gen:protocol
# restart the server so capability-bootstrap-generated.ts re-registers
```

## Mapping Contract

Each source capability → a `TaxonomyNode`:
```
{
  id:               `cap:${category}:${action}`   // ULID or slug-derived
  kind:             "capability"
  slug:             `${category}_${action}`          // single-segment -> cap:help:help
  label:            source.label
  description:      source.description
  sourceConfidence: "high" | "medium" | "low"        // "confirmed" claude caps = high
  tags:             ["imported", "<provider>"]
  shared:           true
  capabilityKind:   source.kind
  transport:        "cdp" | "api"
  family:           provider slug (or "global")
  uiComponent:      source.uiComponent ?? "chat.actionBar"
  uiPosition:       source.uiPosition ?? "chat.actionBar"
  uiOrder:          source.uiOrder ?? 100
  uiGroup:          source.uiGroup ?? "actions"
}
```

Rules (from AGENTS.md taxonomy gotchas):
- UI slot IDs must be namespaced (`chat.actionBar`, `chat.composer`, `chat.sidebar`).
- Single-segment slugs → `cap:help:help`, never `cap:undefined:help`.
- Derive `category` from `slug.split('_')[0]` when the node lacks `category`.
- Provider-bound capabilities (e.g. `send_message`) keep the provider prefix.

## Safety

- `--dry-run` (default) never writes. It prints a diff: `NEW / DUPLICATE / CONFLICT`.
- `--apply` appends only; it does not delete existing nodes.
- On slug conflict, the existing node wins (import is additive, idempotent).
- After apply, run `report-capability-gap.ts` to confirm the new DEFINED count, then seed
  and restart to close the SEEDED/REGISTERED gap.

## Why a toolkit, not a manual edit

The source app's capabilities were painstakingly discovered across prior sessions. Hand-
copying them is error-prone and loses the "confirmed vs inferred" confidence signal. The
toolkit preserves that signal and makes the import repeatable and reviewable (diff first,
apply second).
