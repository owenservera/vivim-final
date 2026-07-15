# Phase 16: Kernel Surfaces — Phase Index

**Units:** 6 | **Status:** 3 done, 2 partial, 1 pending | **Domain:** Expose kernel to REST, MCP, CLI, frontend

**Implemented as v9/v10 — kernel-router.ts serves API + CLI. Frontend dashboard not built.**

## Units

| ID | Name | Priority | Status |
|----|------|----------|--------|
| 16.1 | Kernel REST API (kernel-router.ts) | HIGH | [x] |
| 16.2 | Kernel MCP Tools | HIGH | [~] |
| 16.3 | Kernel CLI | MEDIUM | [x] |
| 16.4 | Kernel Frontend Surface (OracleDashboard) | MEDIUM | [ ] |
| 16.5 | MCP Server Integration | HIGH | [~] |
| 16.6 | CLI Kernel Commands (bun run kernel) | MEDIUM | [x] |

## Spec References

- 16.1: `docs/atomic-v5/phase-16-kernel-surfaces/16.1-kernel-rest.md`
- 16.2: `docs/atomic-v5/phase-16-kernel-surfaces/16.2-kernel-mcp.md`
- 16.3: `docs/atomic-v5/phase-16-kernel-surfaces/16.3-kernel-cli.md`
- 16.4: `docs/atomic-v5/phase-16-kernel-surfaces/16.4-kernel-frontend.md`
- 16.5: `docs/atomic-v5/phase-00-surgical-edit/16.5-mcp-server-integration.md`
- 16.6: `docs/atomic-v5/phase-00-surgical-edit/16.6-cli-kernel-commands.md`

## Completion Criteria

- [ ] All 6 units marked [x] in tracker
- [x] Kernel accessible via REST API
- [~] Kernel tools available via MCP (partial)
- [x] Kernel CLI commands work
- [ ] Kernel frontend dashboard renders
