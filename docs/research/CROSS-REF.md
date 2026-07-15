# Research Library — CROSS-REF

*Links between research artifacts and devops infrastructure (ADRs, units, goals).*

*Last updated: 2026-07-12*

## Research → Unit Mapping

| Research Brief | Unit(s) | Relationship |
|----------------|---------|--------------|
| nlcl-nlu-systems-brief | NLCL IntentResolver evolution | Foundation — defines architecture to implement |
| provider-taxonomy-brief | Provider registration, CapabilityResolutionEngine | Foundation — defines taxonomy schema and seed strategy |
| http-query-method-brief | API Endpoint Refactoring | Informs migration of capability search from POST to QUERY |
| bun-sqlite-wal-patterns-brief | All DB store implementations | Best practices for SQLite WAL mode configuration |
| raw-cdp-patterns-brief | ChromeGovernor.CDPProxy, HarnessRuntime, anti-detection stealth | Direct implementation pattern for CDP proxy |
| capability-ui-patterns-brief | CapabilityResolutionEngine, frontend UI | Reference for capability-driven UI contract design |
| knowledge-graph-ulid-brief | capability_taxonomy, capability_binding, outcome tables | Knowledge graph patterns for capability modeling |

## Research → Goal Mapping

| Research Brief | Goal(s) | Relationship |
|----------------|---------|--------------|
| nlcl-nlu-systems-brief | Natural language interaction capability | Directly supports goal of NL→System control |
| provider-taxonomy-brief | Multi-platform chat interface support | Directly supports goal of Facebook, Instagram, LinkedIn, WhatsApp, Telegram, X integration |
| http-query-method-brief | API Endpoint Refactoring | Supports goal of improved API semantics and cache efficiency |

## ADR → Research Mapping

| ADR | Research Brief(s) | Status |
|-----|-------------------|--------|
| (none yet) | — | — |

## Unit → Research Mapping

| Unit | Research Brief(s) | Status |
|------|-------------------|--------|
| NLCL IntentResolver | nlcl-nlu-systems-brief | ✅ Research complete |
| Provider registration system | provider-taxonomy-brief | ✅ Research complete |
| CapabilityResolutionEngine | provider-taxonomy-brief | ✅ Research complete |
| API Endpoint Refactoring ( QUERY migration) | http-query-method-brief | ✅ Research complete |

## Atomic-v8 Unit → Research Mapping

| Unit | Research Brief(s) | Status |
|------|-------------------|--------|
| v8.1 — Prisma schema migration | provider-taxonomy-brief, provider-taxonomy-path | ✅ Research complete |
| v8.2 — Storage contract | provider-taxonomy-brief, provider-taxonomy-path | ✅ Research complete |
| v8.3 — Storage impl | provider-taxonomy-brief, provider-taxonomy-path | ✅ Research complete |
| v8.4 — Seed data | provider-taxonomy-brief, provider-taxonomy-path | ✅ Research complete |
| v8.5 — NLP resolver | provider-taxonomy-brief, provider-taxonomy-path | ✅ Research complete |
| v8.6 — Capability resolution | provider-taxonomy-brief | ✅ Research complete |
| v8.7 — Discovery acceleration | provider-taxonomy-brief | ✅ Research complete |
| v8.8 — Tests | provider-taxonomy-path | ✅ Research complete |
