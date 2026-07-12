# Architectural Adjustments — Provider Logic Metadata

**Date:** 2026-07-11
**Purpose:** Identify schema adjustments needed before continuing implementation
**Status:** Analysis complete, adjustments identified

---

## Executive Summary

The current schema is **80% complete**. Three targeted adjustments are needed to fully support the provider logic lifecycle. No major rewrites required — just additive fields.

---

## Current State Analysis

### What's Already Implemented ✅

| Table | Status | Notes |
|-------|--------|-------|
| `ProviderDefinition` | ✅ Complete | Core identity, auth, fleet config |
| `ProviderParser` | ✅ Complete | File + inline logic, versioning, fallback |
| `ProviderStreamConfig` | ✅ Complete | Transport, terminal signals, completion detectors |
| `ProviderCapability` | ✅ Complete | Recovery strategies, UI overrides, metrics |
| `ProviderModel` | ✅ Complete | Model metadata, capabilities, pricing |
| `ProviderConfig` | ✅ Complete | Key-value config |
| `SelectorStrategy` | ✅ Complete | Selector portfolio with hit/miss metrics |
| `ProviderHealth` | ✅ Complete | Runtime health state |
| `ProviderHealthHistory` | ✅ Complete | Historical health snapshots |
| `ManifestDrift` | ✅ Complete | Drift detection records |
| `DriftEvent` | ✅ Complete | Drift event tracking |
| `ConfigAudit` | ✅ Complete | Config change audit trail |

### What's Missing ❌

| Table | Missing Fields | Priority |
|-------|----------------|----------|
| `ProviderEndpoint` | `composerType`, `sendMethod`, `contentEditable` | **HIGH** |
| `ProviderEndpoint` | `selectorsJson` (rename from `selectorJson`) | **MEDIUM** |
| `ProviderParser` | `parserHash` auto-computation | **LOW** |

---

## Adjustment 1: ProviderEndpoint — DOM Interaction Config

### Current Schema
```prisma
model ProviderEndpoint {
  id           String @id
  providerId   String @map("provider_id")
  url          String
  label        String
  endpointType String @default("landing") @map("endpoint_type")
  isDefault    Int    @default(0) @map("is_default")
  selectorJson String @default("{}") @map("selector_json")
  createdAt    Int    @map("created_at")
  updatedAt    Int    @map("updated_at")
}
```

### Problem
Missing fields to describe **how to interact** with the provider UI:
- `composerType` — What type of input element (textarea, prosemirror, quill)
- `sendMethod` — How to submit (enter_key, button_click, both)
- `contentEditable` — Whether it's a contenteditable element (requires CDP Input domain)

### Proposed Adjustment
```prisma
model ProviderEndpoint {
  id              String @id
  providerId      String @map("provider_id")
  url             String
  label           String
  endpointType    String @default("landing") @map("endpoint_type")
  isDefault       Int    @default(0) @map("is_default")
  
  // Selector Portfolio (renamed from selectorJson)
  selectorsJson   String @default("{}") @map("selectors_json")
  // {
  //   "composer": { "css": "#prompt-textarea", "aria": "textbox" },
  //   "sendButton": { "css": "[data-testid='send-button']", "aria": "Send" },
  //   "contentArea": { "css": ".markdown", "role": "article" },
  //   "modelSelector": { "css": "select", "aria": "Model" }
  // }
  
  // DOM Interaction Config (NEW)
  composerType    String @default("textarea") @map("composer_type")
  // 'textarea' | 'contenteditable' | 'prosemirror' | 'quill'
  
  sendMethod      String @default("both") @map("send_method")
  // 'enter_key' | 'button_click' | 'both'
  
  contentEditable Int    @default(0) @map("content_editable")
  // 1 = requires Input.insertText, 0 = standard textarea
  
  createdAt       Int    @map("created_at")
  updatedAt       Int    @map("updated_at")
}
```

### Impact
- **Migration:** Add 3 new columns (backward compatible, defaults provided)
- **Seed data:** Update `seeds/providers/*.json` to include new fields
- **Engine:** Update `SelectorHealer` to use `composerType` for interaction strategy

---

## Adjustment 2: ProviderEndpoint — Rename selectorJson → selectorsJson

### Current Schema
```prisma
selectorJson String @default("{}") @map("selector_json")
```

### Problem
- Singular name implies single selector
- Actual content is a portfolio of selectors (composer, sendButton, contentArea, etc.)

### Proposed Adjustment
```prisma
selectorsJson String @default("{}") @map("selectors_json")
```

### Impact
- **Migration:** Rename column (SQLite requires table rebuild)
- **Code:** Update all references to `selectorJson` → `selectorsJson`

---

## Adjustment 3: ProviderParser — Auto-compute parserHash

### Current Schema
```prisma
parserHash String? @map("parser_hash")
```

### Problem
- `parserHash` must be computed when parser is stored
- Currently manual — prone to drift

### Proposed Solution
Add hash computation in `ProviderRegistrar.register()`:
```typescript
// When upserting parser
const hash = await computeHash(parser.logicCode ?? parser.filePath)
parserRow.parser_hash = hash
```

### Impact
- **Code:** Update `ProviderRegistrar` to compute hash
- **No schema change:** Field already exists

---

## Adjustment 4: ProviderStreamConfig — Add deltaPathJson Validation

### Current Schema
```prisma
deltaPathJson String? @map("delta_path_json")
```

### Problem
- No validation on delta path format
- Invalid paths cause silent failures

### Proposed Solution
Add Zod validation in `ProviderManifestSchema`:
```typescript
deltaPath: z.string().regex(/^choices\[\d+\]\.delta\.\w+$/).optional()
```

### Impact
- **Code:** Update Zod schema
- **No schema change:** Field already exists

---

## Summary of Adjustments

| Adjustment | Type | Effort | Risk |
|------------|------|--------|------|
| 1. Add `composerType`, `sendMethod`, `contentEditable` | Schema | 30 min | Low |
| 2. Rename `selectorJson` → `selectorsJson` | Schema | 15 min | Low |
| 3. Auto-compute `parserHash` | Code | 15 min | Low |
| 4. Validate `deltaPathJson` | Code | 10 min | Low |

**Total:** ~70 minutes, all low-risk, all backward compatible

---

## Recommended Order

1. **Adjustment 1** — Add DOM interaction fields to `ProviderEndpoint`
2. **Adjustment 2** — Rename `selectorJson` → `selectorsJson`
3. **Adjustment 3** — Auto-compute `parserHash` in `ProviderRegistrar`
4. **Adjustment 4** — Validate `deltaPathJson` in Zod schema

---

## What NOT to Change

| Current Design | Why It's Correct |
|----------------|------------------|
| `ProviderCapability.recoveryStrategiesJson` as JSON blob | Recovery strategies are complex, nested structures — JSON is appropriate |
| `ProviderStreamConfig.completionDetectorsJson` as JSON array | Completion detectors are simple, array of patterns — JSON is appropriate |
| `ProviderParser.parserLogicCode` as text field | Inline parser code can be large — text field is appropriate |
| `SelectorStrategy` as separate table | Selectors need hit/miss metrics — separate table is correct |
| `ProviderHealth` as separate table | Health state is queried independently — separate table is correct |

---

## Next Steps

1. Apply Adjustment 1: Add `composerType`, `sendMethod`, `contentEditable` to `ProviderEndpoint`
2. Apply Adjustment 2: Rename `selectorJson` → `selectorsJson`
3. Apply Adjustment 3: Auto-compute `parserHash` in `ProviderRegistrar`
4. Apply Adjustment 4: Validate `deltaPathJson` in Zod schema
5. Update seed data to include new fields
6. Update tests to use new fields

Want me to apply these adjustments now?
