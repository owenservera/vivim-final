# Data Model: LLM-as-Human Production Testing System

## Entities

### Pattern

Learned test pattern — what works, what fails, with confidence scoring.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique pattern ID (e.g., `P001`) |
| `surface` | `TestSurface` | Which surface this pattern applies to |
| `capability` | `string` | Capability slug (e.g., `conversation_send`) |
| `pattern` | `string` | Human-readable description of what works |
| `confidence` | `number` | 0.0–1.0, increases with successful verifications |
| `lastVerified` | `string` | ISO timestamp of last successful verification |
| `failures` | `PatternFailure[]` | History of failures with root cause + fix |
| `tags` | `string[]` | Searchable tags (e.g., `["conversation", "send", "core"]`) |

**State transitions**:
- New pattern: confidence = 0.8 (pass) or 0.3 (fail)
- Verified again: confidence = min(1.0, confidence + 0.05)
- Failed: confidence = max(0.0, confidence - 0.2), failure appended
- Stale (not verified > 30 days): confidence = confidence * 0.9

### PatternFailure

Record of a pattern failure with root cause analysis.

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `string` | ISO timestamp of failure |
| `symptom` | `string` | What went wrong (observable behavior) |
| `rootCause` | `string` | Why it went wrong (diagnosed) |
| `fix` | `string` | How to fix it (actionable) |

### ProviderKnowledge

Provider-specific knowledge — selectors, quirks, success rates.

| Field | Type | Description |
|-------|------|-------------|
| `composerSelector` | `string` | CSS selector for the text input |
| `sendMethod` | `'enter-or-click' \| 'click-send-button'` | How to send |
| `sendButtonSelector` | `string?` | CSS selector for send button (if click-required) |
| `enterKeyBroken` | `boolean` | Whether Enter key works for sending |
| `streamFormat` | `string` | Wire format (e.g., `batchexecute`, `openai-sse`) |
| `quirks` | `string[]` | Provider-specific gotchas |
| `lastTested` | `string` | ISO timestamp |
| `successRate` | `number` | 0.0–1.0, rolling success rate |

### SurfaceCoverage

Coverage metrics per surface.

| Field | Type | Description |
|-------|------|-------------|
| `totalCapabilities` | `number` | Total capabilities exposed on this surface |
| `testedCapabilities` | `number` | Capabilities with at least one passing test |
| `coverage` | `number` | 0.0–1.0, testedCapabilities / totalCapabilities |
| `lastFullRun` | `string` | ISO timestamp of last full test run |
| `gaps` | `string[]` | Capability slugs never tested |

### ErrorEntry

Error pattern with root cause and fix.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique error ID (e.g., `E001`) |
| `surface` | `TestSurface` | Where the error occurred |
| `capability` | `string` | Which capability |
| `error` | `string` | Error message (observable) |
| `rootCause` | `string` | Diagnosed root cause |
| `fix` | `string` | Actionable fix |
| `occurrences` | `number` | How many times seen |
| `lastSeen` | `string` | ISO timestamp |
| `resolved` | `boolean` | Whether the fix has been verified |

### PriorityEntry

Weighted test priority — what to test next.

| Field | Type | Description |
|-------|------|-------------|
| `surface` | `TestSurface` | Which surface |
| `capability` | `string` | Which capability |
| `reason` | `string` | Why this is prioritized |
| `riskScore` | `number` | 0.0–1.0, higher = more urgent |
| `coverageGap` | `number` | 0.0–1.0, 1.0 = never tested |

**Scoring formula**:
```
riskScore = (errorRate * 0.4) + (coverageGap * 0.3) + (complexity * 0.3)
```
Where:
- `errorRate` = recent failures / total attempts (last 10 runs)
- `coverageGap` = 1.0 - currentCoverage for this surface
- `complexity` = estimated from capability's inputSchema depth + handler size

### SessionTrace

Full trace of one test run.

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | `sess_YYYYMMDD_HHMMSS` |
| `startedAt` | `string` | ISO timestamp |
| `endedAt` | `string` | ISO timestamp |
| `mode` | `string` | `smoke \| full \| parity \| providers \| workflow` |
| `config` | `object` | `{ backendPort, frontendPort, providers }` |
| `tests` | `TestResult[]` | All test results |
| `summary` | `SessionSummary` | Aggregate stats |

### TestResult

Individual test outcome.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Test case ID |
| `surface` | `TestSurface` | Which surface |
| `capability` | `string` | Which capability |
| `action` | `string` | What the LLM did |
| `expected` | `string` | What should happen |
| `actual` | `string` | What actually happened |
| `status` | `string` | `pass \| fail \| skip \| error` |
| `durationMs` | `number` | How long it took |
| `timestamp` | `string` | ISO timestamp |
| `screenshot` | `string?` | Path to screenshot (UI/provider tests) |
| `consoleLogs` | `string[]?` | Browser console messages |
| `networkRequests` | `string[]?` | Network requests made |
| `error` | `string?` | Error message (if fail/error) |
| `fix` | `string?` | Suggested fix |

## Relationships

```
SessionTrace 1──* TestResult
TestResult *──* Pattern (via surface + capability)
TestResult *──* ErrorEntry (via error signature)
Pattern 1──* PatternFailure
SurfaceCoverage *──1 TestSurface (key)
PriorityEntry *──1 TestSurface (key)
```

## Validation Rules

1. `confidence` must be 0.0–1.0
2. `successRate` must be 0.0–1.0
3. `coverage` must be 0.0–1.0
4. `riskScore` must be 0.0–1.0
5. `sessionId` must match `sess_YYYYMMDD_HHMMSS`
6. `TestResult.status` must be one of: `pass`, `fail`, `skip`, `error`
7. `TestSurface` must be one of: `cli`, `ui`, `api`, `mcp`, `workflow`, `provider`
8. All timestamps must be valid ISO 8601
