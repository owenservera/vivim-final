# v4 Fork Draft Structure

## Directory Tree

```
docs/atomic-v4-fork-canon/
├── 01-tracker.md                    ← 71 units, 14 phases, canonical header
├── PORT-OVER-PLAN.md                ← cross-reference: fork ID → source spec
├── PHASE-DEPENDENCIES.md            ← intra-phase dependency chains
├── CHANGELOG.md                     ← what changed vs original v4
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
└── phase-14-profile-trace/
    └── 00-PHASE-INDEX.md            ← 4 units
```

## Design Decisions

1. **Phase naming:** Keep original v4 phase names (e.g., `phase-01-e2e-bootstrap`)
2. **ID scheme:** Keep original v4 IDs (e.g., `1.1`, `2.1`) — already clean
3. **No kernel phases:** v4 intentionally excludes Phase 0 (kernel), Phase 15 (oracle), Phase 16 (surfaces)
4. **Spec references:** Phase index files reference original v4 specs (`docs/atomic-v4/phase-*`)
5. **Status preservation:** Units with `[~]` status in v4 tracker stay `[~]` in fork

## Total Files to Create

- 4 root files (tracker, port-over, deps, changelog)
- 14 phase directories with index files
- **Total: 18 files**
