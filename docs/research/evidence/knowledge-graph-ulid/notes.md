# Knowledge Graph + ULID Patterns — Evidence Notes

## Three Approaches

### 1. Embedded Graph Modeling (TypeGraph)
- Zod-defined nodes/edges in existing SQL database
- Query with fluent TypeScript API
- Hybrid search (FTS5, vectors)
- Start with SQLite, move to PostgreSQL without code changes

### 2. Memory System (MemoryJS)
- Bitemporal entities: valid time + transaction time
- Four memory types: working/episodic/semantic/procedural
- Decay/consolidation schedules
- Multiple storage backends (JSONL, SQLite)

### 3. Ontology Framework (ontograph-core)
- Entity/Relation/Attribute modeling
- Expr AST safe evaluation (no eval)
- OWL/SHACL/JSON Schema export
- RBAC built-in

## ULID Benefits

- Universally Unique Lexicographically Sortable Identifier
- 26 characters (vs UUID's 36)
- Crockford's base32 encoding (5 bits per character)
- Monotonically increasing support
- 1.21×10^24 unique IDs per millisecond
- Case insensitive, URL-safe

## vivim-final Mapping

| vivim Concept | Knowledge Graph Pattern |
|--------------|----------------------|
| capability_taxonomy | Graph node (entity) |
| capability_binding | Graph edge (relationship) |
| selector_strategy | Edge with hit/miss counts |
| outcome | Observation/property value |
| provider_definition | Node with metadata |

## Key Patterns

### Temporal Versioning
```typescript
// capability_taxonomy_version replaced with snapshot approach
snapshot_json: TEXT,         -- Full taxonomy snapshot
changed_fields_json: TEXT,   -- Changed fields only
```
Avoids schema drift from column duplication.

### Bitemporal Pattern (from MemoryJS)
```typescript
interface Entity {
  validFrom: Date;   // When fact became true
  validTo: Date | null; // When fact became false
  txFrom: Date;      // When recorded
  txTo: Date | null; // When superseded
}
```

## Sources
1. TypeGraph — Embedded knowledge graph for TypeScript
2. MemoryJS — Bitemporal entities, memory system
3. ontograph-core — Palantir-style ontology modeling
4. ULID specification — Sortable unique identifiers