# Convergence: v2 `local-agent` Spec vs OpenCode Reality (v1.17.15)

**Goal:** Confirm the v2 `local-agent` design (`specs/022-local-agent-opencode`) is implementable against the verified OpenCode protocol, and flag divergences.

## Spec assumptions vs verified facts

| Spec claim (v1 one-shot) | Verified reality | Verdict |
|--------------------------|------------------|---------|
| `opencode run` is one-shot | Confirmed `--format json` one-shot works; multi-turn also works via `-s` | ✅ Extend spec to allow resume |
| Parse `ContentBlock[]` from output | CLI NDJSON `text`/`tool_use` map cleanly to `ContentBlock` | ✅ Confirmed |
| Free model available | `opencode/deepseek-v4-flash-free` etc. work, cost 0 | ✅ Confirmed |
| Non-interactive | `--auto` or `permission:allow` config → no prompts | ✅ Confirmed |
| Single transport (CLI) | CLI fully verified; ACP/serve viable but CLI simpler | ✅ Use CLI |
| Error on failure | Permission denial is SILENT (exit 0, `invalid` tool) | ⚠️ Spec must add `invalid`-tool detection |
| Config default model usable | Repo `default_agent:build`→unauthenticated sonnet | ⚠️ Executor MUST pass `-m` + scratch dir |

## Divergences requiring spec/impl changes
1. **Permission denial is not an error event.** The v2 executor must scan for `tool_use` with `part.tool === "invalid"` and raise `EngineError(PermissionDenied)`. The spec's error model must include this silent path.
2. **Always pass `-m`.** The repo config points at an unauthenticated model; relying on config default fails. Executor hard-codes a free model + runs from a scratch `--dir`.
3. **Resume via `-s`, not `--continue`.** The spec's "continue session" must use `-s/--session <id>`; `--continue <id>` is a known trap.
4. **Two error channels.** Fatal CLI errors (stderr + exit 1) vs runtime `type:"error"` events (exit 1). Executor captures both.
5. **Compaction is opencode-internal.** Spec should not attempt manual context management.

## Recommendation
The v2 `local-agent` backend is **fully implementable** with the CLI transport. No blocking gaps. The impl-doc (`docs/research/reports/opencode-agentic-impl-docs-2026.md`) has stale v1.17.15 assumptions — corrections listed in `IMPL-DOC-CORRECTIONS.md`.

## Transport decision
- **Primary: CLI `run --format json`** (verified end-to-end: one-shot, multi-turn, tools, errors, permissions).
- **Secondary (future): serve HTTP** for multi-client; requires scratch-dir model override + `GET /api/session/:id` polling.
- **Deferred: ACP** — prompt method needs session bootstrap; not worth the complexity for v2.
