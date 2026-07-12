# Phase 8: Observability & Audit

**Status:** PROPOSED
**Units:** 8
**Depends on:** Phase 2, Phase 7
**Produces:** Full execution tracing, provenance visualization, real-time telemetry dashboard, and zero-cloud audit proof.

---

## Goal

The existing telemetry stack (HealthHistory, CapabilityTelemetry, TelemetrySummary, ManifestChangeLog) records metrics but doesn't connect them to specific executions or surface them usefully. Phase 8 closes the loop: every capability execution is traceable end-to-end, the provenance graph is explorable visually, and the system can prove (cryptographically if needed) that it only talked to user-consented hosts.

---

## Units

### 8.1 Distributed tracing (OpenTelemetry-style spans)
**Source:** v3 Overview §1.5
**Depends on:** 2.14
**Produces:** Every capability execution + every CDP call + every LLM call wrapped in a span.

Spans: `conversation.send → capability.execute → selector.try → cdp.send`. Each span has `traceId, spanId, parentSpanId, name, ts, durationMs, attributes`. Stored in `trace_span` table (extension of existing `trace_entry`).

### 8.2 Provenance visualization surface
**Source:** v3 Overview §3
**Depends on:** 2.15, 8.1
**Produces:** `ProvenanceInspectorSurface` (built-in canvas).

User picks an outcome from a list; surface renders the provenance tree (selector → parser → program → provider state → conversation turn). Click any node to see the raw CDP request/response. Filter by date, provider, capability.

### 8.3 Real-time telemetry dashboard v2
**Source:** v3 Overview §3
**Depends on:** 4.9
**Produces:** TelemetryDashboardSurface wired to live data via WebSocket.

Beyond static charts: live-streaming sparklines for the last 60s, animated health-score transitions, drift events as toast notifications. WebSocket subscription filterable by provider.

### 8.4 Telemetry audit enforcement (network layer)
**Source:** v3 Overview §1.10
**Depends on:** 5.8
**Produces:** `TelemetryAuditInterceptor` monkey-patches `globalThis.fetch` and `Bun.fetch`.

Every outbound call: (a) check `provider_consent` for the host, (b) record to `NetworkCallRecord`, (c) if unconsented, throw `ConsentViolationError`. Cannot be bypassed by engines (the monkey-patch is in `src/server/bootstrap.ts` and applied before any engine code runs).

### 8.5 Audit report generator v2
**Source:** v3 Overview §1.10
**Depends on:** 8.4
**Produces:** `TelemetryAudit.generateSignedReport()` produces a tamper-evident report.

Report includes: SHA-256 hash chain over all `NetworkCallRecord`s in the period, list of unique hosts contacted, verdict (clean/suspicious/violating), per-initiator breakdown. Signed with a device-local key (Phase 9).

### 8.6 Cost + token tracking (per task, per provider, per capability)
**Source:** v3 Overview §1.4
**Depends on:** 7.6
**Produces:** `cost_log` joined to `agent_run` and `provenance_node`.

Existing `ProviderCostLog` extended with `agentRunId`, `provenanceNodeId`. Enables: "this autonomous task cost $0.42, of which $0.30 was the summarize step." Surfaces in `AgentFrontendSurface` and `TelemetryDashboardSurface`.

### 8.7 Latency budget enforcement
**Source:** v3 Overview §1.4
**Depends on:** 8.1
**Produces:** Per-pipeline-stage latency budgets from `MirrorEngine` (resolve 5ms, ensure 2s, send 500ms, capture 30s, parse 200ms).

When a stage exceeds budget: (a) record to `latency_budget_breach`, (b) emit `latency:breach` event, (c) surface in dashboard. Persistent breaches on a provider degrade its health score.

### 8.8 System health report (daily digest)
**Source:** v3 Overview §3
**Depends on:** 8.3, 8.6
**Produces:** `AutomationSchedule` that runs daily and writes a markdown digest.

Digest covers: providers used, costs incurred, capabilities executed (+success rates), drift events resolved, autonomous tasks completed, memory growth. Optional email/file notification. Stored in `docs/audit/daily-{date}.md`.

---

## Acceptance

- Any outcome in the system can be traced back to its originating user action within 3 clicks in the UI.
- `TelemetryAudit.generateSignedReport()` for a clean week produces a report that an external auditor can verify.
- Cost of an autonomous task is visible in real time and accurate to within 5% of the provider's invoice.
- Daily digest runs at 09:00 every day without manual intervention.
