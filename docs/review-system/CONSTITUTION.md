# Engineering Constitution — VIVIM

> A living technical constitution: the thresholds, scorecard, principles, and
> debt-ledger schema the review system measures against. The review system
> **reads from this file** at run time; it is NOT a prompt that gets rewritten.
> Update thresholds here and every future run inherits them.

## 1. Executive Health Dashboard

| Category | Target | Warning | Critical |
|----------|--------|---------|----------|
| Type cleanliness (any/ts-ignore/non-null per 1000 LOC) | <1 | 1–4 | >4 |
| Test pass rate | 100% | >95% | <95% |
| Circular dependencies | 0 | <5 | >5 |
| TODO/FIXME debt | <100 | 100–500 | >500 |
| Largest file | <800 LOC | 800–1500 | >1500 |
| Functions over 75 LOC | 0 | <5 | >5 |
| Nesting depth > 5 | 0 | <5 | >5 |
| Functions with params > 6 | 0 | <5 | >5 |

> NOTE: Absolute line targets (avg file size, LOC, build time) are included in
> the org scorecard but are **guides, not gates** — line count is a smell, not a
> verdict. The gates above (the ones that drive P0/P1 findings) are the "type
> cleanliness", "function too long", "nesting depth", and "circular deps" rows.

## 2. Architectural Health (score 1–10 each)

Derived in B1. Reported as the single "Overall Architecture" number in C2.

- Separation of Concerns
- Layer Isolation
- Plugin Independence
- API Stability
- Module Cohesion
- Dependency Direction
- Runtime Simplicity
- Build Simplicity
- Data Ownership
- Event Flow Clarity

Score anchor: 8–10 = clean; 5–7 = documented drift, safe to defer; 1–4 = the
documented architecture is being bypassed at scale — must fix.

## 3. Plugin/Module Independence Checklist

Each major module/plugin must answer YES (verified in B1):

- [ ] Can be removed without breaking core
- [ ] Has explicit capabilities
- [ ] Owns its own state
- [ ] Owns its own storage
- [ ] No hidden globals
- [ ] Versioned interface
- [ ] Contract tested

## 4. Security Checklist (verified in B5)

- Secrets: none in code, none in repo, none in logs or committed files
- Permissions: least-privilege; no blanket grants
- Authentication: every non-public surface authenticated
- Authorization: every sensitive action authorized (not just authenticated)
- Input validation: every boundary validated with a schema
- Output encoding: untrusted data not rendered raw
- Dependency vulnerabilities: pinned + scanned
- Sandboxing: untrusted code runs in a sandbox
- Filesystem isolation: no unrestricted paths (e.g. `~`, `..`, drive-relative)
- Command execution: no unvalidated `exec`/`spawn`
- Network boundaries: listeners bound, CORS/egress scoped

## 5. Security principle

Never cram a security finding into "nice to have" just because it needs a
repro. If it is exploitable, it is P0. If it is reachable, it is P1.

## 6. Maintainability signals (B1 / C1)

- Dead code (unused exports, orphan tables, unused deps)
- Duplicated logic (same shape > 2 places)
- Comment accuracy (code moved on, comment did not)
- Architecture-doc drift
- ADR coverage for non-trivial decisions
- Public API documentation

## 7. Testing taxonomy (B7 — coverage is necessary, not sufficient)

- Unit quality (behavior, not implementation)
- Integration quality (real engine-to-engine)
- Contract tests (store contract, capability bindings, API schema)
- Plugin/module isolation tests
- Regression tests for every fixed bug
- Mutation testing (are tests catching real faults)
- Performance benchmarks
- Stress / flakiness runs

## 8. Repository health (B1)

- One responsibility per folder
- Shallow, discoverable folder depth
- Module ownership (who owns what)
- Naming consistency
- Dependency direction (no upward imports)
- No orphaned folders (dead dirs at repo root)

## 9. Code Review Checklist (applied per unit report)

- Architecture: fits existing arch; no unnecessary abstraction; boundaries respected
- Correctness: edges, failures, cancellation
- Performance: unnecessary allocation/async; no N²
- Maintainability: readable, tested, documented, **observable**

## 10. Engineering Principles

1. **Simplicity first** — delete before adding.
2. **Composition over inheritance.**
3. **Data ownership is explicit.**
4. **No hidden state.**
5. **Every dependency must justify itself.**
6. **Every abstraction pays rent.**
7. **Prefer boring solutions.**
8. **Optimize after measuring.**
9. **Plugins own capabilities.**
10. **Public APIs change slowly; internal APIs can evolve quickly.**
11. **Types represent reality — never lie to the compiler.**
12. **Minimize global state; small modules; high cohesion; low coupling; deterministic behavior.**
13. **Fail loudly.**
14. **Observable systems — everything important should be measurable.**

## 11. The Platform Rule (overriding principle)

> **Every new line of code should either simplify the system, increase
> capability, or eliminate future work.** If a line does none of those, it
> probably should not be added. A 120k-line codebase stays manageable only if
> these metrics stay healthy; when several trend wrong, absolute line count
> matters far less than the accumulating architectural debt.

## 12. Alpha Scope & Out-of-Scope Triage (OVERLAPS the platform rule)

> **Default-in, flag-out.** Every finding is treated as **alpha-in-scope** until
> the human explicitly flags its area as out of scope. Nothing is pre-classified
> as future. The human flags areas progressively as the release narrows.

- **Alpha** = everything not yet flagged. If a finding is in-scope it **gates**
  the alpha release: P0/P1 must be fixed before launch, P2/P3 are tracked.
- **Out-of-scope (future)** = the human explicitly lists an area in the
  Out-of-Scope Register (`docs/review-system/SCOPE.md`). Findings whose area is
  registered are **documented + tracked but never gate alpha and get no
  implementation time now** — they remain valid placeholders.
- The register is the **only** place out-of-scope is declared. A human flagging
  an area must write one line in `SCOPE.md` (see the file's "how to flag").
- A finding whose scope is ambiguous is **assumed in-scope** (fail toward alpha),
  never silently deferred.
- **Review-time rule:** reviewers must not spend analysis effort on out-of-scope
  areas beyond one line noting "placeholder for future — see SCOPE.md". Effort
  goes to alpha.

### 12.1 Severity × Scope matrix

| Finding | In alpha scope | Out of scope (registered) |
|---------|----------------|---------------------------|
| P0/P1   | must fix before alpha | document + track; placeholder acceptable; never gate |
| P2/P3   | fix when convenient / tech debt | document + track only |

### 12.2 Lifecycle of a scope flag

1. Human writes the area into `docs/review-system/SCOPE.md`.
2. Next review run / findings pass annotates affected findings as `out-of-scope`.
3. Those findings stay in the ledger (never deleted — history preserved) but are
   excluded from the alpha gate and the fix-brief's actionable set.
4. Re-flagging (removing a line) returns the area to alpha; its findings
   re-gate.

### 12.3 This run's flags (run-2026-08-06)

See `docs/review-system/SCOPE.md`. Flagged to date:

- **Remote capability sync** — out of scope for alpha.
- **Remote vivim tunnel** — out of scope for alpha.