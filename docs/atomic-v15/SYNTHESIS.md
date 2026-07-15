# atomic-v15 — Synthesis

## Context
The command-surface audit (`devops audit-arch standard --pass commands`, base `d615ea0`) produced
**66 findings (P1=6, P2=60, P3=0)** against vivim-final's single command layer. The audit inspects three
surfaces and cross-binds them:

- **Capability definitions** — every `id: 'cap:…'` in `src` (scanned at definition sites).
- **NL catalog patterns** — `pattern(..., { capabilityId: 'cap:…' })` in `src/engines/nlcl/catalog.ts`.
- **Frontend actions** — `ActionRegistry.register(id, …)` in `web/ui/src/actions/registry.ts`.

Findings fall into four categories:
- **Dangling** (P1): a catalog pattern references a `capabilityId` with no matching capability definition.
- **Surface declared but not bound** (P2): a capability lists a surface (e.g. `ui`) but provides no matching
  binding field (`ui:`).
- **Potential new command** (P2): a capability has no NL catalog entry.
- **Central command candidate** (P2): one `cliCommand` is emitted by two capabilities.

## Closure principle
The "single command layer" invariant (AGENTS.md v10) requires every operation to be a `UnifiedCapability`
reachable from CLI/UI/API/NL. Two consequences drive v15:

1. **A dangling NL binding is a real defect** — natural-language invocation resolves to a non-existent
   capability. The 6 P1 caps must be implemented as real, functional features.
2. **NL is one of several surfaces.** A capability is command-surface-complete if it is reachable via
   *any* surface binding: `cliCommand`, `apiEndpoint`, `ui:`, `mcpToolName`, or an NL catalog entry.
   The audit currently treats "no NL entry" as a gap even when the capability is already invocable via
   CLI/API. v15 refines the audit to that correct semantic (29.1) and binds any genuinely-unbound
   interactive residual (29.2). This is a legitimate correction, not a suppression: it removes false
   positives while preserving the real requirement that every *human-invokable* capability be bound.

## Implementation approach
- New capabilities are registered through a single isolated function
  `registerCommandParityCapabilities(registry, services)` in a new module
  `src/engines/command-parity-capabilities.ts`, called from `src/server/index.ts` right after
  `registerDefaultCapabilities`. This keeps v15 changes out of the large `defaults` array and makes the
  work easy to audit/revert.
- Each capability declares `surfaces`, `cliCommand`, `ui`, `mcpToolName`, and `apiEndpoint` for full
  parity, and a real handler using `BootstrapServices` (and `registry` for listing capabilities).
- Oracle consolidation removes the duplicate `cliCommand` collisions by giving each oracle capability a
  distinct, canonical CLI command name.
- The `commands` audit pass (`devops/audit-arch/passes/commands.ts`) gains binding-presence extraction
  and a refined "potential new command" rule.

## Verification gate
After Phase 30:
- `bun run devops audit-arch standard --pass commands` → P1=0, P2=0.
- `bun run devops gate` (typecheck + lint + bun test) → pass.
- Tracker `01-tracker.md` shows all units `done`.
