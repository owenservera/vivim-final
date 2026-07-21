# Contract: Knowledge Schema

## File Structure

```
.runtime/llm-testing/knowledge/
├── patterns.json      # Pattern[]
├── providers.json     # Record<string, ProviderKnowledge>
├── surfaces.json      # Record<TestSurface, SurfaceCoverage>
├── errors.json        # ErrorEntry[]
└── priorities.json    # PriorityEntry[]
```

## schemas

### patterns.json

```json
{
  "version": 1,
  "lastUpdated": "2026-07-20T12:00:00Z",
  "patterns": [
    {
      "id": "P001",
      "surface": "cli",
      "capability": "conversation_list",
      "pattern": "CLI `conversations list` returns array of conversations",
      "confidence": 0.95,
      "lastVerified": "2026-07-20T12:00:00Z",
      "failures": [],
      "tags": ["conversation", "list", "core"]
    }
  ]
}
```

**Validation**:
- `version` must be `1`
- `patterns` must be array
- Each pattern: `id` unique, `confidence` 0.0–1.0, `surface` valid TestSurface

### providers.json

```json
{
  "gemini": {
    "composerSelector": "div.ql-editor[contenteditable='true']",
    "sendMethod": "click-send-button",
    "sendButtonSelector": "button[aria-label='Send message']",
    "enterKeyBroken": true,
    "streamFormat": "batchexecute",
    "quirks": ["Quill editor — Enter inserts newline"],
    "lastTested": "2026-07-20T12:00:00Z",
    "successRate": 0.85
  }
}
```

**Validation**:
- Keys must be valid provider slugs
- `sendMethod` must be `enter-or-click` or `click-send-button`
- `successRate` 0.0–1.0

### surfaces.json

```json
{
  "cli": {
    "totalCapabilities": 40,
    "testedCapabilities": 35,
    "coverage": 0.875,
    "lastFullRun": "2026-07-20T12:00:00Z",
    "gaps": ["telemetry_summary"]
  }
}
```

**Validation**:
- Keys must be valid TestSurface values
- `coverage` = `testedCapabilities / totalCapabilities`
- `gaps` are capability slugs

### errors.json

```json
{
  "errors": [
    {
      "id": "E001",
      "surface": "ui",
      "capability": "conversation_send",
      "error": "Composer textarea not found",
      "rootCause": "Page not fully loaded",
      "fix": "Wait for networkidle before interacting",
      "occurrences": 3,
      "lastSeen": "2026-07-20T12:00:00Z",
      "resolved": true
    }
  ]
}
```

**Validation**:
- `id` unique
- `occurrences` >= 1
- `resolved` boolean

### priorities.json

```json
{
  "version": 1,
  "lastComputed": "2026-07-20T12:00:00Z",
  "queue": [
    {
      "surface": "ui",
      "capability": "oracle_query",
      "reason": "never tested on UI surface",
      "riskScore": 0.8,
      "coverageGap": 1.0
    }
  ]
}
```

**Validation**:
- `version` must be `1`
- `queue` sorted by `riskScore` descending
- `riskScore` 0.0–1.0
- `coverageGap` 0.0–1.0

## Bootstrap

On first run, `KnowledgeStore.bootstrap()` creates:

```json
// patterns.json
{ "version": 1, "lastUpdated": "<now>", "patterns": [] }

// providers.json
{
  "gemini": { "composerSelector": "", "sendMethod": "click-send-button", "enterKeyBroken": true, "streamFormat": "batchexecute", "quirks": [], "lastTested": "", "successRate": 0 },
  "chatgpt": { "composerSelector": "#prompt-textarea", "sendMethod": "enter-or-click", "enterKeyBroken": false, "streamFormat": "openai-sse", "quirks": [], "lastTested": "", "successRate": 0 },
  "claude": { "composerSelector": "div[contenteditable='true']", "sendMethod": "enter-or-click", "enterKeyBroken": false, "streamFormat": "anthropic-sse", "quirks": [], "lastTested": "", "successRate": 0 }
}

// surfaces.json
{ "cli": { "totalCapabilities": 0, "testedCapabilities": 0, "coverage": 0, "lastFullRun": "", "gaps": [] }, ... }

// errors.json
{ "errors": [] }

// priorities.json
{ "version": 1, "lastComputed": "", "queue": [] }
```

## Merge Rules

After each session, the `PatternAnalyzer` produces a delta:

```typescript
interface KnowledgeDelta {
  newPatterns: Pattern[]
  updatedPatterns: Pattern[]
  newErrors: ErrorEntry[]
  updatedErrors: ErrorEntry[]
}
```

Merge rules:
1. **New patterns**: Append to `patterns.json`
2. **Updated patterns**: Find by `id`, merge fields, keep longer `failures` array
3. **New errors**: Append to `errors.json`
4. **Updated errors**: Find by `id`, increment `occurrences`, update `lastSeen`, merge `fix` if changed
5. **Surfaces**: Recompute `coverage` from patterns, update `gaps`
6. **Priorities**: Recompute from scratch using `PriorityEngine.computePriorities()`
