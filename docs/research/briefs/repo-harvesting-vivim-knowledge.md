# Repo Harvesting — Brief (Vivim AutoDoc / LIVIN-LIB v3)

**Source:** [Full report: `VIVIM-KNOWLEDGE-SYSTEM.md` (research archive)](../research-archive/VIVIM-KNOWLEDGE-SYSTEM.md)
**Topic:** GitHub repo harvesting for Vivim's Living Product Knowledge System
**Classified:** Gap-triggered / Code-focused (requires confirmed integration paths)
**Confidence:** Medium-High (8 repos analyzed; 6 have direct architectural value to v3)
**Sources:** 8 (primary repos + GitHub docs + changelogs)
**Date:** 2026-08-26

---

## TL;DR

For the `vivim-final` autodocumentation pipeline (`docs/librarian-v3/`), the highest-value harvest targets are:

1. **OpenWiki** (`langchain-ai/openwiki`) — closest conceptual match; confirms self-maintaining knowledge graph architecture.
2. **Agent Wiki** (`onyx-dot-app/agent-wiki`) — best controlled autonomous update policies; directly applicable to `MANIFEST-SPEC.md` policy inheritance.
3. **GitHub Agentic Workflows** (`github/gh-aw`) — best safe automated documentation maintenance pattern (`detect drift → propose PR → review`); confirms `verify-docs.ts` + approval gate design.
4. **Backstage** (`backstage/backstage`) — best catalog/metadata/relationship architecture; confirms `KnowledgeEntity` + relationship model in `MANIFEST-SPEC.md`.
5. **Mintlify** (`mintlify/docs`) — best documentation UX/analytics reference; confirms user-journey analytics and AI/MCP integration.
6. **Tour Kit** (`domidex01/tour-kit`) — best headless onboarding primitives; confirms guided-tour engine design for `generate-tour.ts`.

Lower direct value for automation pipeline (but relevant for UX layer): Usertour, Frigade, Tour Kit.

---

## Key Decisions (Binding for v3 Implementation)

1. **Don't embed Mintlify wholesale.** Use only its architecture patterns (structured nav, generated APIs, analytics model) — not the product.
2. **Don't adopt OpenWiki as dependency.** Steal its architecture concept (knowledge graph + agent-written wiki) but implement via our `scripts/` pipeline (`auto-discover.ts` → `generate-docs.ts` → `generate-manifest.ts`).
3. **Agent Wiki's update policies must become `MANIFEST-SPEC.md` standard.** Every doc section needs `update_policy` inheritance (conceptual = no auto-update; capability ref = auto-update allowed).
4. **Backstage's catalog model confirms our `KnowledgeEntity` + relationship schema.** Must finalize in `MANIFEST-SPEC.md` before P2-01.
5. **GitHub Agentic pattern confirms `docs:verify` + `.lefthook` + `docs:propose` workflow.** Never silent rewrite; always review gate.
6. **Tour Kit confirms `generate-tour.ts` should produce headless primitives** (not full tour framework) — aligns with our `tour-manifest.json` + `Spotlight` component design.

---

## Evidence Summary

- [OpenWiki — GitHub + research notes](../evidence/repo-harvesting/notes.md) (`VIMIM-KNOWLEDGE-SYSTEM.md`: §1, §6, §7): Self-maintaining wiki; agent-written; visual graph; CI updates.
- [Agent Wiki — GitHub + research notes](../evidence/repo-harvesting/notes.md) (`VIMIM-KNOWLEDGE-SYSTEM.md`: §1, §3, §6): Controlled autonomous updates; Markdown canonical; Git history; update policies; event triggers.
- [GitHub Agentic — docs automation guide](../evidence/repo-harvesting/notes.md) (`VIMIM-KNOWLEDGE-SYSTEM.md`: §1, §3): Safe automated docs maintenance (`detect drift → propose PR → review`); never silent rewrite.
- [Mintlify docs — GitHub + changelog analysis](../evidence/repo-harvesting/notes.md) (`VIMIM-KNOWLEDGE-SYSTEM.md`: §2, §4): Documentation information architecture; AI-agent interfaces; MCP access; user-journey analytics (Feb 2026 + Aug 2026 updates).
- [Backstage — technical overview](../evidence/repo-harvesting/notes.md) (`VIMIM-KNOWLEDGE-SYSTEM.md`: §5, §7): Catalog/metadata/relationship architecture; centralized catalog; extensible plugins.
- [Tour Kit — GitHub](../evidence/repo-harvesting/notes.md) (`VIMIM-KNOWLEDGE-SYSTEM.md`: §1, §3): Headless React onboarding; tours + hints + checklists + microsurveys + AI Q&A.
- [UserTour — GitHub](../evidence/repo-harvesting/notes.md) (`VIMIM-KNOWLEDGE-SYSTEM.md`: §3): Self-hosted in-app onboarding; TypeScript/React.
- [Frigade — JavaScript SDK](../evidence/repo-harvesting/notes.md) (`VIMIM-KNOWLEDGE-SYSTEM.md`: §4): Full customer lifecycle (`Registration → Activation → Adoption → Engagement → Retention`).

All sources cited in saved archive document (`research-archive/VIVIM-KNOWLEDGE-SYSTEM.md`).

---

## Open Questions

1. Does `backstage` plugin architecture apply to our `CapabilityEventBus` or is the relationship model sufficient?
2. Should `Mintlify` analytics model (`routes → searches → chat behavior → feature usage`) be integrated into our feedback loop (`P9`)?
3. Does `Tour Kit`'s component architecture conflict with our `frontend/src/ui/slots.ts` design, or is it compatible?
4. Should the user-journey analytics proposal (`P8` / `P9`) reference `Mintlify` analytics model explicitly, or is our `context-engine.ts` sufficient?
5. `Frigade`'s lifecycle model (`Registration → ... → Retention`) — should we add lifecycle stages to `KnowledgeEntity` types?

---

## Used In

- `docs/librarian-v3/DESIGN.md` — validates architecture choices (§1 innovations, §2 architecture, §4.5 AI-enhanced search, §4.6 tour automation, §2.2 Backstage reference)
- `docs/librarian-v3/AUTO-LIB.md` — operator commands (`docs:discover`, `generate`, `verify`, `publish`, `live`, `all`)
- `docs/librarian-v3/ATOMIC-CHECKLIST.md` — P0–P10 implementation items (P1 discovery, P2 knowledge model, P3 doc generation, P4 manifest, P5 viewer + tour, P6 verification + live, P7 integration, P8 context engine, P9 feedback loop, P10 agent specialization)
- `docs/research/briefs/` — this brief serves gate A5/A6 for the autodocumentation unit
- `docs/research/code-paths/` — to be populated when convergence achieves (see P3-01 → P3-08 for feature/code generation; P5-01 → P5-10 for viewer/tour; P9-01 → P9-06 for feedback loop; P10-01 → P10-09 for agent specialization)

---

*Status: Brief saved. Evidence archive (`VIVIM-KNOWLEDGE-SYSTEM.md`) saved. Value assessment (`VALUE-ADD-ASSESSMENT.md`) confirms high-value alignment with all 9 reference projects. Ready to proceed to P2 (Knowledge Model Schema) or P1 (Discovery Expansion) upon user confirmation.*
