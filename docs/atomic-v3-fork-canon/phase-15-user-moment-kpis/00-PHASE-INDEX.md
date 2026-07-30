# Phase 15: User Moment KPIs

> **Codifies the 10 major user moments into measurable KPIs.**
> Each unit defines a user moment, its KPI metrics, measurement method,
> acceptance thresholds, and test contract. KPIs are tracked via
> `bun run devops kpi <command>` and surfaced in the health dashboard.

## User Moments

| Unit | Moment | KPI Category | Primary Metric |
|------|--------|-------------|----------------|
| 15.1 | First Launch: The Black Canvas | Onboarding | Time-to-first-agent-message |
| 15.2 | Provider Login: Chrome Opens Itself | Authentication | Time-to-auth-confirmed |
| 15.3 | First Real Message: The Capability Reveal | Core Loop | Time-to-first-token |
| 15.4 | Command Palette (Ctrl+K): The Power Surface | Discovery | Search-to-execute latency |
| 15.5 | Provider Switching: Seamless Context | Multi-Provider | Context-transfer time |
| 15.6 | Canvas Nodes: Watching Intelligence Grow | Streaming | Time-to-first-token + smoothness |
| 15.7 | Help System: Context-Aware Guidance | Support | Time-to-answer + relevance |
| 15.8 | Multi-Surface Execution: Four Surfaces | Parity | Cross-surface parity score |
| 15.9 | Workspace Settings: Fleet Control | Operations | Health-refresh accuracy |
| 15.10 | Conversation Search: Memory That Works | Memory | Search latency + relevance |

## KPI Infrastructure

- **Storage:** `KpiMeasurement` table in Prisma (timestamped measurements)
- **Collection:** Automatic via engine hooks + manual via `bun run devops kpi record`
- **Reporting:** `bun run devops kpi report [--moment=<id>] [--since=<date>]`
- **Dashboard:** Health dashboard auto-refreshes with KPI cards
- **Alerting:** Threshold breaches logged to TelemetryAggregator

## Dependencies

- Phase 3 (Agentic Core) — capability execution pipeline
- Phase 4 (HTML Canvas) — canvas rendering
- Phase 5 (Workspace UI) — UI components
- Phase 6 (Provider Expansion) — provider system
- Phase 9 (Observability) — telemetry infrastructure
- Phase 14 (LLM Testing) — cross-surface verification
