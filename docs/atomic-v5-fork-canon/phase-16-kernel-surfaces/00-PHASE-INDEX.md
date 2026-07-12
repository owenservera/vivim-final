# Phase 16: Kernel Surfaces — Phase Index

**Units:** 6 | **Status:** [ ] pending | **Domain:** Expose kernel to REST, MCP, CLI, frontend, server integration

## Overview

Kernel surfaces: expose the kernel to all user/system surfaces — REST API,
MCP tools, CLI commands, frontend dashboard, MCP server integration, CLI kernel commands.

## Units

| ID | Name | Priority | Status |
|----|------|----------|--------|
| 16.1 | Kernel REST API | HIGH | [ ] |
| 16.2 | Kernel MCP Tools | HIGH | [ ] |
| 16.3 | Kernel CLI | MEDIUM | [ ] |
| 16.4 | Kernel Frontend Surface | MEDIUM | [ ] |
| 16.5 | MCP Server Integration | HIGH | [ ] |
| 16.6 | CLI Kernel Commands | MEDIUM | [ ] |

## Dependency Chain

```
16.1 → 16.2 → 16.3 → 16.4 → 16.5 → 16.6
```

## Key Design Decisions

1. **REST API** — `/api/kernel/*` routes for HTTP access
2. **MCP tools** — system.describe/diagnose/heal/explain
3. **CLI** — kernel status/diagnose/trace/config commands
4. **Frontend** — OracleDashboard in UI
5. **Server integration** — Register kernel tools with MCP server
6. **CLI integration** — bun run kernel status/diagnose/trace

## Spec References

- 16.1: `docs/atomic-v5/phase-16-kernel-surfaces/16.1-kernel-rest.md`
- 16.2: `docs/atomic-v5/phase-16-kernel-surfaces/16.2-kernel-mcp.md`
- 16.3: `docs/atomic-v5/phase-16-kernel-surfaces/16.3-kernel-cli.md`
- 16.4: `docs/atomic-v5/phase-16-kernel-surfaces/16.4-kernel-frontend.md`
- 16.5: `docs/atomic-v5/phase-00-surgical-edit/16.5-mcp-server-integration.md`
- 16.6: `docs/atomic-v5/phase-00-surgical-edit/16.6-cli-kernel-commands.md`

## Completion Criteria

- [ ] All 6 units marked [x] in tracker
- [ ] Kernel accessible via REST API
- [ ] Kernel tools available via MCP
- [ ] Kernel CLI commands work
- [ ] Kernel frontend dashboard renders
