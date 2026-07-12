# v5 Fork Draft Structure

## Directory Tree

```
docs/atomic-v5-fork-canon/
├── 01-tracker.md                    ← 90 units, 17 phases, canonical header
├── PORT-OVER-PLAN.md                ← cross-reference: fork ID → source spec
├── PHASE-DEPENDENCIES.md            ← intra-phase dependency chains
├── CHANGELOG.md                     ← what changed vs original v5
├── phase-00-kernel-core/
│   └── 00-PHASE-INDEX.md            ← 10 units (kernel)
├── phase-01-e2e-bootstrap/
│   └── 00-PHASE-INDEX.md            ← 7 units
├── phase-02-single-turn/
│   └── 00-PHASE-INDEX.md            ← 8 units
├── phase-03-multi-turn/
│   └── 00-PHASE-INDEX.md            ← 6 units
├── phase-04-three-provider/
│   └── 00-PHASE-INDEX.md            ← 5 units
├── phase-05-frontend-perf/
│   └── 00-PHASE-INDEX.md            ← 6 units
├── phase-06-platform-foundation/
│   └── 00-PHASE-INDEX.md            ← 6 units
├── phase-07-reliability/
│   └── 00-PHASE-INDEX.md            ← 7 units
├── phase-08-resource-mgmt/
│   └── 00-PHASE-INDEX.md            ← 3 units
├── phase-09-observability/
│   └── 00-PHASE-INDEX.md            ← 5 units
├── phase-10-frontend-resilience/
│   └── 00-PHASE-INDEX.md            ← 3 units
├── phase-11-stealth-core/
│   └── 00-PHASE-INDEX.md            ← 4 units
├── phase-12-fingerprint-engines/
│   └── 00-PHASE-INDEX.md            ← 4 units
├── phase-13-human-simulation/
│   └── 00-PHASE-INDEX.md            ← 3 units
├── phase-14-profile-trace/
│   └── 00-PHASE-INDEX.md            ← 4 units
├── phase-15-kernel-oracle/
│   └── 00-PHASE-INDEX.md            ← 4 units (oracle)
└── phase-16-kernel-surfaces/
    └── 00-PHASE-INDEX.md            ← 6 units (surfaces)
```

## Design Decisions

1. **Phase naming:** Keep original v5 phase names (e.g., `phase-00-kernel-core`, `phase-15-kernel-oracle`)
2. **ID scheme:** Keep original v5 IDs (e.g., `0.1`, `1.1`, `15.1`) — already clean
3. **Kernel consolidation:** v5 original splits kernel across `phase-00-surgical-edit/` and `phase-00-kernel-core/`. Fork keeps them in `phase-00-kernel-core/` for cleanliness.
4. **Spec references:** Phase index files reference original specs (`docs/atomic-v5/phase-*` for kernel/oracle/surfaces, `docs/atomic-v4/phase-*` for phases 1-14)
5. **Status preservation:** Units with `[~]` status in v5 tracker stay `[~]` in fork

## Total Files to Create

- 4 root files (tracker, port-over, deps, changelog)
- 17 phase directories with index files
- **Total: 21 files**
