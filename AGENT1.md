# AGENT1.md — OpenCode `local-agent` Provider Integration (spec 022)

**Agent:** #1 (Kilo) &nbsp;|&nbsp; **Feature:** `022-local-agent-opencode` &nbsp;|&nbsp; **Status:** ✅ COMPLETE (per coordination plan 1784479856654)
**Scope boundary:** Local-agent / OpenCode `cap:agent:run` integration ONLY. No CDP/Chrome/Governor, no other engines.

---

## Objective
Make the 4 verified OpenCode Zen free models first-class vivim capabilities via `cap:agent:run`,
parsable to the canonical `ContentBlock[]`, using the **verified** opencode v1.17.15 protocol
(evidence in `docs/research/evidence/opencode-deep/`). Fix the integration that existed but was
built on STALE assumptions (`message.parts`/`role` shape that opencode does NOT emit).

## Files I own (do not edit from other agents without sync)
- `src/engines/local-agent/local-agent-executor.ts`  ← rewritten (parser + resume + perms)
- `src/engines/capability-bootstrap.ts`              ← seed fn + handler wired
- `tests/unit/engines/local-agent.test.ts`           ← rewritten to verified contract
- `specs/022-local-agent-opencode/spec.md`, `research.md`  ← doc sync (pending)
- `docs/research/briefs/opencode-deep/*`             ← evidence (read-only research, safe)

## What is DONE
1. **Executor rewritten** to the verified NDJSON contract:
   - Parse `part.text` / `part.type` / top-level `type` (NOT legacy `message.parts`/`role`).
   - `tool_use` → `tool-call` + `tool-result` blocks.
   - **Silent permission denial** (`part.tool === 'invalid'`) → `PERMISSION_DENIED` error block +
     `permissionDenied: true` + `capability:failed` event (verified: exit 0, not an error event).
   - `reasoning` blocks (with `--thinking`).
   - `sessionID` captured from first `step_start`; returned in result.
   - Resume via `-s/--session <id>` (NOT `--continue <id>` — verified trap).
   - `--auto` + always-`-m` (neutralizes repo `default_agent:build` → unauth sonnet).
   - Fatal CLI errors (stderr + exit≠0) → error block.
2. **Capability handler** (`cap:agent:run`) updated to pass `sessionId`, return
   `sessionId`/`tokens`/`permissionDenied`. Fixed example model to a verified free model.
3. **Seed function** `seedLocalAgentProvider()` added + called in `registerDefaultCapabilities`
   (idempotent upsert of `opencode` provider + 4 free models). This was the real gap — provider
   was never seeded, so `cap:agent:run` threw at runtime.
4. **Import fix**: `LOCAL_AGENT_SLUG` imported as a value (not type) in `capability-bootstrap.ts`.
5. **Unit tests** rewritten to verified fixtures — **8 pass**.

## What is PENDING (safe to resume after coordination)
- [ ] Verify the executor compiles against full project (AGENTS.md says don't run full `tsc`
      unprompted; ran only the targeted unit test → 8 pass). Need a coordinated typecheck.
- [ ] Confirm `seedLocalAgentProvider` is awaited at boot (it is, inside `registerDefaultCapabilities`
      when `localAgentStore` present). No DB schema change needed — reuses `ProviderDefinition`/
      `ProviderModel`/`ProviderConfig`.
- [ ] Doc sync: update `spec.md` (multi-turn, perms) + `research.md` (R-3 parse contract) to match.
- [ ] Optional: real end-to-end smoke test (guarded by env flag; free-model cold latency 37–54s).

## Key verified facts (for other agents to avoid re-litigating)
- CLI `--format json` = **NDJSON** (one JSON obj/line), top-level `type`.
- Event types: `step_start`, `text`, `reasoning`(opt), `tool_use`, `step_finish`, `error`.
- Permission denial = `tool_use` with `tool:"invalid"`, exit 0 (SILENT).
- Resume: `-s/--session <id>` (same ID returned, context retained). `--continue <id>` mis-parses.
- Repo `opencode.json` `default_agent:build` → unauthenticated sonnet → MUST pass `-m`.
- Free models: `opencode/deepseek-v4-flash-free`, `opencode/hy3-free`,
  `opencode/mimo-v2.5-free`, `opencode/north-mini-code-free`. (nemotron excluded: >5min.)

## Collision notes
- I do NOT touch: `chrome-governor`, `provider-registrar`, `conversation-manager`, `stream-parser`,
  `unified-registry`, `server/index.ts` bootstrap wiring, `prisma/schema.prisma`, any other engine.
- `seedLocalAgentProvider` only writes rows under `slug: opencode` (distinct from CDP providers).
- `cap:agent:run` is a new capability id; no other agent should register it.

## Next steps (post-coordination)
1. Run a coordinated `bun run typecheck` (or scoped) to confirm no interface drift.
2. Run `bun test tests/unit/engines/local-agent.test.ts` in CI context (already 8/8 local).
3. Sync `spec.md` + `research.md` to verified contract.
4. Report done; do NOT commit unless explicitly asked.
