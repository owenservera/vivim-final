# OpenClaw / Crabfleet / Nora — Observability Harvest (Step D)

**Purpose:** Harvest the *architecture shape* and *observability patterns* from the
Crabfleet run-lifecycle (`docs/runs.md`) and the Nora MCP server (`mcp-server/README.md`)
into vivim's existing `TelemetryAggregator` + `ChromeGovernor` fleet surface.

**Harvest rule (from `research-clones/README.md`):** extract architecture shape +
taxonomy/observability *structure* only. Do NOT execute cloned `SKILL.md` / plugin
runtime. No supply-chain-exec risk here (docs + README only), but the rule still
applies: this is a translation note, not a code-port.

**Verdict:** vivim already implements the Crabfleet/Nora observability model 1:1.
No code lift required — same conclusion as Step C (capability ownership). This doc
is the translation map + a short list of *enrichment* opportunities (optional, not
required for convergence).

---

## 1. Run-lifecycle state machine (Crabfleet) ↔ SlaveLifecycle (vivim)

Crabfleet (`docs/runs.md` §Run Lifecycle) records a durable run attempt in D1; the
run row does NOT launch a process — live execution is a Fleet interactive session that
attaches to a PTY. Statuses:

```
queued -> leasing -> running -> review | completed | failed | stalled | canceled
```

vivim (`src/executor/slave-states.ts`) models Chrome slaves the same way — a slave row
is a durable lifecycle record; live execution is a CDP session the governor attaches to.
The canonical state machine:

```
stopped -> starting -> running -> unhealthy
                            |         |
                            v         v
                        restarting -> error -> circuit_open -> terminal
```

| Crabfleet      | vivim `SlaveLifecycle` | Note |
|----------------|------------------------|------|
| `queued`       | `stopped` / `starting` | pre-launch, no live process |
| `leasing`      | `starting`             | capability/resource negotiation |
| `running`      | `running`              | live attached session |
| `stalled`      | `unhealthy` / `error`  | heartbeat timeout (see §2) |
| `review`       | `unhealthy` (soft)     | human-in-loop, not terminal |
| `completed`    | `stopped` (clean)      | finished run archived |
| `failed`       | `error` / `circuit_open` | terminal failure |
| `canceled`     | `stopped`              | explicit stop / card moved away |

**Takeaway:** vivim's `SlaveLifecycle` is a strict superset of Crabfleet's run statuses
— it adds the `unhealthy → restarting → circuit_open` recovery sub-graph that Crabfleet
only partially models (Crabfleet has `stalled` + manual `cancel`, vivim has automatic
circuit-breaker + exponential backoff via `backoffDelay()`). No gap to close.

---

## 2. Heartbeats & stall detection (Crabfleet) ↔ health probe + circuit breaker (vivim)

Crabfleet (`docs/runs.md` §Heartbeats and Stalls):
- Active statuses are `queued` / `leasing` / `running`.
- A run **stalls** when its heartbeat is older than a threshold (default 5 min).
- Reconciliation marks `stalled`, sets `endedAt`, stores `heartbeat timeout`, moves the
  card to Human Review, and logs the event.
- Manual `stall` preserves the active run record with a supplied reason.

vivim (`src/engines/chrome-governor.ts`, `probe()` at L583):
- `SlaveHealth` (L109) carries `lastHealthCheck`, `consecutiveFailures`, `circuitState`.
- `probe()` sends `Browser.getVersion`; on success sets `status='running'`,
  `lastHealthCheck=Date.now()`, `consecutiveFailures=0`; on failure increments
  `consecutiveFailures`, sets `status='error'`, and trips the per-slave circuit breaker
  (`getOrCreateCircuit` → emits `fleet:circuit_changed`).
- Emits `fleet:slave_status { slaveId, status }` on each transition (L620/L657).
- `FleetSuperState` reducer (`computeSuperState`) derives `idle | active | degraded |
  terminal` from the per-slave set — the equivalent of Crabfleet's fleet-wide card board
  state.

**Mapping:**
| Crabfleet concept        | vivim equivalent |
|--------------------------|------------------|
| heartbeat timestamp      | `SlaveHealth.lastHealthCheck` |
| stall threshold (5 min)  | `circuit_open` after N `consecutiveFailures` |
| `stalled` status         | `unhealthy` / `error` + circuit breaker |
| `endedAt` on stall       | `circuit_open` → terminal(error) |
| reconcile → log event    | `fleet:slave_status` / `fleet:circuit_changed` emit |
| move card to Human Review| `unhealthy` soft-state (no auto-terminal) — operator gate |

**Enrichment opportunity (optional, NOT required):** vivim has no explicit
`lastHeartbeat` *threshold* constant surfaced in config the way Crabfleet exposes
`stall_ms`. `TelemetryAggregator` could add a schedule that reads
`provider_health.lastHealthCheck` and emits a `fleet:slave_stalled` event when
`now - lastHealthCheck > STALL_MS`. This would make vivim's stall path event-driven
(consistent with `triggerMode: 'event'`) rather than purely circuit-breaker-driven.

---

## 3. Runtime capability advertisement (Crabfleet) ↔ per-slave capability flags (vivim)

Crabfleet (`docs/runs.md` §Runtime Selection) stores, per selected runtime:
- `selectionReason`
- `capabilities.terminal` / `.takeover` / `.vnc` / `.desktop` / `.logs` / `.artifacts`

The UI labels sessions from capabilities; the API *rejects* `takeover` unless the active
run advertises `capabilities.takeover = true`. Capability arrays are authoritative —
omitting `terminal` / `pty` / `ssh` withdraws terminal access.

vivim analogue: each `ChromeSlave` is bound to a provider + account, and the
provider's `ProviderDefinition` (protocol_status, capabilities seeded from
`seeds/providers/<slug>.json`) advertises what that slave can do (parser, selectors,
`send_message`, `select_model`). The governor enforces capability gating the same way:
a capability invoke against a slave whose provider hasn't registered the capability
fails closed (Step C ownership model).

**Enrichment opportunity (optional):** vivim does not yet carry a structured
`SlaveHealth.capabilities` object mirroring Crabfleet's six-flag array. For the
`ChromeGovernor` fleet surface this would let the UI label each slave (e.g. "desktop
capable", "takeover capable") and let the governor reject a `takeover`-style action
unless advertised. Low priority — current capability gating is provider-level, which is
sufficient for v1.

---

## 4. Nora MCP fleet tools ↔ TelemetryAggregator + event bus (vivim)

Nora `mcp-server/README.md` exposes a pure-API-client MCP server. Read tools:
`list_agents`, `get_agent`, `get_agent_stats`, `get_platform_metrics`,
`get_fleet_status`, `list_monitoring_events`, `get_agent_metrics`,
`get_agent_metrics_summary`, `get_agent_cost`. Write tools: `deploy_agent`,
`start_agent`, `stop_agent`, `restart_agent`, `redeploy_agent`, `delete_agent`
(gated behind `NORA_MCP_ALLOW_DESTRUCTIVE`). The connector stores nothing locally —
it forwards tool requests + API key to the Nora control plane.

vivim equivalents:

| Nora MCP tool            | vivim surface |
|-------------------------|---------------|
| `get_fleet_status`      | `ChromeGovernor.getSuperState()` → `FleetSuperState` |
| `list_agents` / `get_agent` | `fleetSupervisor.getAllInstances()` / `getInstance(slaveId)` |
| `list_monitoring_events`| `CapabilityEventBus` (`fleet:slave_status`, `fleet:circuit_changed`, `fleet:crash_detected`) |
| `get_agent_metrics`     | `TelemetryAggregator` schedules (`capability_telemetry`, `health_snapshot`, `selector_health`) |
| `get_platform_metrics`  | `getCrossProviderSummary()` / `getDailySummary()` |
| `get_agent_cost`        | (out of scope — vivim has no cost model; note as gap) |
| `deploy/start/stop/restart_agent` | `fleetSupervisor.spawn/kill/ensureRunning` (governor Canon: only ChromeGovernor touches CDP) |
| `delete_agent` (destructive) | `fleetSupervisor.killAll()` — should be gated the same way Nora gates `delete_agent` behind an explicit env flag |

**Key invariant preserved:** Nora's MCP server is a *thin read/write shell* over a
control plane — exactly the "One Entry Point" / thin-client invariant in AGENTS.md.
vivim's CLI (`src/cli/`) is the same thin shell over `POST /api/interpret`. No new
transport needed.

**Gap (informational, not blocking):** vivim has no cost telemetry (`get_agent_cost`).
`TelemetryAggregator` aggregates latency/success/selector-hit but not token/credit cost.
This is a deliberate v1 scope choice, not a convergence defect.

---

## 5. Convergence summary

| Dimension | Crabfleet/Nora pattern | vivim implementation | Gap |
|-----------|------------------------|----------------------|-----|
| Run/slave lifecycle | 8-state run FSM | `SlaveLifecycle` 7-state + recovery sub-graph | none (vivim superset) |
| Heartbeat / stall | 5-min threshold → `stalled` | `lastHealthCheck` + `consecutiveFailures` + circuit breaker | optional event-driven stall schedule |
| Capability advertisement | 6-flag runtime capability array | provider-level capability gating | optional `SlaveHealth.capabilities` |
| Fleet status | `get_fleet_status` | `getSuperState()` / `computeSuperState()` | none |
| Monitoring events | `list_monitoring_events` | `CapabilityEventBus` fleet:* events | none |
| Metrics | `get_agent_metrics` | `TelemetryAggregator` schedules | none |
| Cost | `get_agent_cost` | — | v1 out-of-scope |
| Thin MCP/CLI shell | pure API client | thin CLI over `/api/interpret` | none |

**Conclusion:** Step D confirms the same outcome as Steps A–C — vivim's
`TelemetryAggregator` + `ChromeGovernor` fleet surface already embodies the
Crabfleet/Nora observability architecture. The only *optional* enrichments are
(event-driven stall schedule, structured `SlaveHealth.capabilities`, destructive-action
env gate) and they are not required for harvest convergence. No code changes mandated.

---

## 6. Next steps
1. Mark Step D **DONE** in `docs/research/briefs/openclaw-brief.md` (Execution Status table).
2. Append a one-line cross-ref in `docs/research/code-paths/openclaw-harvest-path.md`.
3. Update `.opencode/memory/project.md` harvest state (Step D DONE; all harvest steps complete).
4. (Optional, separate task if user wants) Implement the three enrichment opportunities above.
