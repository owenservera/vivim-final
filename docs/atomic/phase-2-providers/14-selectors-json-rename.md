# Unit 2.14: ProviderEndpoint selectorsJson Rename

**Phase:** 2 | **File:** `prisma/schema.prisma`, `src/engines/provider-registrar.ts`, `src/storage/impl/provider-store-impl.ts`
**Depends:** 2.13 Endpoint DOM Interaction Config | **Produces:** Consistent naming for selector portfolio
**Source:** `docs/audits/ARCHITECTURAL-ADJUSTMENTS.md` §Adjustment 2

## Purpose
Rename `selectorJson` → `selectorsJson` to accurately reflect that it contains a **portfolio** of selectors (composer, sendButton, contentArea, modelSelector), not a single selector.

## Interface

### Schema Change
```prisma
model ProviderEndpoint {
  // ... existing fields ...
  selectorsJson String @default("{}") @map("selectors_json")  // Renamed from selectorJson
}
```

### Type Update
```typescript
// In src/schema/types.ts
export interface ProviderEndpointRow {
  // ... existing fields ...
  selectors_json: string  // Renamed from selector_json
}
```

### Registrar Update
```typescript
// In src/engines/provider-registrar.ts
const epRow: ProviderEndpointRow = {
  // ... existing fields ...
  selectors_json: JSON.stringify(endpoint.selectors ?? {}),
}
```

### Store Impl Update
```typescript
// In src/storage/impl/provider-store-impl.ts
// Update all references from selector_json to selectors_json
```

## Store Contract
```typescript
// No new methods needed — just rename field references
```

## Seed Data Update
Update all `seeds/providers/*.json` to use new field name:
```json
{
  "endpoints": [{
    "label": "Chat",
    "url": "https://claude.ai/chat",
    "endpoint_type": "chat",
    "is_default": true,
    "selectors": {
      "composer": { "css": "#prompt-textarea", "aria": "textbox" },
      "sendButton": { "css": "[data-testid='send-button']", "aria": "Send" },
      "contentArea": { "css": ".markdown", "role": "article" }
    }
  }]
}
```

## Tests
- Schema migration succeeds (SQLite table rebuild)
- All references updated correctly
- No runtime errors from missing field

## Effort
**S** (1 hour) — Rename + update all references
