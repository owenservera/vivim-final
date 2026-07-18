# SpecKit + DevOps Integration — Parallel Orchestration Plan

**Generated:** 2026-07-17
**Total Phases:** 10
**Agent Slots:** 3 parallel agents
**Estimated Wall Time:** 4 batches (vs 10 sequential)

---

## Dependency Graph

```
Batch 1 (START — no dependencies):
  PRD-01: ID Bridge           ─── Agent A
  PRD-02: Skill Audit         ─── Agent B

Batch 2 (after Batch 1 completes):
  PRD-03: Unified Gate        ─── Agent A  (needs PRD-01)
  PRD-04: Research Bridge     ─── Agent B  (needs PRD-02)
  PRD-05: Tracker Unification ─── Agent C  (needs PRD-01)

Batch 3 (after Batch 2 completes):
  PRD-06: Skill Refactoring   ─── Agent A  (needs PRD-02,03,04,05)
  PRD-07: Converge+Audit      ─── Agent B  (needs PRD-03,06*)

Batch 4 (after Batch 3 completes):
  PRD-08: Unified CLI         ─── Agent A  (needs PRD-05,06,07)
  PRD-09: Documentation       ─── Agent B  (needs all above)
  PRD-10: Validation          ─── Agent C  (needs all above)
```

*PRD-07 technically depends on PRD-06, but can start with stubs and fill in after PRD-06 completes within the same batch.*

---

## Agent Assignments Per Batch

### Batch 1 — Foundation (parallel, no inter-dependencies)

| Agent | PRD | Task | Deliverable |
|-------|-----|------|-------------|
| **A** | PRD-01 | ID Bridge | `devops/speckit-bridge.ts` + tests |
| **B** | PRD-02 | Skill Audit | `devops/speckit-audit.ts` + `docs/integration/skill-readiness.md` |

**Coordination:** None needed. Agents work independently.

**Exit Criteria:** Both PRDs pass their success criteria. Hand off to Batch 2.

---

### Batch 2 — Bridges (parallel, depend on Batch 1)

| Agent | PRD | Task | Depends On | Deliverable |
|-------|-----|------|------------|-------------|
| **A** | PRD-03 | Unified Gate | PRD-01 | `devops/unified-gate.ts` + tests |
| **B** | PRD-04 | Research Bridge | PRD-02 | `devops/research-bridge.ts` + tests |
| **C** | PRD-05 | Tracker Unification | PRD-01 | `devops/tracker-speckit-sync.ts` + tests |

**Coordination:**
- Agent A needs PRD-01's `speckit-bridge.ts` to be complete and exported.
- Agent B needs PRD-02's `skill-readiness.json` to know which skills need research bridging.
- Agent C needs PRD-01's `speckit-bridge.ts` for the bidirectional sync.

**Exit Criteria:** All three PRDs pass their success criteria. Hand off to Batch 3.

---

### Batch 3 — Integration (parallel, depend on Batch 2)

| Agent | PRD | Task | Depends On | Deliverable |
|-------|-----|------|------------|-------------|
| **A** | PRD-06 | Skill Refactoring | PRD-02,03,04,05 | Updated SKILL.md files for 9 skills |
| **B** | PRD-07 | Converge+Audit | PRD-03,06* | `devops/speckit-converge-bridge.ts` + tests |

*PRD-07 can start with interface stubs while PRD-06 refactors skills, then wire up once skill updates land.*

**Coordination:**
- Agent A refactors skills based on the audit blueprint from PRD-02.
- Agent B builds the converge bridge that calls unified-gate (PRD-03) and references refactored skills (PRD-06).
- If Agent B finishes stubs before Agent A finishes skills, Agent B waits for skill SKILL.md updates.

**Exit Criteria:** All skills updated, converge bridge passes tests.

---

### Batch 4 — Polish (parallel, depend on Batch 3)

| Agent | PRD | Task | Depends On | Deliverable |
|-------|-----|------|------------|-------------|
| **A** | PRD-08 | Unified CLI | PRD-05,06,07 | `devops/speckit-cli.ts` + commands |
| **B** | PRD-09 | Documentation | All | Updated SPECKIT.md, AGENTS.md, UNIFIED-WORKFLOW.md |
| **C** | PRD-10 | Validation | All | Integration tests + full pipeline run |

**Coordination:**
- Agent A builds CLI commands that call into modules from Phases 5, 6, 7.
- Agent B documents the system that Agents A and C are building/testing.
- Agent C runs end-to-end validation that exercises everything.

**Exit Criteria:** CLI works, docs are complete, full pipeline passes.

---

## Risk Mitigation

### Risk 1: Batch 2 agents blocked by Batch 1
**Mitigation:** If PRD-01 or PRD-02 is delayed, the dependent agent in Batch 2 can start with interface stubs and fill in implementations once the dependency lands.

### Risk 2: PRD-06 (Skill Refactoring) is Large
**Mitigation:** PRD-06 touches 9 skills. Agent A can parallelize within the PRD by refactoring skills in groups:
- Group 1 (gate-related): `devops`, `devops-fullstack` — depend on PRD-03
- Group 2 (research-related): `devops-research`, `devops-roadmap` — depend on PRD-04
- Group 3 (audit-related): `source-audit`, `arch-audit` — independent
- Group 4 (supporting): `vivim-testing`, `prisma-workflow`, `vivi-frontend` — independent

### Risk 3: PRD-07 depends on PRD-06
**Mitigation:** PRD-07 can be built with interface stubs that reference skill SKILL.md paths. Once PRD-06 updates the skills, PRD-07 fills in the actual calls. Both agents work in Batch 3 with this staggered approach.

### Risk 4: PRD-10 validation finds regressions
**Mitigation:** PRD-10 is the final validation. If it finds issues, agents loop back to the relevant phase. The PRD explicitly includes a remediation loop.

---

## Communication Protocol

### Between Batches
- Each agent commits its deliverables before the batch exits.
- The next batch's agents read the committed files to understand the interfaces.
- No explicit handoff meeting needed — the code IS the handoff.

### Within Batches
- Agents work on different files (no write conflicts).
- If two agents need to modify the same file (e.g., `devops/index.ts`), they coordinate by editing different sections or using separate commits.

### Blockers
- If an agent is blocked, it creates a `BLOCKED.md` in `docs/integration/` with:
  - What it's waiting for
  - What it can do in the meantime (stubs, tests, docs)
  - Expected unblock time

---

## File Ownership (no conflicts)

| Agent | Owns Files |
|-------|-----------|
| **A** | `devops/speckit-bridge.ts`, `devops/unified-gate.ts`, `devops/speckit-cli.ts`, `devops/tracker-speckit-sync.ts` |
| **B** | `devops/speckit-audit.ts`, `devops/research-bridge.ts`, `devops/speckit-converge-bridge.ts`, `docs/integration/*` |
| **C** | `tests/integration/speckit-*.test.ts`, `docs/roadmap/prds/UNIFIED-WORKFLOW.md` |

**Shared files** (each agent modifies only its own section):
- `devops/index.ts` — each agent adds its command registration in a separate block
- `src/index.ts` — barrel exports, append-only

---

## Timeline Estimate

| Batch | Wall Time | Sequential Equivalent |
|-------|-----------|----------------------|
| Batch 1 | ~1 session | 2 sessions |
| Batch 2 | ~1 session | 3 sessions |
| Batch 3 | ~1 session | 2 sessions |
| Batch 4 | ~1 session | 3 sessions |
| **Total** | **~4 sessions** | **~10 sessions** |

**Speedup:** ~2.5x through parallelization.
