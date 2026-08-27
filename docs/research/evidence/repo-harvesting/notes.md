# Evidence Notes — Repo Harvesting for Vivim Knowledge System

Source archive: `../research-archive/VIVIM-KNOWLEDGE-SYSTEM.md`
Topic: GitHub repo harvesting for autodocumentation pipeline
Collected: 2026-08-26
Method: Read full user-provided research text; compared against existing v3 design files (`DESIGN.md`, `MANIFEST-SPEC.md`, `AUTO-LIB.md`, `ATOMIC-CHECKLIST.md`, `scripts/auto-discover.ts`); produced brief (`brief.md`) + assessment (`VALUE-ADD-ASSESSMENT.md`).

## Raw Observations

1. OpenWiki (rw-01) confirms the concept of "knowledge graph with human-readable projections" rather than static pages. This aligns with `MANIFEST-SPEC.md`'s `KnowledgeEntity` + relationship model and `DESIGN.md`'s architecture (§0 soup→nuts lifecycle, §7 architecture). No conflict with v3 automation approach — confirms direction.

2. Agent Wiki (rw-02) confirms controlled autonomous updates via policies (`auto_update`, inheritance). This extends `MANIFEST-SPEC.md` beyond current state — needs `update_policy` field added to manifest schema. Not yet implemented in `MANIFEST-SPEC.md` draft (P2-01 pending).

3. GitHub Agentic (rw-03) confirms safe maintenance (`detect drift → propose PR → review`). Confirms `verify-docs.ts` + `.lefthook` + `docs:propose` design in v3 (§6 Live Mode, P6). No new implementation needed — validates existing architecture.

4. Mintlify (rw-04) confirms documentation analytics and AI/MCP interfaces. Extends `DESIGN.md` §4.5 (AI-enhanced search) and `P8` (context engine). Suggests adding user-journey analytics to feedback loop (`P9`) — not yet in `ATOMIC-CHECKLIST.md`. Could be medium-value extension.

5. Backstage (rw-05) confirms catalog/relationship architecture. Validates `MANIFEST-SPEC.md` schema (`KnowledgeEntity` relationships, `capability_ref`, `provider_ref`). No gap — v3 schema already covers this via P2 design.

6. Tour Kit (rw-06) confirms headless React onboarding primitives. Confirms `generate-tour.ts` design (`P5` viewer + tour). Confirms `ATOMIC-CHECKLIST.md` P5-01 through P5-10. No gap — validates approach.

7. UserTour (rw-07) confirms self-hosted onboarding. Less direct value for automation pipeline; more relevant for UX layer (`P8` contextual docs). Could be reference for onboarding design if user wants to expand beyond docs.

8. Frigade (rw-08) confirms full customer lifecycle (`Registration → Activation → Adoption → Engagement → Retention`). Confirms `P9` feedback loop design (user events → friction detection → agent proposal → measure). Confirms `P8` four-layer model (Discover/Understand/Accomplish/Recover maps to Frigade stages). No gap — validates lifecycle approach.

## Key Takeaway

The saved research strongly validates LIVIN-LIB v3's architecture direction. The main extensions needed are:
- Formal `MANIFEST-SPEC.md` schema (P2-01) — entity types + relationships from `DESIGN.md` §7 not yet in file
- `update_policy` inheritance mechanism (Agent Wiki contribution) — not in current `MANIFEST-SPEC.md`
- User-journey analytics integration (`Mintlify` Aug 2026 updates) — optional extension for `P9`

No conflicts with existing v3 files (`DESIGN.md`, `AUTO-LIB.md`, `scripts/auto-discover.ts`, `ATOMIC-CHECKLIST.md`).

## References

- Full archive: `../research-archive/VIVIM-KNOWLEDGE-SYSTEM.md`
- Brief: `../briefs/repo-harvesting-vivim-knowledge.md`
- Assessment: `../research-archive/VALUE-ADD-ASSESSMENT.md`
- v3 design: `../../librarian-v3/DESIGN.md`
- v3 checklist: `../../librarian-v3/ATOMIC-CHECKLIST.md`
