# 05 — QUALITY GATE & AUDIENCE MAP
### Generates: docs/README.md, docs/AUDIENCE-MAP.md, docs/OPEN-QUESTIONS.md (if needed), and runs the final audit

## 1. `docs/README.md`

The entry point. Structure:

```markdown
# Documentation Index

Generated <date> from commit <hash>. See AUDIENCE-MAP.md to find what to read for your role.

## Contents
- [Feature List](product/FEATURE-LIST.md)
- [Product Description](product/PRODUCT-DESCRIPTION.md)
- [Conceptual Design](product/CONCEPTUAL-DESIGN.md)
- [Architecture](architecture/ARCHITECTURE.md)
- [Data Flow](architecture/DATA-FLOW.md)
- [Data Model](architecture/DATA-MODEL.md)
- [API Reference](interfaces/API-REFERENCE.md)
- [CLI Reference](interfaces/CLI-REFERENCE.md)
- [I/O Reference](interfaces/IO-REFERENCE.md)
- [Capabilities & Roadmap](extensibility/CAPABILITIES-AND-ROADMAP.md)

## One-paragraph summary of the whole system
<3-5 sentences, written last, after everything else exists — the distillation of every doc above>
```

## 2. `docs/AUDIENCE-MAP.md`

Build one row per audience, mapping to **specific sections**, not just whole files:

```markdown
| Audience | Start here | Then read | Skip |
|---|---|---|---|
| Executive / stakeholder | PRODUCT-DESCRIPTION.md §"What this is" | FEATURE-LIST.md (skim table only), CONCEPTUAL-DESIGN.md §"idea in one paragraph" | ARCHITECTURE.md, API-REFERENCE.md |
| Product manager | FEATURE-LIST.md | PRODUCT-DESCRIPTION.md, CAPABILITIES-AND-ROADMAP.md §5 | Rust-level API detail |
| New engineer (onboarding) | ARCHITECTURE.md | DATA-MODEL.md, API-REFERENCE.md, DATA-FLOW.md | CONCEPTUAL-DESIGN.md (optional, read later) |
| Backend/Rust contributor | API-REFERENCE.md Part A | DATA-MODEL.md, ARCHITECTURE.md §1.2–1.3 | Product/vision docs |
| Frontend contributor | API-REFERENCE.md Part A+C | ARCHITECTURE.md §1.2, DATA-FLOW.md §2.1 | — |
| DevOps / release engineer | CLI-REFERENCE.md | ARCHITECTURE.md §1.4, IO-REFERENCE.md §3.2 | Conceptual design |
| Security reviewer | IO-REFERENCE.md | API-REFERENCE.md, DATA-FLOW.md §2.4, ARCHITECTURE.md §"trust boundaries" | Product description |
| Integrator / external developer | CAPABILITIES-AND-ROADMAP.md §6 | API-REFERENCE.md, CLI-REFERENCE.md | Conceptual design |
| Support / customer-facing | FEATURE-LIST.md | PRODUCT-DESCRIPTION.md | Architecture, API |
```
Adjust rows to fit what actually exists (e.g. drop "backend contributor" distinctions if the team is one person — still keep the map, just don't force artificial separation that doesn't reflect the project).

## 3. `docs/OPEN-QUESTIONS.md` (only create if non-empty)

```markdown
# Open Questions / Unresolved Items

| Item | Where flagged | Why unresolved | Suggested next step |
|---|---|---|---|
```
Every `⚠️ UNCONFIRMED` marker placed anywhere in the pack must have a corresponding row here.

---

## 4. Final Self-Audit (run against every generated file, in order)

For **every** file produced, check off:

- [ ] Has the required metadata header (00-ORCHESTRATOR.md §4)
- [ ] No invented facts — every specific claim traces to a real file/line/config value
- [ ] Every Mermaid block is syntactically valid (mentally parse it once more)
- [ ] Every internal link resolves to a real file path in the generated tree
- [ ] No section was silently dropped from its template — "Not applicable" used instead where needed
- [ ] Tone matches its file's role (technical vs. narrative, per 00-ORCHESTRATOR.md §5)

Then, cross-file consistency pass:

- [ ] Component/module names match across ARCHITECTURE.md, DATA-FLOW.md, and API-REFERENCE.md
- [ ] Table names match exactly across DATA-MODEL.md and everywhere else they're referenced
- [ ] Every feature in FEATURE-LIST.md that has an IPC command or route is cross-linked to API-REFERENCE.md, and vice versa
- [ ] AUDIENCE-MAP.md references only sections that actually exist with those exact headings
- [ ] The completeness bar in 00-ORCHESTRATOR.md §3 is fully checked off, or every failing item is logged in OPEN-QUESTIONS.md

Only after this entire checklist passes should you report the task complete on the v1 scope. Then continue — do not stop here — into the v2 checks below, which are equally required.

## 5. In-App Publishing & Tour Audit (v2)

- [ ] `docs-manifest.json` and `search-index.json` both parse as valid JSON and every `docId`/`sectionId` referenced anywhere (search index, tour manifest, in-doc cross-links) resolves to a real entry.
- [ ] `.ids-registry.json` has an entry for every doc and section that carries an explicit anchor — spot-check a handful against their source Markdown headings.
- [ ] Grep the entire `docs/` tree for the pattern `](.*\.md` (a relative Markdown link) — this must return zero results after Phase G.
- [ ] The scaffolded Next.js docs route builds/renders without a network call for content (check for any `fetch(` to a non-local host inside the new viewer components).
- [ ] At least one Mermaid diagram actually renders as a diagram in the viewer, not as an inert code block — verify the rendering component is wired, not just present in the file tree.
- [ ] Every section tagged `audience_visibility: internal-only` is confirmed absent from what the in-app viewer would render in a non-dev build (re-check §3 of `06-IN-APP-PUBLISHING-SPEC.md`'s filter, don't just trust the tag was set correctly).
- [ ] `tour-manifest.json` passes its own validation list in `08-GUIDED-TOUR-SPEC.md` §5.
- [ ] Every `data-tour` attribute referenced by the tour manifest is actually present in the component it claims to be in.
- [ ] The "Take a tour" entry point is reachable from the running app in the fewest clicks possible from the docs home.

When reporting completion, summarize: file count generated (Markdown + JSON), diagram count generated, tour count generated, whether the viewer route builds cleanly, and the contents of `OPEN-QUESTIONS.md` (or confirm it's empty).
