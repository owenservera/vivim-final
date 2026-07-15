# vivim v3.0.0 — Release Notes (Knowledge Graph Rebuild: Completion Layer)

**Release date:** 2026-07-13
**Tag:** `v3.0.0`
**Codename:** cap-store v1 Completion Layer

## What's in this release

The completion layer finalizes the v11 roadmap. All 21 remaining atomic units
(phases 31–37) are implemented, tested, and documented. The platform now ships:

- **Sovereign operating trust** — consent, data residency, audit trail,
  right-to-be-forgotten, trust scoring, breach notification.
- **Long-horizon autonomy** — durable goal memory, self-correction,
  capability evolution, autonomy budgets.
- **Provider mesh** — capability-aware mux, latency optimizer, cost governor,
  health kernel, geo router.
- **Reliability & recovery** — caching, human-in-the-loop gates, pause/resume,
  state snapshots, provider failover.
- **Observability** — daily health digest.
- **Sovereign data hardening** — at-rest DB encryption, offline autonomous
  execution, encrypted backups, device pairing.
- **UX & release** — React workspace SDK, first-run onboarding, performance
  bench suite, OpenAPI spec, and this user manual.

## Upgrade notes

1. `bun install && bun run prisma:generate`
2. `bun run migrate` (applies the `HealthDigest` model + prior migrations)
3. Optional: enable at-rest encryption via `CAP_STORE_ENCRYPT_DB=1`.

## Quality gates

- All unit/integration tests pass (`bun test`).
- Performance baselines recorded in `bench/baseline.json`.
- OpenAPI spec and user manual generated from source (`docs:openapi`, `docs:manual`).

## Tagging

```bash
git tag -a v3.0.0 -m "cap-store v1 completion layer (units 31-37)"
git push origin v3.0.0
```
