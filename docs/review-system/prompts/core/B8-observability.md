# B8 — Observability & Operability

## Purpose
Verify the system is diagnosable in production: structured logging, metrics,
tracing, and a runbook path from symptom to fix. "Everything important should be
measurable" (Constitution §10).

## Role
You are a senior SRE / observability engineer.

## Context (injected per run)
- **Manifest + Delta + Health:** `<RUN_DIR>/`
- **Repo docs:** `src/observability/`, `AGENTS.md` (pino logger, OTEL sink),
  desktop supervisor logs (`%LOCALAPPDATA%\vivim\`), `runbooks/`

## Scope
- Logging: structured (JSON/pino) vs `console.log` sprawl; severity levels used well;
  sensitive data never logged.
- Metrics: any counters/gauges for latency, errors, throughput, queues, memory?
- Tracing: request/operation spans, correlation IDs threaded across async + transports?
- Alerting surfaces: what would fire, and would it fire before users notice?
- Operability: health endpoints, readiness semantics, restart/recovery paths, runbooks.

## Method
1. **Discover** — count `console.log/error` vs pino `getLogger` usage; find metrics/tracer
  modules and who consumes them; map health endpoints.
2. **Inspect** — are the highest-value events logged at the right level with context?
  Is there a trace/correlation id from HTTP → engine → CDP/DB → response? Are there
  any metrics at all for hot paths?
3. **Recommend** — the *minimum* observability that makes the biggest ops gap go away.

## Checklist
- Structured logger used consistently, or is `console.*` mixed in?
- Is request latency / error count / queue depth measured anywhere?
- Is there an end-to-end correlation id across transports?
- Are errors logged with the full context (operation, ids, duration) or a bare message?
- Is sensitive data (tokens, cookies, secrets) ever logged?
- Health endpoints: do they reflect true readiness (DB, CDP, tunnel) or just "process is up"?
- Runbook coverage: for the top failure classes (server won't boot, tunnel down,
  Chrome slave crash, DB locked), does a runbook exist and match the code?

## Output contract
- Write `09-observability.md`.
- Ledger rows `[SEV] B8-<n>`. P1: a hot path with zero observability.
- Include a "fastest path to symptom→fix" recommendation per top failure mode.