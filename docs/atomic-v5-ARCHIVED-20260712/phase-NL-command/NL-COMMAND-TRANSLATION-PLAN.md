> **⚠️ SUPERSEDED — See docs/atomic-v3-fork-canon/ (MASTER) for current phase specs.**

# NL Command Translation Layer — Native Wiring Strategy

**Status:** DRAFT
**Author:** research session 2026-07-12
**Depends on:** v5 Phase 2 (Agentic Core — units 2.1-2.3), Phase 6 (Platform Foundation)
**Produces:** 4-layer NL→action pipeline achieving ~95% command coverage without cloud LLM

---

## 1. Problem Statement

Non-technical users need full system control (file ops, browser automation, git, etc.) via natural language commands typed into the UI. The system must translate "open file report.pdf" or "get rid of that old document" into executable capability actions — **without relying on cloud LLMs** for the common case.

## 2. Current State (v5 Tracker)

| Component | Status | Relevance |
|-----------|--------|-----------|
| `SituationDetector` | ✅ EXISTS | Regex-based task type classification — L0 pattern seed data |
| `AgenticLoopEngine` | ✅ EXISTS (unwired) | SENSE→PLAN→ACT loop — consumer of NL parse results |
| `IntentDecomposer` (v5 2.1-2.3) | 🔲 CREATE | Template + LLM + clarification — direct NL→DAG target |
| `LocalModelAdapter` | ✅ EXISTS | Ollama/llama.cpp inference — L3 fallback |
| `UnifiedCapabilityRegistry` | ✅ EXISTS | 20+ registered capabilities — what NL maps TO |
| `CapabilityEventBus` | ✅ EXISTS | Typed pub/sub — wiring backbone |
| `AgentBridge` | ✅ EXISTS (frontend) | WebSocket command routing — how frontend sends NL |
| `ConversationManager` | ✅ EXISTS | 8-step send pipeline — where NL enters |
| Frontend (`web/sandbox/`) | ✅ EXISTS | React app — command input UI |

## 3. Architecture: 4-Layer Native Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND: Command Input (web/sandbox or web/workspace)      │
│  User types: "open file report.pdf" or "run git status"      │
└──────────────────┬───────────────────────────────────────────┘
                   │ WebSocket: { type: "command:parse", text }
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  LAYER 0: NlRuleEngine (NEW)                                  │
│  Regex + keyword + synonym map. <1ms. Zero deps.              │
│  Catches: exact commands, synonyms, parameter extraction      │
│  Output: { intent, confidence, params } or MISS               │
└──────────────────┬───────────────────────────────────────────┘
                   │ (MISS or confidence < 0.8)
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  LAYER 1: NlClassifierEngine (NEW)                            │
│  @xenova/transformers DistilBERT. ~250MB. <50ms.              │
│  Trained on vivim command taxonomy. Handles paraphrases.      │
│  Output: { intent, confidence, params } or LOW_CONFIDENCE     │
└──────────────────┬───────────────────────────────────────────┘
                   │ (LOW_CONFIDENCE)
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  LAYER 2: NlToActionEngine (NEW)                              │
│  IntentDecomposer template match first,                       │
│  then LocalModelAdapter for LLM-backed decomposition.         │
│  Output: CapabilityDAG                                        │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  EXISTING: UnifiedCapabilityRegistry.execute(capabilitySlug)  │
│  OR: AgenticLoopEngine.executeAgenticLoop(goal)               │
└──────────────────────────────────────────────────────────────┘
```

### Layer Details

**L0 — NlRuleEngine** (deterministic, <1ms)
- Pattern registry: `{ intent, patterns: RegExp[], synonyms: Map, paramExtractors }`
- Loaded from `seeds/nl-rules/` at boot
- Users can add rules via `POST /api/nl/rules`
- Coverage: ~70-80% of common commands

**L1 — NlClassifierEngine** (ML, <50ms)
- DistilBERT fine-tuned on vivim command taxonomy
- Training data: `seeds/nl-training/` (intent→utterance pairs)
- Model exported to ONNX, loaded via `@xenova/transformers`
- Handles paraphrases: "get rid of" → delete intent
- Coverage: ~90-95% including paraphrases

**L2 — NlToActionEngine** (hybrid, <500ms)
- First tries IntentDecomposer template match (v5 unit 2.1)
- Falls back to LocalModelAdapter for novel phrasings
- Produces CapabilityDAG for multi-step commands
- Only invoked when L0+L1 both fail or return low confidence

## 4. New Files

### Engines
| File | Purpose |
|------|---------|
| `src/engines/nl-rule-engine.ts` | L0: Pattern matching, synonyms, regex extraction |
| `src/engines/nl-classifier.ts` | L1: Fine-tuned DistilBERT classifier |
| `src/engines/nl-to-action.ts` | L2: NL→CapabilityDAG via IntentDecomposer + LocalModelAdapter |
| `src/engines/nl-command-pipeline.ts` | Orchestrator: wires L0→L1→L2→execution |

### Storage
| File | Purpose |
|------|---------|
| `src/storage/contracts/nl-command-store.ts` | Training data, rule definitions, classification results |
| `src/storage/impl/nl-command-store-impl.ts` | Prisma implementation |

### Schema
| File | Purpose |
|------|---------|
| `src/schema/nl-command.ts` | Zod schemas: NlParseRequest, NlParseResult, NlClarifyRequest |

### Server
| File | Purpose |
|------|---------|
| `src/server/nl-command-router.ts` | REST + WebSocket endpoint for NL commands |

### Seeds
| File | Purpose |
|------|---------|
| `seeds/nl-rules/file-ops.json` | File operation rules (open, delete, move, copy, rename) |
| `seeds/nl-rules/git-ops.json` | Git operation rules (commit, branch, push, pull) |
| `seeds/nl-rules/browser-ops.json` | Browser automation rules (navigate, click, extract) |
| `seeds/nl-rules/system-ops.json` | System rules (run process, check status, config) |
| `seeds/nl-training/intents.json` | Intent→utterance pairs for classifier training |

### Tests
| File | Purpose |
|------|---------|
| `tests/unit/engines/nl-rule-engine.test.ts` | Unit tests for L0 |
| `tests/unit/engines/nl-classifier.test.ts` | Unit tests for L1 |
| `tests/integration/nl-command-pipeline.test.ts` | Integration test for full pipeline |

## 5. Integration Points

### 5.1 ConversationManager.send
```typescript
// Before entering the 8-step pipeline, check if input is a command
const nlResult = await nlPipeline.parse(text)
if (nlResult.type === 'action') {
  // Direct execution — skip conversational pipeline
  return await capabilityRegistry.execute(nlResult.slug, nlResult.params)
}
// Otherwise, fall through to existing pipeline
```

### 5.2 AgenticLoopEngine
```typescript
// NL pipeline provides the PLAN step
const nlResult = await nlPipeline.parse(goal.description)
if (nlResult.type === 'dag') {
  // Multi-step: execute DAG nodes sequentially
  for (const node of nlResult.dag.nodes) {
    await capabilityRegistry.execute(node.slug, node.params)
  }
}
```

### 5.3 UnifiedCapabilityRegistry
```
// NL layer maps intent → capability slug
// "open file"     → "file_open"
// "run test"      → "test_execute"
// "git commit"    → "git_commit"
// All slugs registered via capability-bootstrap.ts
```

### 5.4 CapabilityEventBus
```
// NLCommandPipeline emits:
nl:parsed          — { text, intent, confidence, latencyMs, layer }
nl:miss            — { text, reason } (for active learning)
nl:clarify         — { text, options: NlClarifyOption[] }
nl:classify_result — { text, topIntents[], confidence }
```

### 5.5 Frontend (AgentBridge)
```typescript
// Add to AgentBridge message types:
{ type: "command:parse", text: string }
// Response:
{ type: "command:result", intent, confidence, action, params, layer }
{ type: "command:clarify", options: [...] }
```

### 5.6 SituationDetector (complementary)
```
// SituationDetector.classify() → TaskType (coding/writing/etc.)
// NlPipeline.parse() → specific action + params
// They compose: SituationDetector provides context, NL pipeline provides action
```

## 6. Implementation Phases (v5 Alignment)

### Phase 1 (Stabilization)
- Extract SituationDetector regex patterns into `seeds/nl-rules/` format
- No new engines yet — seed data preparation only

### Phase 2 (Agentic Core — units 2.1-2.3)
- **2.1:** IntentDecomposer template strategy → NlRuleEngine IS the template strategy
- **2.2:** IntentDecomposer LLM strategy → NlToActionEngine uses LocalModelAdapter
- **2.3:** Clarification flow → NlCommandPipeline emits `nl:clarify` events

### Phase 6 (Platform Foundation)
- **6.1:** ActionRegistry gains NL command actions
- **6.2:** AgentBridge routes `command:parse` frames
- **6.3:** Generic renderer shows NL parse results

### Phase 10 (Frontend Resilience)
- **10.3:** Keyboard shortcuts include command palette (Cmd+K → NL input)

## 7. Dependencies

### New (1 total)
```json
{
  "@xenova/transformers": "^2.17.0"
}
```
- DistilBERT/BERT inference in Node.js/Bun via ONNX Runtime
- Tokenization, classification, zero-shot capabilities
- Runs entirely in-process — no Python, no GPU, no cloud

### Existing (leveraged)
- `zod` — runtime validation at boundaries
- `@prisma/client` — NL command store persistence
- `ulid` — NL trace IDs

## 8. Seed Data Format

### `seeds/nl-rules/file-ops.json`
```json
{
  "intent": "file.open",
  "patterns": [
    "open (?:the )?(?:file )?(?<target>.+)",
    "show (?:me )?(?:the )?(?<target>.+)",
    "view (?:the )?(?<target>.+)"
  ],
  "synonyms": {
    "open": ["show", "view", "display", "read"],
    "file": ["document", "doc", "paper"]
  },
  "paramExtractors": {
    "target": { "type": "string", "required": true }
  },
  "capabilitySlug": "file_open",
  "confidence": 0.95
}
```

### `seeds/nl-training/intents.json`
```json
{
  "intents": [
    {
      "name": "file.open",
      "utterances": [
        "open file report.pdf",
        "show me the document",
        "view the spreadsheet",
        "can you open that file",
        "I need to see the report"
      ]
    },
    {
      "name": "file.delete",
      "utterances": [
        "delete file report.pdf",
        "remove that document",
        "get rid of the old file",
        "trash the spreadsheet",
        "can you delete that"
      ]
    }
  ]
}
```

## 9. Acceptance Criteria

1. `NlPipeline.parse("open file report.pdf")` → `{ intent: "file.open", params: { path: "report.pdf" }, confidence: 0.95, layer: "rules" }` in <5ms
2. `NlPipeline.parse("get rid of that old document")` → `{ intent: "file.delete", params: { target: "document" }, confidence: 0.88, layer: "classifier" }` in <50ms
3. `NlPipeline.parse("do that thing where you organize my files by date")` → CapabilityDAG with `file.list` → `file.move` nodes via L2 in <500ms
4. Frontend command palette (Cmd+K) accepts NL input and shows parse results inline
5. All NL engines have unit tests with ≥80% coverage
6. `bun run devops invariants check --category B` passes (no forbidden imports)

## 10. Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| DistilBERT too slow in Bun | Benchmark first; fallback to ONNX Runtime Web in worker thread |
| Rule maintenance burden | Seed format is JSON, users add rules via API, not code changes |
| Classifier accuracy insufficient | Active learning loop: log misses → curate → retrain weekly |
| LLM fallback adds latency | L2 is opt-in (`llmFallback: false` default), L0+L1 cover 95% |
| Frontend command palette conflicts | Use Cmd+K (not Cmd+/) to avoid chat input conflicts |

## 11. Sources

- [NL2Shell](https://nl2shell.com/) — 800M local model, 12K training pairs, <200ms
- [ScaleDown Benchmark](https://tinyml.substack.com/p/benchmarking-scaledowns-classification) — SLM outperforms GPT-5.4 Nano at 200x lower cost
- [Falconsai Intent Classification](https://www.aimodels.fyi/models/huggingFace/intent-classification-falconsai) — DistilBERT: 99.87% accuracy
- [Rasa NLU](https://rasa.com/nlu) — DIET architecture for intent + entity extraction
- [winkNLP](https://winkjs.org/) — Zero-dep TypeScript NLP, 2M tokens/sec
- [EACL 2026 — Classification with Clarification](https://aclanthology.org/2026.eacl-industry.14.pdf) — Non-LLM SOTA comparable to proprietary LLMs

---

*Last updated: 2026-07-12*

