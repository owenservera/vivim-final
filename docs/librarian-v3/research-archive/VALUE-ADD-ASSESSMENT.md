# Value-Add Assessment — User Research vs. LIVIN-LIB v3

> Assessing the saved research (`VIVIM-KNOWLEDGE-SYSTEM.md`) against `docs/librarian-v3/` (DESIGN.md + AUTO-LIB.md + auto-discover.ts).

---

## Confirmed: User research validates LIVIN-LIB direction

| LIVIN-LIB v3 Design (`DESIGN.md`) | User Research Confirmation |
|---|---|
| Auto-discovery (`auto-discover.ts`) | Confirmed: OpenWiki + Agent Wiki + Backstage all rely on structured source scanning |
| Self-maintaining docs (`docs:generate`) | Confirmed: OpenWiki + Agent Wiki + gh-aw all use agent-driven regeneration |
| Capability-linked docs (`capability_ref`) | Confirmed: User explicitly calls out Vivim's capability layer as "gold for automated documentation" |
| Contextual embedded docs (`Context Engine`) | Confirmed: User proposes same architecture (`current_route + current_provider + current_capability` → contextual help) |
| Self-healing links (`id`-derived, manifest-resolved) | Confirmed: Agent Wiki's `update policy` + GitHub's `detect drift → propose PR` pattern |
| Tour automation (`generate-tour.ts`) | Confirmed: Frigade journey model + Tour Kit primitives + UserTour architecture |
| Four-layer separation (Discover/Understand/Accomplish/Recover) | Confirmed: User proposes same 4-layer model explicitly |
| Knowledge graph (not Markdown pile) | Confirmed: User proposes `KnowledgeEntity` + relationships; sidebar = one projection |
| AI constrained retrieval (not giant vector DB) | Confirmed: User proposes 7-level hierarchy with provenance exposed |
| Specialized agent architecture (not one giant AI) | Confirmed: User proposes `Knowledge Orchestrator` + 8 specialized agents |
| Verification / provenance (`verification` object per item) | Confirmed: User's JSON schema includes `verified_at` + `verification` fields |

---

## Extensions provided by user research (not yet in v3)

These should be added to `DESIGN.md` or `MANIFEST-SPEC.md`:

| Extension | Source | Where to add |
|---|---|---|
| **Knowledge entity types** (`Concept`, `Feature`, `Capability`, `Provider`, `Workflow`, `Screen`, `UIElement`, `Setting`, etc.) | User §7 | `MANIFEST-SPEC.md` or `DESIGN.md` §2 |
| **Relationship model** (`implemented_by`, `available_on`, `requires`, etc.) | User §7 | `MANIFEST-SPEC.md` schema |
| **Instruction model** (`Instruction` with `target` + `action` + `explanation`) | User §10 | `DESIGN.md` §4.6 (tour engine) |
| **Feedback loop** (documentation friction detection → agent proposal → human approval → measure outcome) | User §13 | `DESIGN.md` §4.2 (capability-driven docs) |
| **Agent architecture naming** (`Knowledge Orchestrator`, `Code Archaeologist`, `Knowledge Extractor`, etc.) | User §16 | `DESIGN.md` §2.1 |
| **Anti-pattern list** (don't embed Mintlify wholesale; don't make everything embeddings) | User §19 | `AUTO-LIB.md` or `DESIGN.md` §1 |
| **Four-layer documentation** (Discover / Understand / Accomplish / Recover) | User §11 | `DESIGN.md` §0 (soup → nuts lifecycle) |

---

## Gaps in user research (covered by v3 but not emphasized in research)

| v3 Feature | User Research Coverage | Assessment |
|---|---|---|
| Auto-discovery script (`auto-discover.ts`) | Not mentioned explicitly; user focuses on architecture, not starter code | v3 fills execution gap |
| `.lefthook` pre-commit integration | Not mentioned; user discusses safe maintenance but not CI hook mechanism | v3 fills deployment gap |
| Desktop build integration (`tauri` pipeline) | Not mentioned; user assumes embedded app but doesn't specify build hook | v3 fills packaging gap |
| `.ids-registry.json` mechanism | Not mentioned; user discusses IDs but not registry file structure | v3 fills ID persistence gap |
| `MANIFEST-SPEC.md` enhanced schema | User proposes similar (`id`, `type`, `source`, `verified_at`, `verification`) but doesn't formalize JSON schema file | v3 fills spec gap |
| Backward compatibility with `docs/librarian/` v2 | Not mentioned; user proposes new architecture without migration plan | v3 includes non-destructive merge rule (`DESIGN.md` §5) |

---

## Overall Value Assessment

### High-value alignment (implement immediately)

1. **Knowledge model entities + relationships** — adds formal schema that v3 currently lacks.
2. **Contextual documentation architecture** (`current_context` → help) — directly extends v3's `generate-viewer.ts` with user-facing value.
3. **Feedback loop / optimization cycle** — transforms docs from static output to self-improving product feature.
4. **Instruction model** — enables the `[Show me]` guided walkthrough that connects docs to live UI.
5. **Anti-pattern guardrails** — prevents future over-engineering (whole Mintlify embed, pure embeddings).

### Medium-value extensions (add when expanding)

6. **Specialized agent naming** — useful for future `devops/` CLI commands (`docs:archaeologist`, `docs:extractor`).
7. **Four-layer separation** — improves user experience design but doesn't change automation pipeline.
8. **Instruction/action taxonomy** — enhances tour generation but requires UI instrumentation first.

### Low-value / covered (already in v3)

- Self-maintaining wiki (OpenWiki confirmation) → `docs:generate`
- Controlled updates (Agent Wiki confirmation) → `update_policy` concept
- Safe maintenance (GitHub confirmation) → `verify-docs.ts` + `.lefthook`
- Customer journey (Frigade confirmation) → `tour-manifest.json`
- Catalog/relationships (Backstage confirmation) → `capability_ref` links

---

## Recommendation

The user research **strongly validates** LIVIN-LIB v3 direction and provides the **formal schema and architectural depth** that v3's starter scripts (`auto-discover.ts`) don't yet include. It should be integrated as:

1. **Reference document**: Keep `VIVIM-KNOWLEDGE-SYSTEM.md` in `docs/librarian-v3/research-archive/` as canonical design reference.
2. **Schema extension**: Extract `§7` (entity types + relationships) into `MANIFEST-SPEC.md`.
3. **Feature addition**: Extract `§10` (Instruction model) and `§13` (Feedback loop) into `DESIGN.md` updates when implementing `generate-tour.ts` and live mode.
4. **Guardrail integration**: Extract `§19` (Anti-patterns) into `AUTO-LIB.md` as operating constraints.
5. **Agent architecture**: Use `§16` naming convention when expanding `devops/` CLI commands.

The value add is **confirmed high** — the research transforms v3 from an automation pipeline into a **product-grade knowledge architecture** aligned with Vivim's capability system.

---

*Saved to: `docs/librarian-v3/research-archive/VIVIM-KNOWLEDGE-SYSTEM.md`*
*Reference: `docs/librarian-v3/DESIGN.md`, `AUTO-LIB.md`, `scripts/auto-discover.ts`*
