# Knowledge Graph + ULID Patterns Brief

**Source:** TypeGraph + MemoryJS + ontograph-core research + web findings
**Confidence:** High | **Sources:** 4 | **Date:** 2026-07-12

## TL;DR

Three approaches to knowledge graphs in TypeScript: (1) **Embedded graph modeling** (TypeGraph) — Zod-defined nodes/edges in existing SQL, (2) **Memory system** (MemoryJS) — temporal bitemporal entities with search, (3) **Ontology framework** (ontograph-core) — Palantir-style entity/relation/attribute modeling. ULIDs provide lexicographically sortable 26-char IDs perfect for chronological querying. Key insight: vivim-final's capability taxonomy mirrors knowledge graph pattern with provider/capability/selector nodes.

## Key Decisions

1. **Use ULID for all IDs** — Lexicographically sortable, 26-char strings, no special characters
2. **Embedded graph in SQL** — vivim-final stores capability taxonomy in `capability_taxonomy` table; relationships via FKs
3. **Schema-as-source-of-truth** — Zod schemas validate at boundaries; ULIDs for internal IDs
4. **Temporal patterns** — `capability_taxonomy_version` with snapshot_json replaces scalar versioning
5. **Graph queries via SQL JOINs** — No separate graph engine; relationships are FK cascades

## Evidence Summary

- **TypeGraph:** Zod-defined nodes/edges in SQLite/PostgreSQL, fluent query API, hybrid search with vectors (source: nicia-ai/typegraph)
- **MemoryJS:** Entities with bitemporal validity, relationships, 4-tier memory engine (working/episodic/semantic/procedural), decay/consolidation (source: danielsimonjr/MemoryJS)
- **ontograph-core:** Entity/Relation/Attribute modeling with Expr AST safe evaluation, OWL/SHACL export, RBAC built-in (source: openshuyi/ontograph-core)
- **ULID spec:** 128-bit sortable IDs, Crockford's base32 encoding, 1.21×10^24 IDs per millisecond, monotonically increasing support (source: ulid/javascript)

## Patterns

### Embedded Graph (vivim-final approach)
```typescript
// capability_taxonomy table mirrors graph node pattern
CREATE TABLE capability_taxonomy (
  id TEXT PRIMARY KEY,          -- ULID
  slug TEXT NOT NULL,
  provider_id TEXT,             -- FK to provider_definition
  ui_component TEXT,            -- UI field from contract
  -- ... 21 UI fields total
  op_classification TEXT,       -- read/write/navigate/search
  aliases_json TEXT             -- alternative names for discovery
);

-- Relationships via capability_binding + selector_strategy
CREATE TABLE capability_binding (
  id TEXT PRIMARY KEY,
  capability_id TEXT REFERENCES capability_taxonomy(id),
  plan_tier TEXT,
  -- override chain: defaults → tier → provider
);
```

### Bitemporal Entity (MemoryJS pattern)
```typescript
// Entities can be versioned with valid time + transaction time
interface Entity {
  id: string;           // ULID
  name: string;
  entityType: string;
  validFrom: Date;       // When fact became true
  validTo: Date | null;  // When fact became false
  txFrom: Date;          // When recorded
  txTo: Date | null;     // When superseded
}

// Query as-of any point in time
ctx.entityAsOf("entity-id", new Date("2026-01-01"));
```

### Ontology Modeling (ontograph-core pattern)
```typescript
// Palantir-style ontology
const Person = defineEntity({
  name: "Person",
  attributes: {
    name: defineAttribute({ type: "string", indexed: true }),
    role: defineAttribute({ type: "string" })
  },
  relations: {
    worksOn: defineRelation({ to: Project, cardinality: "many" })
  }
});
```

## Used In

- `capability_taxonomy` table — Knowledge graph of capabilities
- `capability_binding` — Edge linking capabilities to providers/tiers
- `selector_strategy` — Alternative capability discovery paths
- `outcome` — Execution results as graph observations
- `transfer_*` tables — Knowledge transfer patterns
- All IDs in system use ULID pattern for chronological ordering