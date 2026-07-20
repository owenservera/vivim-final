# Quickstart: Command Language (Enhanced)

**Feature**: `029-command-language`
**Date**: 2026-07-19

## Prerequisites

- Bun installed (`bun --version`)
- Database migrated (`bunx prisma migrate dev`)
- Backend running (`bun run serve`)
- Frontend running (`pwsh scripts/start-frontend.ps1`)

## Validation Scenarios

### Scenario 1: Prefix Command Routing (US1)

**Test**: `/health` returns system health

```bash
# Via API
curl -X POST http://localhost:9421/api/interpret \
  -H "Content-Type: application/json" \
  -d '{"input": "/health", "sessionId": "test"}'

# Expected: Health summary with providers, engines, uptime
```

**Test**: `@claude explain recursion` routes to Claude

```bash
curl -X POST http://localhost:9421/api/interpret \
  -H "Content-Type: application/json" \
  -d '{"input": "@claude explain recursion", "sessionId": "test"}'

# Expected: Response streams from Claude provider
```

### Scenario 2: NLP Intent Detection (US7)

**Test**: Plain text "switch to claude" detects intent

```bash
curl -X POST http://localhost:9421/api/interpret \
  -H "Content-Type: application/json" \
  -d '{"input": "switch to claude", "sessionId": "test"}'

# Expected: intent.commandId = "slash.switch", confidence >= 0.8
```

**Test**: "create a new conversation" maps to `/new`

```bash
curl -X POST http://localhost:9421/api/interpret \
  -H "Content-Type: application/json" \
  -d '{"input": "create a new conversation", "sessionId": "test"}'

# Expected: intent.commandId = "slash.new", category = "conversation"
```

### Scenario 3: Multi-Command Combo Detection (US7)

**Test**: "switch to claude and ask about rust" decomposes into 2 commands

```bash
curl -X POST http://localhost:9421/api/interpret \
  -H "Content-Type: application/json" \
  -d '{"input": "switch to claude and ask about rust", "sessionId": "test"}'

# Expected: combo.intents.length = 2, executionOrder = "sequential"
```

### Scenario 4: Color Mapping (US7)

**Test**: Each category maps to correct primary color

```bash
# Via frontend: type each command and observe prompt box border color
/new         → Blue (conversation)
/save        → Amber (memory)
/send        → Emerald (email)
!health      → Rose (system)
@claude      → Violet (llm)
#important   → Teal (channel)
```

### Scenario 5: Progressive Interpretation (US7)

**Test**: Interpretation expands as user types

```bash
# Via frontend:
1. Type "@" → L1: "Provider mention" (Violet border)
2. Type "@cl" → L1: "Send to Claude" (Violet border)
3. Type "@claude " → L2: "Send to Claude · Prompt: " (Violet border)
4. Type "@claude explain recursion" → L2: "Send to Claude · Prompt: explain recursion"
5. Press Tab → L3: "Send to Claude · Prompt: explain recursion · Response will stream in main panel"
```

### Scenario 6: Autocomplete (US2)

**Test**: Fuzzy matching with MRU boost

```bash
# Via frontend:
1. Press ⌘K to open palette
2. Type "health" → !health appears as top result
3. Type "/sw" → /switch appears as top result
4. Use /health 5 times, then type "/h" → /health boosted to top
```

### Scenario 7: Context References (US3)

**Test**: `~last` resolves to previous AI response

```bash
# Via frontend:
1. Send a message to Claude, wait for response
2. Type "~last /save"
3. Press Enter → Flashcard created with AI response text
```

### Scenario 8: DevOps Commands (US4)

**Test**: `!invariants` returns invariant check results

```bash
curl -X POST http://localhost:9421/api/interpret \
  -H "Content-Type: application/json" \
  -d '{"input": "!invariants", "sessionId": "test"}'

# Expected: Invariant check results (0 violations if clean)
```

### Scenario 9: Command Description Seeding (US8)

**Test**: CommandDescription table is seeded

```bash
curl http://localhost:9421/api/command-descriptions

# Expected: { "commands": [...], "total": 200 }
```

### Scenario 10: Cross-Surface Parity (All)

**Test**: All commands work across CLI, API, UI

```bash
# CLI
bun run cli health
bun run cli "switch to claude"

# API
curl -X POST http://localhost:9421/api/interpret ...

# UI
# Type in composer, verify same behavior
```

## Expected Outcomes

| Scenario | Expected Result |
|----------|-----------------|
| Prefix routing | Deterministic, < 100ms |
| NLP detection | ≥ 85% accuracy for common phrases |
| Combo detection | Correct sequential/parallel decomposition |
| Color mapping | WCAG AA compliant, correct category |
| Interpretation | Progressive L0-L3 disclosure |
| Autocomplete | < 50ms suggestions, MRU boost works |
| Context refs | ~last resolves to actual response |
| DevOps commands | All 15 ! commands functional |
| Seeding | 200+ commands, 600+ patterns |
| Cross-surface | CLI = API = UI behavior |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| NLP matching slow | Check `CommandDescription` index on `category` + `enabled` |
| Colors not rendering | Verify `CATEGORY_COLORS` map has all 12 categories |
| Combo not detected | Check dependency graph between categories |
| Interpretation not showing | Verify `InterpretationConfig.position` is set |
| MRU not persisting | Check `Session` model JSON field has `recentCommands` |
