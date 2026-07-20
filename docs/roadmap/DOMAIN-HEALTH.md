# Domain Health

**Generated:** 2026-07-19T15:38:34.583Z

| Domain | Total | Done | Pending | Truth Score | Top Gaps |
|--------|-------|------|---------|-------------|----------|
| storage | 21 | 21 | 0 | 100% | Interface not implemented: AgentLoopRunRow; Interface not implemented: AgentLoopStore |
| observability | 3 | 3 | 0 | 100% | Interface not implemented: AuditEntry; Interface not implemented: AuditPolicy |
| configuration | 1 | 1 | 0 | 100% | Interface not implemented: ConfigScope; Interface not implemented: ConfigValue |
| session-state | 12 | 12 | 0 | 100% | Design claim unverifiable: conversation-driver.ts; Interface not implemented: CaptureOptions |
| chrome-management | 3 | 3 | 0 | 100% | Interface not implemented: CdpBindingStore; Interface not implemented: CdpRegisterOptions |
| capability-system | 5 | 5 | 0 | 100% | Mixed file: src/engines/capability-binder.ts; Mixed file: src/engines/capability-bootstrap-generated.ts |
| api-server | 12 | 12 | 0 | 100% | Interface not implemented: CompositeIntent; Interface not implemented: AutomationRouterDeps |
| cli | 8 | 8 | 0 | 100% | Interface not implemented: SetupClientOptions |
| general | 141 | 138 | 3 | 98% | Design claim violated: harness.ts; Mixed file: src/engines/agent-builder.ts |
| provider-routing | 19 | 18 | 1 | 95% | Mixed file: src/engines/conceptual-model-service.ts; Design claim unverifiable: provider-discovery-engine |

---

## Gap Distribution by Domain

- **general:** 354 gaps
- **storage:** 99 gaps
- **capability-system:** 31 gaps
- **chrome-management:** 30 gaps
- **provider-routing:** 29 gaps
- **session-state:** 12 gaps
- **api-server:** 10 gaps
- **configuration:** 9 gaps
- **observability:** 5 gaps
- **cli:** 1 gaps
