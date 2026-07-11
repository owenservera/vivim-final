# Audit & Intelligence Hub

> **Central navigation** for all codebase intelligence, extraction plans, and schema assessments.
> Start here to understand what exists in the original vivim-app codebases and what to harvest into vivim-final.

**Last updated:** 2026-07-11

---

## Quick Navigation

### Codebase Audits (what exists in the originals)
| Document | What It Covers | LOC Audited |
|----------|---------------|-------------|
| [cap-store-audit.md](./cap-store-audit.md) | Full cap-store — confidence, lifecycle, parsers, CDP, fleet | ~11,500 |
| [capability-lab-audit.md](./capability-lab-audit.md) | Full capability-lab — CDP client, recipes, healing, discovery | ~8,000 |
| [original-vivim-app-discovery-audit.md](./original-vivim-app-discovery-audit.md) | Rust backend — Gemini protocol, capability vault, drift | ~3,000 |
| [compare-and-contrast.md](./compare-and-contrast.md) | 4-codebase comparison — what to harvest, what to skip | 31 items |

### Provider Intelligence (per-provider deep dives)
| Provider | Profile | Transport | Parser |
|----------|---------|-----------|--------|
| [Claude](./providers/claude/README.md) | 11 caps, 18 CDP methods | SSE (Anthropic format) | `claude/001_streaming_sse.ts` |
| [ChatGPT](./providers/chatgpt/README.md) | 9 caps, 15 CDP methods | SSE (OpenAI format) | `chatgpt/001_openai_sse.ts` |
| [Gemini](./providers/gemini/README.md) | 9 caps, 15 CDP methods | batchexecute (WrbFrame) | `gemini/001_batchexecute.ts` |
| [DeepSeek](./providers/deepseek/README.md) | 4 caps, 10 CDP methods | SSE (OpenAI-compatible) | `generic/002_openai_delta.ts` |
| [Generic/OpenAI](./providers/generic/README.md) | Shared patterns for qwen, z-ai, studio-ai | SSE (OpenAI format) | `generic/002_openai_delta.ts` |

### Schema & Gaps
| Document | What It Covers |
|----------|---------------|
| [schema-gap-analysis.md](./schema-gap-analysis.md) | Does vivim-final's DB handle CDP versioning, parser versioning, streaming configs? |
| [extraction-plan.md](./extraction-plan.md) | Pipeline design: extract → manifest → ingest → assess |

### Extraction Pipeline (upcoming)
| Document | What It Covers |
|----------|---------------|
| [extraction/EXTRACTION-MANIFEST-FORMAT.md](./extraction/EXTRACTION-MANIFEST-FORMAT.md) | Standardized JSON format for extracted data |
| [extraction/EXTRACTION-SCRIPTS.md](./extraction/EXTRACTION-SCRIPTS.md) | Bun scripts that scan original codebases |
| [extraction/INGESTION-PIPELINE.md](./extraction/INGESTION-PIPELINE.md) | Prisma upsert pipeline |
| [extraction/ASSESSMENT-QUERIES.md](./extraction/ASSESSMENT-QUERIES.md) | SQL queries to compare extracted vs DB |

---

## Directory Structure

```
docs/audits/
├── INDEX.md                          ← YOU ARE HERE
├── compare-and-contrast.md           ← Master comparison across 4 codebases
├── cap-store-audit.md                ← Full cap-store audit (11,500 LOC)
├── capability-lab-audit.md           ← Full capability-lab audit (8,000 LOC)
├── original-vivim-app-discovery-audit.md  ← Rust backend audit (3,000 LOC)
├── schema-gap-analysis.md            ← Schema versioning assessment
├── extraction-plan.md                ← Extraction pipeline overview
│
├── providers/                        ← Per-provider intelligence
│   ├── claude/README.md              ← 11 caps, 18 CDP methods, SSE
│   ├── chatgpt/README.md             ← 9 caps, 15 CDP methods, OpenAI SSE
│   ├── gemini/README.md              ← 9 caps, 15 CDP methods, batchexecute
│   ├── deepseek/README.md            ← 4 caps, OpenAI-compatible
│   └── generic/README.md             ← Shared OpenAI-compatible patterns
│
└── extraction/                       ← Extraction pipeline docs
    ├── EXTRACTION-MANIFEST-FORMAT.md ← JSON manifest schema
    ├── EXTRACTION-SCRIPTS.md         ← Bun extraction script design
    ├── INGESTION-PIPELINE.md         ← Prisma upsert design
    └── ASSESSMENT-QUERIES.md         ← SQL coverage queries
```

---

## How to Use This

### "I need to understand what CDP methods Claude uses"
→ Read `providers/claude/README.md` §CDP Methods Used

### "I need to understand how Gemini's batchexecute parser works"
→ Read `providers/gemini/README.md` §Streaming & Parsing

### "I need to know what to harvest from the originals"
→ Read `compare-and-contrast.md` §PRIORITIZED HARVEST LIST

### "I need to know if the DB can handle parser versioning"
→ Read `schema-gap-analysis.md` §Versioning Assessment

### "I need to extract CDP methods from the original codebases"
→ Read `extraction-plan.md` §Phase 1-2, then `extraction/EXTRACTION-SCRIPTS.md`

### "I need to know what's missing from vivim-final's DB"
→ Read `schema-gap-analysis.md` §Gap Analysis

---

## Key Findings Summary

### What's Already Done in Vivim-Final
- Prisma schema with 50+ models covering taxonomy, bindings, programs, status logs
- Provider manifest seeds (7 providers: chatgpt, claude, deepseek, gemini, qwen, studio-ai, z-ai)
- Parser seeds (6 files: chatgpt, claude, gemini, generic×2, system)
- `ProviderParser` with version tracking, fallback chains, hashes
- `CapabilityTaxonomyVersion` with version/snapshot tracking
- `BindingStatusLog` for status transitions
- `SelectorStrategy` + `SelectorHealthHistory` for self-healing
- `StreamBlock` model for stream data storage
- `ChromeGovernor` with full CDP client (Page, Runtime, DOM, Input, Network, Fetch, IO, Accessibility)

### What's Missing (needs harvest)
- **Confidence scoring** — schema has `confidence` field, no code fills it
- **Status ladder** — schema has `status` + `BindingStatusLog`, no engine manages transitions
- **Stream completion detection** — parser detects blocks but doesn't know when stream ends
- **Per-provider delta extractors** — generic parser works but provider-specific extractors missing
- **Error→HTTP mapping** — no HTTP status code mapping for MCP server
- **Turn executor** — no turn-level execution wrapper
- **Trusted input dispatch** — no `Input.insertText` abstraction for ProseMirror

### What NOT to Harvest
- bun:sqlite (Prisma is better)
- File-based JSON persistence (Prisma is the source of truth)
- Batch v02 routing (fragile dynamic imports)
- Per-provider Fleet Supervisor (ChromeGovernor is different abstraction)
- In-memory session maps (use Prisma)
- `setInterval` polling (use CDP events)
- `Arc<RwLock<HashMap>>` (Prisma handles concurrency)

---

## Provider Transport Matrix

| Provider | Transport | SSE Format | Completion Signal | Composer Type |
|----------|-----------|------------|-------------------|---------------|
| Claude | SSE | Anthropic | `message_stop` | ProseMirror contenteditable |
| ChatGPT | SSE | OpenAI | `[DONE]` | Standard textarea |
| Gemini | batchexecute | WrbFrame | JSON array markers | Quill `.ql-editor` |
| DeepSeek | SSE | OpenAI | `[DONE]` | Standard textarea |
| Qwen | SSE | OpenAI | `[DONE]` | Standard textarea |
| Z-AI | SSE | OpenAI | `[DONE]` | Standard textarea |
| Studio-AI | SSE | OpenAI | `[DONE]` | Standard textarea |

## CDP Method Count by Provider

| Provider | CDP Methods | Unique to Provider |
|----------|-------------|-------------------|
| Claude | 18 | ProseMirror handling, locale variants |
| ChatGPT | 15 | data-testid selectors |
| Gemini | 15 | batchexecute intercept, Quill editor |
| DeepSeek | 10 | Subset of ChatGPT |
| All others | 10-15 | OpenAI-compatible patterns |
