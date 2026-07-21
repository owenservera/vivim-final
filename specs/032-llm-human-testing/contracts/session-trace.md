# Contract: Session Trace

## Format

Each test session produces a JSON file at:
```
.runtime/llm-testing/sessions/<sessionId>.json
```

Where `sessionId` = `sess_YYYYMMDD_HHMMSS`

## Schema

```json
{
  "sessionId": "sess_20260720_120000",
  "startedAt": "2026-07-20T12:00:00.000Z",
  "endedAt": "2026-07-20T12:45:00.000Z",
  "mode": "full",
  "config": {
    "backendPort": 9420,
    "frontendPort": 5175,
    "providers": ["gemini", "chatgpt", "claude"]
  },
  "tests": [
    {
      "id": "T001",
      "surface": "cli",
      "capability": "conversation_list",
      "action": "type 'conversations list' in REPL",
      "expected": "Returns array of conversations",
      "actual": "Returns array of 5 conversations",
      "status": "pass",
      "durationMs": 150,
      "timestamp": "2026-07-20T12:01:00.000Z"
    },
    {
      "id": "T002",
      "surface": "ui",
      "capability": "conversation_send",
      "action": "Navigate to localhost:5175, type in composer, press Enter",
      "expected": "Response streams into ChatSurface",
      "actual": "Response streamed correctly",
      "status": "pass",
      "durationMs": 3200,
      "screenshot": "sessions/screenshots/T002.png",
      "timestamp": "2026-07-20T12:05:00.000Z"
    },
    {
      "id": "T003",
      "surface": "provider",
      "capability": "conversation_send",
      "action": "Navigate to Gemini, type prompt, click send",
      "expected": "Streaming response from Gemini",
      "actual": "Enter key inserted newline instead of sending",
      "status": "fail",
      "durationMs": 5000,
      "screenshot": "sessions/screenshots/T003.png",
      "error": "Gemini Quill editor — Enter broken, must click send button",
      "fix": "Use click() on send button selector",
      "timestamp": "2026-07-20T12:10:00.000Z"
    }
  ],
  "summary": {
    "total": 50,
    "passed": 45,
    "failed": 3,
    "skipped": 1,
    "errored": 1,
    "newPatternsLearned": 2,
    "errorsEncountered": 3,
    "coverageDelta": {
      "cli": { "before": 0.85, "after": 0.875 },
      "ui": { "before": 0.68, "after": 0.7 },
      "api": { "before": 1.0, "after": 1.0 },
      "mcp": { "before": 0.5, "after": 0.55 },
      "workflow": { "before": 0.3, "after": 0.4 },
      "provider": { "before": 0.6, "after": 0.65 }
    }
  }
}
```

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | `string` | yes | `sess_YYYYMMDD_HHMMSS` |
| `startedAt` | `string` | yes | ISO 8601 timestamp |
| `endedAt` | `string` | yes | ISO 8601 timestamp |
| `mode` | `string` | yes | `smoke \| full \| parity \| providers \| workflow` |
| `config.backendPort` | `number` | yes | Backend port (default 9420) |
| `config.frontendPort` | `number` | yes | Frontend port (default 5175) |
| `config.providers` | `string[]` | yes | Provider slugs tested |
| `tests` | `TestResult[]` | yes | All test results |
| `summary.total` | `number` | yes | Total tests executed |
| `summary.passed` | `number` | yes | Tests with status `pass` |
| `summary.failed` | `number` | yes | Tests with status `fail` |
| `summary.skipped` | `number` | yes | Tests with status `skip` |
| `summary.errored` | `number` | yes | Tests with status `error` |
| `summary.newPatternsLearned` | `number` | yes | New patterns added to knowledge |
| `summary.errorsEncountered` | `number` | yes | New/updated error entries |
| `summary.coverageDelta` | `object` | yes | Per-surface before/after coverage |

## Screenshots

Screenshots for UI and provider tests are saved to:
```
.runtime/llm-testing/sessions/screenshots/<testId>.png
```

The `screenshot` field in `TestResult` contains the relative path.

## Report

A human-readable markdown report is generated at:
```
.runtime/llm-testing/reports/<sessionId>.md
```

Format:
```markdown
# Test Session Report

**Session**: sess_20260720_120000
**Date**: 2026-07-20T12:00:00.000Z
**Mode**: full
**Duration**: 45 minutes

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 50 |
| Passed | 45 |
| Failed | 3 |
| Skipped | 1 |
| Errored | 1 |

## Coverage

| Surface | Before | After | Delta |
|---------|--------|-------|-------|
| cli | 85.0% | 87.5% | +2.5% |
| ui | 68.0% | 70.0% | +2.0% |
| api | 100.0% | 100.0% | 0.0% |
| mcp | 50.0% | 55.0% | +5.0% |
| workflow | 30.0% | 40.0% | +10.0% |
| provider | 60.0% | 65.0% | +5.0% |

## Failed Tests

### T003 — provider/conversation_send
- **Action**: Navigate to Gemini, type prompt, click send
- **Expected**: Streaming response from Gemini
- **Actual**: Enter key inserted newline instead of sending
- **Error**: Gemini Quill editor — Enter broken, must click send button
- **Fix**: Use click() on send button selector

## New Patterns Learned

- cli/conversation_list: `conversations list` returns array → confidence 0.8
- ui/conversation_send: Composer typing + Enter works → confidence 0.8

## Knowledge Updated

- patterns.json: +2 new patterns
- providers.json: gemini.successRate updated to 0.85
- surfaces.json: cli.coverage updated to 0.875
- priorities.json: recomputed (20 entries)
```
