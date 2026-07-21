# Implementation Plan: LLM-as-Human Production Testing System

**Branch**: `032-llm-human-testing` | **Date**: 2026-07-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/032-llm-human-testing/spec.md`

## Summary

Build a **production testing system where the LLM itself acts as the human user**, testing all 5 surfaces (CLI, UI, API, MCP, Workflow) across 40+ capabilities and 3 live providers (Gemini, ChatGPT, Claude). The system persists a **knowledge base** that survives across sessions, enabling the LLM to learn from prior runs, avoid repeating known failures, and self-improve its testing strategy by focusing on high-risk, low-coverage areas.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: existing `open-claude-in-chrome_*` CDP tools, `bun` test runner, `Bun.serve` for mock servers
**Storage**: JSON files in `.runtime/llm-testing/` (knowledge base + session traces)
**Testing**: LLM IS the test runner — no external test framework needed
**Target Platform**: Local dev environment with running backend (port 9420) + frontend (port 5175) + Chrome slaves
**Project Type**: Meta-tooling — skill + devops scripts + knowledge persistence layer

**Performance Goals**:
- Full test session < 30 minutes (50+ test cases)
- Knowledge base read < 100ms
- Session trace write < 1s
- Coverage report generation < 5s

**Constraints**:
- **LLM-driven**: All testing executable by LLM using available tools (bash, CDP, fetch, WebSocket)
- **Non-destructive**: Tests use test conversations, clean up after
- **Provider-safe**: No rate limit triggers, no abuse detection
- **Governor Canon**: Only ChromeGovernor touches CDP — LLM uses `open-claude-in-chrome_*` tools which go through Governor
- **Store Contracts**: Test data written via existing capability handlers, not raw Prisma

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- [x] Governor Canon: LLM drives Chrome via `open-claude-in-chrome_*` tools → Governor → CDP. No direct CDP calls.
- [x] Store Contracts: Test conversations created/deleted via `conversation_create`/`conversation_delete` capabilities. No raw Prisma.
- [x] One Entry Point: Test orchestration invokes capabilities via `POST /api/capabilities/:id/execute` or CLI REPL — same entry points as real users.
- [x] Custom errors: Knowledge base uses typed error entries with root cause + fix. No raw `new Error()`.
- [x] TypeScript strict: All new code in `src/engines/llm-testing/` follows strict mode, no `any`.
- [x] Tests: The system IS the test — session traces serve as test evidence.

## Constitution Check — Post-Design (re-validated)

- All invariants hold. No Prisma schema changes. No new engine surfaces. LLM testing uses existing capabilities as a real user would. Knowledge base is pure JSON, no DB writes.

## Project Structure

### Documentation (this feature)

```text
specs/032-llm-human-testing/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── surface-adapters.md
│   ├── knowledge-schema.md
│   └── session-trace.md
└── tasks.md             # Phase 2 output
```

### Source Code (new files)

```text
src/engines/llm-testing/
├── index.ts                         # Public barrel exports
├── types.ts                         # Core types (TestResult, SessionTrace, KnowledgeBase)
├── orchestrator.ts                  # Main test orchestrator — coordinates surface adapters
├── adapters/
│   ├── cli-adapter.ts               # CLI REPL testing via spawned process
│   ├── ui-adapter.ts                # UI testing via open-claude-in-chrome CDP tools
│   ├── api-adapter.ts               # API testing via fetch
│   ├── mcp-adapter.ts               # MCP testing via WebSocket
│   ├── workflow-adapter.ts          # Workflow testing via WorkflowEngine
│   └── provider-adapter.ts          # Provider slave testing via CDP
├── knowledge/
│   ├── knowledge-store.ts           # Read/write knowledge base JSON files
│   ├── pattern-analyzer.ts          # Analyze session results → update patterns
│   ├── priority-engine.ts           # Compute test priorities from coverage + risk
│   └── provider-learner.ts          # Learn provider-specific quirks
├── runners/
│   ├── smoke-runner.ts              # Quick smoke test across all surfaces
│   ├── parity-runner.ts             # Cross-surface parity verification
│   ├── provider-runner.ts           # Provider integration testing
│   ├── workflow-runner.ts           # Workflow + HITL testing
│   └── full-runner.ts               # Complete test suite
└── reporting/
    ├── session-writer.ts            # Write session trace JSON
    ├── coverage-tracker.ts          # Track coverage per surface/capability
    └── report-generator.ts          # Generate human-readable markdown reports

.runtime/llm-testing/                # Runtime data (created at first run)
├── knowledge/
│   ├── patterns.json
│   ├── providers.json
│   ├── surfaces.json
│   ├── errors.json
│   └── priorities.json
├── sessions/
│   └── <timestamp>-<session-id>.json
├── reports/
│   └── <timestamp>.md
└── config.json

.opencode/skill/
└── llm-human-testing/
    └── SKILL.md                     # Skill definition for agent invocation

devops/llm-testing/
├── run-smoke.ts                     # CLI entry: bun run devops llm-test smoke
├── run-full.ts                      # CLI entry: bun run devops llm-test full
├── run-parity.ts                    # CLI entry: bun run devops llm-test parity
└── run-providers.ts                 # CLI entry: bun run devops llm-test providers
```

## Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LLM-as-Human Tester                          │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     Orchestrator                              │   │
│  │  reads knowledge → selects tests → dispatches to adapters    │   │
│  │  → collects results → updates knowledge → writes report      │   │
│  └───────────┬──────────┬──────────┬──────────┬────────┬───────┘   │
│              │          │          │          │        │             │
│  ┌───────────▼──┐ ┌─────▼────┐ ┌──▼─────┐ ┌──▼────┐ ┌▼────────┐  │
│  │ CLI Adapter  │ │UI Adapter│ │API     │ │MCP    │ │Provider │  │
│  │ (REPL spawn) │ │ (CDP)    │ │Adapter │ │Adapter│ │Adapter  │  │
│  │              │ │          │ │(fetch) │ │(WS)   │ │(CDP)    │  │
│  └──────────────┘ └──────────┘ └────────┘ └───────┘ └─────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Knowledge Store                             │   │
│  │  patterns.json ← session results + prior knowledge           │   │
│  │  providers.json ← provider quirks + success rates            │   │
│  │  surfaces.json ← coverage per surface                        │   │
│  │  errors.json ← error → root cause → fix                      │   │
│  │  priorities.json ← what to test next (weighted)              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Session Writer                              │   │
│  │  writes sessions/<timestamp>.json (full trace)               │   │
│  │  writes reports/<timestamp>.md (human summary)               │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Core Types

```typescript
// src/engines/llm-testing/types.ts

export type TestSurface = 'cli' | 'ui' | 'api' | 'mcp' | 'workflow' | 'provider'

export interface TestCase {
  id: string
  surface: TestSurface
  capability: string
  action: string
  expected: string
  provider?: 'gemini' | 'chatgpt' | 'claude'
  tags: string[]
}

export interface TestResult {
  id: string
  surface: TestSurface
  capability: string
  action: string
  expected: string
  actual: string
  status: 'pass' | 'fail' | 'skip' | 'error'
  durationMs: number
  timestamp: string
  screenshot?: string
  consoleLogs?: string[]
  networkRequests?: string[]
  error?: string
  fix?: string
}

export interface SessionTrace {
  sessionId: string
  startedAt: string
  endedAt: string
  mode: 'smoke' | 'full' | 'parity' | 'providers' | 'workflow'
  config: {
    backendPort: number
    frontendPort: number
    providers: string[]
  }
  tests: TestResult[]
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
    errored: number
    newPatternsLearned: number
    errorsEncountered: number
    coverageDelta: Record<TestSurface, { before: number; after: number }>
  }
}

export interface Pattern {
  id: string
  surface: TestSurface
  capability: string
  pattern: string
  confidence: number
  lastVerified: string
  failures: PatternFailure[]
  tags: string[]
}

export interface PatternFailure {
  timestamp: string
  symptom: string
  rootCause: string
  fix: string
}

export interface ProviderKnowledge {
  composerSelector: string
  sendMethod: 'enter-or-click' | 'click-send-button'
  sendButtonSelector?: string
  enterKeyBroken: boolean
  streamFormat: string
  quirks: string[]
  lastTested: string
  successRate: number
}

export interface SurfaceCoverage {
  totalCapabilities: number
  testedCapabilities: number
  coverage: number
  lastFullRun: string
  gaps: string[]
}

export interface ErrorEntry {
  id: string
  surface: TestSurface
  capability: string
  error: string
  rootCause: string
  fix: string
  occurrences: number
  lastSeen: string
  resolved: boolean
}

export interface PriorityEntry {
  surface: TestSurface
  capability: string
  reason: string
  riskScore: number
  coverageGap: number
}
```

### Knowledge Store

```typescript
// src/engines/llm-testing/knowledge/knowledge-store.ts

export class KnowledgeStore {
  constructor(private readonly baseDir: string) {}

  async readPatterns(): Promise<Pattern[]> { ... }
  async writePatterns(patterns: Pattern[]): Promise<void> { ... }
  
  async readProviders(): Promise<Record<string, ProviderKnowledge>> { ... }
  async writeProviders(providers: Record<string, ProviderKnowledge>): Promise<void> { ... }
  
  async readSurfaces(): Promise<Record<TestSurface, SurfaceCoverage>> { ... }
  async writeSurfaces(surfaces: Record<TestSurface, SurfaceCoverage>): Promise<void> { ... }
  
  async readErrors(): Promise<ErrorEntry[]> { ... }
  async writeErrors(errors: ErrorEntry[]): Promise<void> { ... }
  
  async readPriorities(): Promise<PriorityEntry[]> { ... }
  async writePriorities(priorities: PriorityEntry[]): Promise<void> { ... }
  
  async bootstrap(): Promise<void> {
    // Create directory structure + default files if not exists
  }
}
```

### Pattern Analyzer

```typescript
// src/engines/llm-testing/knowledge/pattern-analyzer.ts

export class PatternAnalyzer {
  constructor(private readonly knowledge: KnowledgeStore) {}

  async analyzeSession(session: SessionTrace): Promise<{
    newPatterns: Pattern[]
    updatedPatterns: Pattern[]
    newErrors: ErrorEntry[]
    updatedErrors: ErrorEntry[]
  }> {
    // 1. For each test result:
    //    - If pass + no existing pattern → create new pattern (confidence 0.8)
    //    - If pass + existing pattern → bump confidence, update lastVerified
    //    - If fail + existing pattern → add failure, reduce confidence
    //    - If fail + no existing pattern → create pattern with failure (confidence 0.3)
    //    - If error → create/update error entry
    // 2. Return delta for knowledge store to merge
  }

  async computeCoverage(surfaces: Record<TestSurface, SurfaceCoverage>): Promise<void> {
    // Count tested capabilities per surface from patterns
  }
}
```

### Priority Engine

```typescript
// src/engines/llm-testing/knowledge/priority-engine.ts

export class PriorityEngine {
  constructor(private readonly knowledge: KnowledgeStore) {}

  async computePriorities(): Promise<PriorityEntry[]> {
    // 1. Get all capabilities from registry
    // 2. Get coverage per surface
    // 3. Get error rates per capability
    // 4. Score each untested/low-confidence capability:
    //    - riskScore = (errorRate * 0.4) + (coverageGap * 0.3) + (capabilityComplexity * 0.3)
    //    - coverageGap = 1.0 - currentCoverage
    // 5. Sort by riskScore descending
    // 6. Return top 20 as priority queue
  }
}
```

### Surface Adapters

Each adapter implements:

```typescript
export interface SurfaceAdapter {
  name: TestSurface
  init(config: TestConfig): Promise<void>
  discoverCapabilities(): Promise<TestCase[]>
  execute(test: TestCase): Promise<TestResult>
  cleanup(): Promise<void>
}
```

**CLI Adapter**: Spawns `bun run src/cli/index.ts`, types commands via stdin, captures stdout.

**UI Adapter**: Uses `open-claude-in-chrome_*` tools — navigate, find, click, type, screenshot, read console/network.

**API Adapter**: Uses `fetch` against `http://localhost:9420/api/*` endpoints.

**MCP Adapter**: Connects WebSocket to MCP server port, lists tools, invokes via JSON-RPC.

**Workflow Adapter**: Imports `WorkflowEngine` directly, creates workflows, executes, resolves HITL gates.

**Provider Adapter**: Uses CDP to drive real provider UIs — connects to Chrome slave, types in composer, reads streaming response.

### Orchestrator

```typescript
// src/engines/llm-testing/orchestrator.ts

export class LlmTestOrchestrator {
  constructor(
    private readonly knowledge: KnowledgeStore,
    private readonly adapters: SurfaceAdapter[],
    private readonly config: TestConfig,
  ) {}

  async run(mode: 'smoke' | 'full' | 'parity' | 'providers' | 'workflow'): Promise<SessionTrace> {
    // 1. Bootstrap knowledge store
    await this.knowledge.bootstrap()
    
    // 2. Load prior knowledge
    const priorities = await this.knowledge.readPriorities()
    const patterns = await this.knowledge.readPatterns()
    
    // 3. Select test cases based on mode + priorities
    const tests = await this.selectTests(mode, priorities, patterns)
    
    // 4. Execute tests via adapters
    const results: TestResult[] = []
    for (const test of tests) {
      const adapter = this.adapters.find(a => a.name === test.surface)
      if (!adapter) continue
      const result = await adapter.execute(test)
      results.push(result)
    }
    
    // 5. Analyze results → update knowledge
    const session: SessionTrace = { ... }
    const delta = await this.analyzer.analyzeSession(session)
    await this.mergeKnowledge(delta)
    
    // 6. Recompute priorities
    await this.priorityEngine.computePriorities()
    
    // 7. Write session trace + report
    await this.sessionWriter.write(session)
    await this.reportGenerator.generate(session)
    
    return session
  }

  private async selectTests(
    mode: string,
    priorities: PriorityEntry[],
    patterns: Pattern[],
  ): Promise<TestCase[]> {
    switch (mode) {
      case 'smoke':
        // Top 5 capabilities per surface, skip low-confidence patterns
        return this.getSmokeTests(patterns)
      case 'full':
        // All capabilities, prioritized by priority engine
        return this.getFullTests(priorities)
      case 'parity':
        // Top 10 capabilities across all surfaces
        return this.getParityTests()
      case 'providers':
        // Provider-specific tests for Gemini/ChatGPT/Claude
        return this.getProviderTests()
      case 'workflow':
        // Workflow + HITL tests
        return this.getWorkflowTests()
    }
  }
}
```

### Session Writer

```typescript
// src/engines/llm-testing/reporting/session-writer.ts

export class SessionWriter {
  constructor(private readonly baseDir: string) {}

  async write(session: SessionTrace): Promise<string> {
    const path = `${this.baseDir}/sessions/${session.sessionId}.json`
    await Bun.write(path, JSON.stringify(session, null, 2))
    return path
  }
}
```

### Report Generator

```typescript
// src/engines/llm-testing/reporting/report-generator.ts

export class ReportGenerator {
  constructor(private readonly baseDir: string) {}

  async generate(session: SessionTrace): Promise<string> {
    const md = `# Test Session Report

**Session**: ${session.sessionId}
**Date**: ${session.startedAt}
**Mode**: ${session.mode}
**Duration**: ${session.endedAt} - ${session.startedAt}

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${session.summary.total} |
| Passed | ${session.summary.passed} |
| Failed | ${session.summary.failed} |
| Skipped | ${session.summary.skipped} |
| Coverage Delta | ${JSON.stringify(session.summary.coverageDelta)}

## Failed Tests

${session.tests.filter(t => t.status === 'fail').map(t => `
### ${t.id} — ${t.surface}/${t.capability}
- **Action**: ${t.action}
- **Expected**: ${t.expected}
- **Actual**: ${t.actual}
- **Error**: ${t.error}
- **Fix**: ${t.fix ?? 'N/A'}
`).join('\n')}

## New Patterns Learned

${session.tests.filter(t => t.status === 'pass').map(t => `
- ${t.surface}/${t.capability}: ${t.action} → ${t.actual}
`).join('\n')}
`
    const path = `${this.baseDir}/reports/${session.sessionId}.md`
    await Bun.write(path, md)
    return path
  }
}
```

## Phases

### Phase 0: Research & Decisions

**Research Tasks:**
1. How does the existing CLI REPL accept commands programmatically (stdin/pipe)?
2. What is the exact WebSocket protocol for MCP tool invocation?
3. How does `WorkflowEngine` instantiate without full server context?
4. What Chrome slave ports are used for Gemini/ChatGPT/Claude?
5. How do `open-claude-in-chrome_*` tools map to CDP commands?

**Decisions:**
- CLI adapter spawns `bun src/cli/index.ts` as child process, writes to stdin, reads stdout
- MCP adapter uses `Bun.serve` WebSocket client to connect to MCP port
- Workflow adapter imports `WorkflowEngine` + mock stores directly
- Provider adapter uses `open-claude-in-chrome_*` tools (which go through Governor)
- Knowledge stored as flat JSON files (no DB needed)

### Phase 1: Design & Contracts

**Data Model** (`data-model.md`):
- `Pattern` — learned test pattern with confidence + failure history
- `ProviderKnowledge` — provider-specific quirks and success rates
- `SurfaceCoverage` — coverage metrics per surface
- `ErrorEntry` — error → root cause → fix mapping
- `PriorityEntry` — weighted test priority queue
- `SessionTrace` — full test run trace
- `TestResult` — individual test outcome

**Contracts** (`contracts/`):
- `surface-adapters.md` — adapter interface + per-surface contract
- `knowledge-schema.md` — JSON schema for all knowledge files
- `session-trace.md` — session trace format

**Quickstart** (`quickstart.md`):
1. Start backend: `pwsh scripts/start-backend.ps1`
2. Start frontend: `pwsh scripts/start-frontend.ps1`
3. Run smoke test: `bun run devops llm-test smoke`
4. Check report: `.runtime/llm-testing/reports/<timestamp>.md`
5. Run full test: `bun run devops llm-test full`
6. Check knowledge: `.runtime/llm-testing/knowledge/patterns.json`

### Phase 2: Implementation (tasks.md)

See tasks.md for atomic implementation tasks.

## Gate

- [ ] All adapters functional (CLI, UI, API, MCP, Workflow, Provider)
- [ ] Knowledge store reads/writes correctly
- [ ] Session traces written with full test results
- [ ] Coverage tracking works across sessions
- [ ] Priority engine computes meaningful priorities
- [ ] Smoke test passes end-to-end
- [ ] Full test passes end-to-end
- [ ] Cross-surface parity verified for top 10 capabilities
- [ ] Provider tests pass for Gemini/ChatGPT/Claude
- [ ] HITL workflow gates tested
- [ ] Reports generated in markdown
- [ ] `bunx tsc --noEmit` clean
- [ ] `bun run lint` clean
