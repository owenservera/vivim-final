# Unit 2.13: ProviderEndpoint DOM Interaction Config

**Phase:** 2 | **File:** `prisma/schema.prisma`, `src/engines/provider-registrar.ts`
**Depends:** 2.1 ProviderRegistrar | **Produces:** DOM interaction metadata per endpoint
**Source:** `docs/audits/PROVIDER-LIFECYCLE.md` §2 Y-Axis

## Purpose
Add fields to `ProviderEndpoint` that describe **how to interact** with each provider's UI. Without these, we cannot determine the correct CDP interaction strategy (textarea vs contenteditable vs prosemirror).

## Interface

### Schema Change
```prisma
model ProviderEndpoint {
  // ... existing fields ...
  
  // DOM Interaction Config (NEW)
  composerType    String @default("textarea") @map("composer_type")
  // 'textarea' | 'contenteditable' | 'prosemirror' | 'quill'
  
  sendMethod      String @default("both") @map("send_method")
  // 'enter_key' | 'button_click' | 'both'
  
  contentEditable Int    @default(0) @map("content_editable")
  // 1 = requires Input.insertText, 0 = standard textarea
}
```

### Zod Schema Update
```typescript
// In src/schema/provider-manifest.ts
const EndpointSchema = z.object({
  // ... existing fields ...
  composer_type: z.enum(['textarea', 'contenteditable', 'prosemirror', 'quill']).optional().default('textarea'),
  send_method: z.enum(['enter_key', 'button_click', 'both']).optional().default('both'),
  content_editable: z.boolean().optional().default(false),
})
```

### Type Update
```typescript
// In src/schema/types.ts
export interface ProviderEndpointRow {
  // ... existing fields ...
  composer_type: string
  send_method: string
  content_editable: number
}
```

### Registrar Update
```typescript
// In src/engines/provider-registrar.ts
// Update upsertEndpoint to include new fields
const epRow: ProviderEndpointRow = {
  // ... existing fields ...
  composer_type: endpoint.composer_type ?? 'textarea',
  send_method: endpoint.send_method ?? 'both',
  content_editable: endpoint.content_editable ? 1 : 0,
}
```

## Store Contract
```typescript
// No new store methods needed — existing upsertEndpoint handles new fields
```

## Seed Data Update
Update all `seeds/providers/*.json` to include new fields:
```json
{
  "endpoints": [{
    "label": "Chat",
    "url": "https://claude.ai/chat",
    "endpoint_type": "chat",
    "is_default": true,
    "composer_type": "prosemirror",
    "send_method": "both",
    "content_editable": true
  }]
}
```

## Provider-Specific Values

| Provider | composer_type | send_method | content_editable |
|----------|---------------|-------------|------------------|
| claude | prosemirror | both | true |
| chatgpt | textarea | both | false |
| gemini | quill | both | true |
| deepseek | textarea | both | false |
| qwen | textarea | both | false |
| studio-ai | textarea | both | false |
| z-ai | textarea | both | false |

## Tests
- Schema migration succeeds
- ProviderRegistrar correctly maps new fields
- Zod validation accepts valid values
- Zod validation rejects invalid values

## Effort
**S** (2 hours) — Schema change + type updates + seed data updates
