# Guides Index

This directory contains best-practice guides for developing the vivim system.
Guides are targeted at AI agents working on dev sessions and human contributors.

---

## For AI Dev Agents

| Guide | When to Use |
|-------|-------------|
| [ai-dev-session-workflow.md](./ai-dev-session-workflow.md) | **Start here every session.** Orient → Audit → Implement → Verify pattern, common traps, file ownership map. |
| [smaller-model-agent-guide.md](./smaller-model-agent-guide.md) | For smaller context windows (50K–150K tokens). Compact rules for DB-driven development. |

## For Provider Work

| Guide | When to Use |
|-------|-------------|
| [provider-parser-authoring.md](./provider-parser-authoring.md) | Writing or upgrading stream parsers (LOGIC_CODE contract, provider wire formats, registration). |
| [provider-upgrade-checklist.md](./provider-upgrade-checklist.md) | Full step-by-step checklist for upgrading a provider: parser + stream config + capabilities + NL patterns. |

## For Capability Development

| Guide | When to Use |
|-------|-------------|
| [capability-authoring.md](./capability-authoring.md) | Adding new `UnifiedCapability` entries: `makeCapability` signature, cross-surface parity, NL catalog patterns. |

---

## Quick Decision Tree

```
Starting a vivim session?
  └── Read: ai-dev-session-workflow.md

Working on a parser?
  └── Read: provider-parser-authoring.md

Upgrading Claude / ChatGPT / Gemini?
  └── Run: bun run devops runtime-test preflight
  └── Follow: provider-upgrade-checklist.md

Adding a new feature / capability?
  └── Read: capability-authoring.md

Using a small model (Haiku / mini)?
  └── Read: smaller-model-agent-guide.md
```

---

## Key Invariants (short form)

1. **Governor Canon:** Only `ChromeGovernor` touches CDP
2. **DB-Only Parsers:** Parser logic lives in `seeds/parsers/harvested/*.ts` → upserted to DB
3. **One Entry Point:** Every operation is a `UnifiedCapability` routed through `/api/interpret`
4. **Profile Canonical:** Chrome profile directory is truth for auth state, not DB
5. **No tsc mid-session:** Only typecheck when full task is done and user requests it
6. **`.js` imports:** All ESM imports need `.js` extension (Bun requirement)
7. **Version bumps:** Bump parser `version` on every logic change
8. **Stream configs:** Every production provider needs a non-empty `streamConfigs` entry

---

## Generated: 2026-08-01 | Session: 10x Provider Upgrade
