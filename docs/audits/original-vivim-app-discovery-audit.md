# Audit: Original vivim-app Discovery & Capability Engine

**Date:** 2026-07-11
**Scope:** `C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa` — backend registry + cap-store
**Goal:** Identify best practices to port to vivim-final (quick wins, low overhead)

---

## Architecture Summary

| Layer | Location | Language | Purpose |
|-------|----------|----------|---------|
| Backend Registry | `backend/src/registry/` | Rust | Protocol registry, capability vault, drift detection, parser registry |
| Cap-Store | `cap-store/src/` | TypeScript | Confidence scoring, lifecycle management, streaming parsers, harness |

### Key Files Analyzed

| File | Lines | What It Does |
|------|-------|--------------|
| `backend/src/registry/provider_protocols.rs` | 543 | Provider endpoint registry with drift detection |
| `backend/src/registry/capability_vault.rs` | 864 | Versioned capability graph with edges and drift reports |
| `backend/src/registry/parsers.rs` | 313 | Response parser registry (param builder + response parser) |
| `backend/src/registry/gemini_protocol.rs` | 1915 | Full Gemini protocol: RPC IDs, model registry, session state, JSPB headers, recipes |
| `cap-store/src/confidence.ts` | 168 | Multi-factor confidence scoring |
| `cap-store/src/lifecycle/index.ts` | 169 | Status ladder + auto-promotion |
| `cap-store/src/drift.ts` | 96 | Drift detection with severity classification |
| `cap-store/src/patterns.ts` | 65 | Failed selector tracking |
| `cap-store/src/executor/parsers.ts` | 155 | SSE parser + provider delta extraction |
| `cap-store/src/executor/parsers/index.ts` | 146 | Provider parser registry |
| `cap-store/src/executor/parsers/gemini.ts` | 95 | Gemini NDJSON envelope decoder |
| `cap-store/src/executor/parsers/claude.ts` | 41 | Claude SSE parser |
| `cap-store/src/executor/parsers/chatgpt.ts` | 93 | ChatGPT patch format parser |
| `cap-store/src/executor/recipe.ts` | 441 | Recipe execution engine with CDP |
| `cap-store/src/executor/harness.ts` | 137 | Fetch/XHR tagging harness |

---

## Best Practices Worth Porting

### 1. URL Wildcard Matching for Drift Detection

**Source:** `backend/src/registry/provider_protocols.rs:477-494`

```rust
fn url_matches_pattern(pattern: &str, observed: &str) -> bool {
    if !pattern.contains('*') {
        return pattern == observed;
    }
    let pat_parts: Vec<&str> = pattern.split('/').collect();
    let obs_parts: Vec<&str> = observed.split('/').collect();
    if pat_parts.len() != obs_parts.len() {
        return false;
    }
    pat_parts.iter().zip(obs_parts.iter())
        .all(|(p, o)| *p == "*" || p == o)
}
```

**Value:** Detects when observed URLs drift from stored patterns. Supports wildcards for dynamic path segments (e.g., `/organizations/*/chat_conversations/*/completion`).

**Port effort:** 30 min. Pure function, no dependencies.

---

### 2. Table-Driven RPC Registration

**Source:** `backend/src/registry/gemini_protocol.rs:1158-1184`

```rust
pub const BATCH_RPC_SPECS: &[BatchRpcSpec] = &[
    BatchRpcSpec { rpc: RpcId::BardSettings, arg_spec: ArgSpec::Null, metadata_key: "status" },
    BatchRpcSpec { rpc: RpcId::RateLimit, arg_spec: ArgSpec::Null, metadata_key: "rate_limit" },
    BatchRpcSpec { rpc: RpcId::DeepResearchCaps, arg_spec: ArgSpec::ConversationId, metadata_key: "raw" },
    BatchRpcSpec { rpc: RpcId::ModelSwitchAck, arg_spec: ArgSpec::BranchConversation, metadata_key: "raw" },
    BatchRpcSpec { rpc: RpcId::QuotaPlan, arg_spec: ArgSpec::Null, metadata_key: "raw" },
];
```

**Value:** Adding new RPCs = one table row. No code changes needed in the parser registration loop. The `ArgSpec` enum controls how arguments are built (Null, ConversationId, BranchConversation).

**Port effort:** 1 hour. Define TypeScript equivalent with discriminated union for arg building.

---

### 3. Capability Recipes (Capability → RPC Sequence)

**Source:** `backend/src/registry/gemini_protocol.rs:1197-1238`

```rust
pub const RECIPES: &[CapabilityRecipe] = &[
    CapabilityRecipe {
        capability_id: "send-message",
        rpc_ids: &[RpcId::BardSettings, RpcId::RateLimit, RpcId::ModelSwitchAck],
        uses_stream_generate: true,
    },
    CapabilityRecipe {
        capability_id: "session-init",
        rpc_ids: &[RpcId::UserStatus, RpcId::BardSettings, RpcId::BardSettings, RpcId::ConversationList],
        uses_stream_generate: false,
    },
    CapabilityRecipe { capability_id: "check-limits", rpc_ids: &[RpcId::RateLimit], uses_stream_generate: false },
    CapabilityRecipe { capability_id: "ping", rpc_ids: &[RpcId::BardSettings], uses_stream_generate: false },
    CapabilityRecipe { capability_id: "delete-conversation", rpc_ids: &[RpcId::DeleteConversation1], uses_stream_generate: false },
];
```

**Value:** Declarative mapping of capability name → ordered RPC sequence. Agent can understand what fires for each capability without reading execution code. `RecipeRunner::preflight_bodies()` builds the wire format.

**Port effort:** 1 hour. TypeScript const array + resolver function.

---

### 4. Multi-Factor Confidence Scoring

**Source:** `cap-store/src/confidence.ts:57-66`

```typescript
export function confidence(input: ConfidenceInput, nowMs: number = Date.now()): number {
    let s = 0;
    s += statusWeight(input.status) * 0.35;        // binding status weight
    s += successWeight(input.oks ?? 0, input.fails ?? 0) * 0.25;  // success rate
    s += recencyWeight(input.last_ok_ms, nowMs) * 0.15;  // days since last ok
    s += replayWeight(input.replay_verified);       // +0.15 if replay verified
    s += driftWeight(input.intended_matched);       // -0.2 if drift detected
    s += Math.min((input.pattern_hits ?? 0) * 0.02, 0.1);  // pattern hits cap at 0.1
    return Math.max(0, Math.min(1, s));
}
```

**Component weights:**
| Factor | Weight | Range |
|--------|--------|-------|
| Status (stable/test-N/flaky/broken) | 0.35 | 0.1–0.95 |
| Success rate (oks/total) | 0.25 | 0–1.0 |
| Recency (days since last ok, decays over 14 days) | 0.15 | 0.1–1.0 |
| Replay verified | flat +0.15 | 0 or 0.15 |
| Drift detected | flat -0.2 | 0 or -0.2 |
| Pattern hits | 0.02 each, capped at 0.1 | 0–0.1 |

**Also includes:**
- `windowedConfidence()` — sliding window over last N outcomes
- `strategyConfidence()` — per-strategy breakdown
- `computeFullConfidence()` — combines all factors with tier weight
- `shouldEscalate()` — threshold check (default 0.65)

**Port effort:** 1 hour. Pure functions, zero dependencies.

---

### 5. Status Ladder + Auto-Promotion

**Source:** `cap-store/src/lifecycle/index.ts:9-68`

```typescript
const VALID_TRANSITIONS: Record<BindingStatus, BindingStatus[]> = {
    'prospect': ['test-1', 'broken', 'retired'],
    'test-1':   ['test-2', 'flaky', 'broken', 'retired'],
    'test-2':   ['stable', 'flaky', 'broken', 'retired'],
    'stable':   ['flaky', 'broken', 'retired'],
    'flaky':    ['stable', 'broken', 'retired'],
    'broken':   ['stable', 'retired'],
    'retired':  [],
};

export function autoStatus(binding: ProviderBinding): BindingStatus {
    // prospect → test-1 on first ok
    // test-1 → test-2 on second ok
    // test-2 → stable on third ok + confidence >= 0.65
    // stable → broken on any fail
}
```

**Also includes:**
- `checkTimeoutGuard()` — auto-promote stuck bindings (test-1 >24h → test-2, test-2 >7d → stable)
- `makePromotionRecord()` — audit trail for status changes
- `appendPromotionHistory()` — tracks promotion chain

**Port effort:** 2 hours. State machine + timer logic.

---

### 6. Content Blocks Abstraction (Provider-Agnostic Parser Interface)

**Source:** `cap-store/src/executor/parsers/index.ts:18-21`

```typescript
export interface ProviderParser {
    feedChunk(chunk: string): ContentBlock[];
    flush(): ContentBlock[];
}

export interface ContentBlock {
    kind: 'text' | 'artifact' | 'citation' | 'tool_use';
    format?: 'markdown' | 'html' | 'code';
    content: string;
    // ... additional fields per kind
}
```

**Provider registry pattern:**
```typescript
const PROVIDER_PARSERS: Record<string, () => ProviderParser> = {
    chatgpt: () => createChatGPTParser(),
    claude: () => createClaudeParser(),
    gemini: () => createGeminiParser(),
    deepseek: () => createOpenAISSEParser(),  // reuses OpenAI format
    'studio-ai': () => createGoogleAIStudioParser(),
};

export function createProviderParser(providerId: string): ProviderParser | null {
    const factory = PROVIDER_PARSERS[providerId];
    return factory ? factory() : null;
}
```

**Value:** Adding a new provider = create file, add to registry. No harness changes.

**Port effort:** 30 min. Interface + registry pattern.

---

### 7. SSE Parser (Reusable)

**Source:** `cap-store/src/executor/parsers/sse.ts`

```typescript
export function createSSEParser(): SseParser {
    let buffer = '';
    function push(chunk: string): SseEvent[] {
        buffer += chunk;
        const events: SseEvent[] = [];
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
            const evt: SseEvent = { event: 'message', data: '' };
            for (const line of part.split('\n')) {
                if (line.startsWith('event:')) evt.event = line.slice(6).trim();
                else if (line.startsWith('data:')) evt.data += (evt.data ? '\n' : '') + line.slice(5).trim();
                else if (line.startsWith('id:')) evt.id = line.slice(3).trim();
                else if (line.startsWith('retry:')) evt.retry = parseInt(line.slice(6).trim(), 10);
            }
            if (evt.data) events.push(evt);
        }
        return events;
    }
    function reset(): void { buffer = ''; }
    return { push, reset };
}
```

**Value:** ~50 lines, handles line buffering, event splitting, field extraction. Works for Claude, OpenAI, DeepSeek, and any SSE-based provider.

**Port effort:** 30 min. Direct port.

---

### 8. Drift Detection Thresholds + Severity

**Source:** `cap-store/src/drift.ts:4-8, 91-96`

```typescript
const DRIFT_THRESHOLDS = {
    'success-rate-drop': { low: 0.1, medium: 0.2, high: 0.3, critical: 0.5 },
    'latency-increase': { low: 1.5, medium: 2.0, high: 3.0, critical: 5.0 },
    'strategy-degradation': { low: 0.1, medium: 0.2, high: 0.3, critical: 0.5 },
};

function classifySeverity(value: number, thresholds: { low: number; medium: number; high: number; critical: number }): DriftSeverity {
    if (value >= thresholds.critical) return 'critical';
    if (value >= thresholds.high) return 'high';
    if (value >= thresholds.medium) return 'medium';
    return 'low';
}
```

**Detection logic:** Compares recent 10 outcomes vs older 10 outcomes. If success rate drops > threshold, fires drift event.

**Port effort:** 30 min. Threshold table + classifier.

---

### 9. GeminiProfile as Single Source of Truth

**Source:** `backend/src/registry/gemini_protocol.rs:218-298`

```rust
pub struct GeminiProfile;
impl GeminiProfile {
    pub const BUILD_LABEL: &'static str = "boq_assistant-bard-web-server_20260601.04_p0";
    pub const MODELS: &'static [ModelSpec] = &[
        ModelSpec { mode_id: "95b221a35f59a86d", model_num: 3, api_name: "gemini-3.1-pro", deprecated: false },
        ModelSpec { mode_id: "ba727baf0ec2ba6a", model_num: 6, api_name: "gemini-3.1-flash-lite", deprecated: false },
        // ... deprecated models also listed
    ];
    pub fn by_mode_id(mode_id: &str) -> Option<&'static ModelSpec> { ... }
    pub fn by_api_name(api_name: &str) -> Option<&'static ModelSpec> { ... }
    pub fn resolve(model_hint: &str) -> Option<&'static ModelSpec> { ... }
}
```

**Value:** When Google rotates mode-ids or build labels, edit ONE place. All callers derive from here. Includes deprecated model tracking.

**Port effort:** 1 hour. TypeScript const object + lookup functions.

---

### 10. Capability Vault Snapshot/Import

**Source:** `backend/src/registry/capability_vault.rs:493-513`

```rust
pub fn snapshot(&self) -> VaultSnapshot {
    VaultSnapshot {
        entries: self.list_entries(None),
        edges: self.list_edges(None),
        drift_reports: self.list_drift_reports(None, usize::MAX),
    }
}

pub fn import_snapshot(&self, snapshot: VaultSnapshot) {
    for entry in snapshot.entries { self.upsert_entry(entry); }
    for edge in snapshot.edges { /* insert edge */ }
}
```

**Value:** Export entire capability state for backup, migration, or sharing between instances.

**Port effort:** 30 min. JSON serialization of existing types.

---

## What the Original Does NOT Have (Gaps)

| Gap | Original | vivim-final Needs |
|-----|----------|-------------------|
| MCP Server | None | Agent-callable tools |
| CDP DOM Inspection | No (uses harness injection) | Live DOM querying via CDP |
| Interactive Probing | No (static seeds) | Agent can click/type/navigate |
| Network Observation | Basic fetch/XHR logging | CDP Fetch domain interception |
| Shape Inheritance | None | `extendsShape` for adapters |
| Per-Field Confidence | Single score | Field-level needsReview detection |
| Provider Adapter Modules | None | Pluggable adapters per provider type |

---

## Quick Win Implementation Plan

| # | What | Source | Effort | Impact | Files |
|---|------|--------|--------|--------|-------|
| 1 | URL wildcard matcher | provider_protocols.rs | 30 min | Drift detection | `src/utils/url-pattern.ts` |
| 2 | Confidence formula | confidence.ts | 1 hour | Multi-factor confidence | `src/engines/confidence.ts` |
| 3 | Status ladder + auto-promotion | lifecycle/index.ts | 2 hours | Lifecycle management | `src/engines/lifecycle.ts` |
| 4 | SSE parser | parsers/sse.ts | 30 min | Reusable SSE parsing | `src/parsers/sse.ts` |
| 5 | ContentBlock interface | parsers/index.ts | 30 min | Provider-agnostic pattern | `src/parsers/types.ts` |
| 6 | CapabilityRecipe pattern | gemini_protocol.rs | 1 hour | Declarative capability→RPC | `src/engines/recipe.ts` |
| 7 | GeminiProfile pattern | gemini_protocol.rs | 1 hour | Single source of truth | `src/config/provider-profiles.ts` |

**Total: ~6 hours for significant capability uplift.**

---

## Priority Recommendations

1. **Start with #2 (confidence) + #3 (status ladder)** — these are pure functions with zero dependencies, immediately usable by the discovery engine
2. **Then #4 (SSE parser) + #5 (ContentBlock)** — enables streaming parser implementation for all providers
3. **Then #1 (URL pattern matcher)** — adds drift detection to the protocol store
4. **Then #6 (recipes) + #7 (profiles)** — declarative provider configuration
5. **#10 (snapshot)** — useful but not urgent

---

## Patterns to Avoid from Original

| Pattern | Why |
|---------|-----|
| In-memory HashMap with manual persistence | Use Prisma (already in vivim-final) |
| `Arc<RwLock<HashMap>>` everywhere | Prisma handles concurrency |
| Stringly-typed enums (`"matched"`, `"drifted"`) | Use TypeScript string literal unions |
| Manual JSON serialization in handlers | Use Zod schemas + validated transforms |
| No migration strategy | Use Prisma migrations |
