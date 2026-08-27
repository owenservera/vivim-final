# ATOMIC IMPLEMENTATION CHECKLIST — LIVIN-LIB v3 + Vivim Knowledge System

> Every item is atomic: one file action, one verifiable result. Check `☑` when complete.
> Source references point to real paths in `vivim-final` at time of creation.

---

## P0 — Foundation (Files + Registry Seed)

| # | Task | Source / File Ref | Pass Criteria |
|---|---|---|---|
| P0-01 | Create `.ids-registry.json` seed file (empty but valid schema) | `docs/librarian-v3/` | `JSON.parse()` succeeds; has `docs`, `sections`, `status` fields |
| P0-02 | Create `MANIFEST-SPEC.md` (enhanced schema with `capability_ref`, `provider_ref`, `verification`) | `docs/librarian-v3/` | References `DESIGN.md` §3; includes sample JSON |
| P0-03 | Confirm `DESIGN.md` exists and references `MANIFEST-SPEC.md` | `DESIGN.md` line 77 | `DESIGN.md` links to spec file |
| P0-04 | Confirm `AUTO-LIB.md` exists with 6 commands listed | `AUTO-LIB.md` | `docs:discover`, `generate`, `verify`, `publish`, `live`, `all` all present |
| P0-05 | Create `.runtime/` parent dir if missing (for `docs-inventory.json`) | `.runtime/` | `mkdir -p .runtime` equivalent works |

---

## P1 — Discovery Automation (Expand `auto-discover.ts`)

| # | Task | Source / File Ref | Pass Criteria |
|---|---|---|---|
| P1-01 | Expand `auto-discover.ts` to read `prisma/schema.prisma` (table names) | `scripts/auto-discover.ts` | Writes `tables_found` > 0 to `inventory.json` |
| P1-02 | Add `tauri.conf.json` capability scanning (`scope` lines) | `scripts/auto-discover.ts` | Writes capability entries to inventory |
| P1-03 | Add `seeds/providers/manifests.ts` parsing (provider slug + endpoint) | `scripts/auto-discover.ts` | Provider manifest entries in inventory |
| P1-04 | Add `.env.example` env var reading (key names only) | `scripts/auto-discover.ts` | Env vars in inventory; no secret values |
| P1-05 | Add `frontend/src/ui/slots.ts` component registry read | `scripts/auto-discover.ts` | Slot IDs in inventory |
| P1-06 | Add `src/config.ts` config key reading | `scripts/auto-discover.ts` | Config keys mapped to `.env` refs |
| P1-07 | Verify `auto-discover.ts` runs with `bun run` and exits 0 | Command line | `.runtime/docs-inventory.json` created; exit code 0 |

---

## P2 — Knowledge Model Schema (`MANIFEST-SPEC.md` + Registry)

| # | Task | Source / File Ref | Pass Criteria |
|---|---|---|---|
| P2-01 | Define `KnowledgeEntity` types in spec (`Concept`, `Feature`, `Capability`, `Provider`, `Workflow`, `Screen`, `UIElement`, `Setting`, `Integration`, `Tutorial`, `Troubleshooting`, `FAQ`, `Release`, `Limitation`, `Policy`, `GlossaryTerm`) | `MANIFEST-SPEC.md` | All 16 types listed |
| P2-02 | Define relationship schema (`Feature` → `Capability`, `Screen`, `Provider`, `Guide`, `Tutorial`, `Release`) | `MANIFEST-SPEC.md` | 7 relationships documented |
| P2-03 | Add `instruction` model (`Instruction` type: `target`, `action`, `explanation`) | `MANIFEST-SPEC.md` | Action enum (`click`/`open`/`type`/`select`/`observe`) defined |
| P2-04 | Add `verification` object schema (`verified_at`, `verification`: `code_exists`/`ui_exists`/`workflow_test`) | `MANIFEST-SPEC.md` | JSON sample valid |
| P2-05 | Update `.ids-registry.json` to include `status` field (`registered`/`redirected`/`removed`) | `.ids-registry.json` | Schema includes status values |
| P2-06 | Confirm registry can be parsed by `generate-manifest.ts` | `.ids-registry.json` | `JSON.parse()` succeeds |

---

## P3 — Documentation Generation (`generate-docs.ts` — Conceptual)

| # | Task | Source / File Ref | Pass Criteria |
|---|---|---|---|
| P3-01 | Create `generate-docs.ts` skeleton (reads inventory, outputs `docs/product/FEATURE-LIST.md`) | `scripts/generate-docs.ts` | File exists; has `main()` function |
| P3-02 | Link each feature to `capability_ref` from registry | `FEATURE-LIST.md` output | Every feature row has `capability_ref` |
| P3-03 | Link each capability to `provider_ref` | `FEATURE-LIST.md` output | Capabilities tagged with provider slug |
| P3-04 | Generate `docs/architecture/DATA-MODEL.md` from `prisma/schema.prisma` (ER diagram in Mermaid) | `DATA-MODEL.md` | Contains `erDiagram` block |
| P3-05 | Generate `docs/interfaces/API-REFERENCE.md` from `tauri.conf.json` capabilities + `invoke_handler` list | `API-REFERENCE.md` | Every registered command listed |
| P3-06 | Generate `docs/interfaces/CLI-REFERENCE.md` from `package.json` scripts + `bin/` entries | `CLI-REFERENCE.md` | Every CLI entry point listed |
| P3-07 | Generate `docs/interfaces/IO-REFERENCE.md` from `.env.example` + `tauri.conf.json` capabilities | `IO-REFERENCE.md` | Env vars + FS access + network + OS integrations |
| P3-08 | Mark sections with `internal-only` (contains `src-tauri/`, `.ts`) and `in-app` (product/concept) automatically | Generated files | Sections tagged with visibility |

---

## P4 — Manifest + Search Index (`generate-manifest.ts`)

| # | Task | Source / File Ref | Pass Criteria |
|---|---|---|---|
| P4-01 | Create `generate-manifest.ts` (reads `.ids-registry.json` + `docs/` tree) | `scripts/generate-manifest.ts` | Outputs `docs/docs-manifest.json` |
| P4-02 | Manifest includes `id`, `slug`, `title`, `category`, `file`, `anchor`, `capability_ref`, `provider_ref`, `audience_visibility`, `nav_order`, `diagrams[]`, `sections[]` | `docs-manifest.json` | Every doc/section/diagram present |
| P4-03 | `search-index.json` generated (one entry per section; `in-app`/`both` only) | `docs/search-index.json` | Contains `snippet`, `keywords`, `route` |
| P4-04 | Link rewrite: scan all `.md` for relative `.md` links; rewrite to `/docs/<slug>#<anchor>` | `docs/` | Zero relative `.md` links remain |
| P4-05 | `links_verified` set to `true` if `verify-docs.ts` passes | `docs-manifest.json` | Boolean field present |
| P4-06 | `open_questions` array populated from `.archive/` or audit failures | `docs-manifest.json` | Entries have `id`, `source`, `action` |

---

## P5 — Viewer + Tour (`generate-viewer.ts` + `generate-tour.ts`)

| # | Task | Source / File Ref | Pass Criteria |
|---|---|---|---|
| P5-01 | `generate-viewer.ts` creates `frontend/src/app/docs/` route (`page.tsx`) | `frontend/src/app/docs/page.tsx` | Route exists; imports manifest |
| P5-02 | Viewer renders `DocsSidebar` (nav tree from manifest categories + `nav_order`) | Component | Sidebar renders groups |
| P5-03 | Viewer renders `DocsSearch` (client-side search against `search-index.json`) | Component | Search responds to input |
| P5-04 | Viewer renders `DocsRenderer` (Markdown body; Mermaid blocks render; anchor IDs become DOM `id`) | Component | `erDiagram` blocks render as diagrams |
| P5-05 | `DocsBreadcrumb` component created (Category / Doc / Section links) | Component | Breadcrumb links resolve |
| P5-06 | `generate-tour.ts` reads capability execution paths + `frontend/src/lib/tour-targets.ts` | `tour-manifest.json` | Steps have `doc_ref` and `ui_target` |
| P5-07 | `tour-manifest.json` includes at least `getting-started` tour (core happy path) | `docs/tour-manifest.json` | `entry_points`: `["first-run", "help-menu"]` |
| P5-08 | Every `doc_ref.sectionId` resolves to manifest entry; every `ui_target.selector` matches `data-tour` attribute | `tour-manifest.json` | Validation passes |
| P5-09 | Tour engine component (`Spotlight`) dims rest of UI, highlights element, shows step narrative, Next/Back/Skip/End controls | Component | Controls visible; always-available `End tour` |
| P5-10 | Viewer handles unknown slug gracefully (lists nearby matches from manifest, not raw 404) | Component | Graceful screen present |

---

## P6 — Live Mode + Verification (`docs:live` + `verify-docs.ts`)

| # | Task | Source / File Ref | Pass Criteria |
|---|---|---|---|
| P6-01 | Create `verify-docs.ts` (reads manifest + registry + docs tree) | `scripts/verify-docs.ts` | Validates JSON; checks internal links |
| P6-02 | `verify-docs.ts` checks `component/module` names match across `ARCHITECTURE.md`, `DATA-FLOW.md`, `API-REFERENCE.md` | Audit result | Consistency report generated |
| P6-03 | `verify-docs.ts` checks every feature in `FEATURE-LIST.md` links to `API-REFERENCE.md` (and vice versa) | Audit result | Cross-link verification passes |
| P6-04 | `verify-docs.ts` exits non-zero on any failure; writes `.runtime/docs-verify-report.json` | `.runtime/docs-verify-report.json` | Exit code 1 if errors; JSON written |
| P6-05 | `docs:live` command (watch `src/`, `prisma/`, `docs/`; regenerate manifest; rebuild viewer; report verify errors) | `scripts/live-server.ts` | Command available via `bun run docs:live` |
| P6-06 | `docs:all` command (discover → generate → verify → publish in sequence; fails fast) | `scripts/all-pipeline.ts` | Single command runs full pipeline |

---

## P7 — Integration (Hooks + CI + Desktop)

| # | Task | Source / File Ref | Pass Criteria |
|---|---|---|---|
| P7-01 | `.lefthook/pre-commit` updated (`docs-verify` hook on changed `src/`, `prisma/`, `docs/`) | `.lefthook/pre-commit` (or equivalent) | Hook triggers `bun run docs:verify` |
| P7-02 | `package.json` `prepare` script runs `docs:all --once` | `package.json` | Script present |
| P7-03 | CI workflow (`.github/workflows/`) includes `bun run docs:all` as required check | `.github/workflows/` | Workflow step present |
| P7-04 | Desktop build (`scripts/tauri/build.ps1`) includes `docs:publish` step (rebuilds viewer into Tauri bundle) | `scripts/tauri/build.ps1` | `publish` referenced |
| P7-05 | `frontend/src/app/docs/` uses `generateStaticParams` from manifest (`generateView.ts` uses manifest slugs) | `frontend/src/app/docs/page.tsx` | Static params present |
| P7-06 | Viewer route never `fetch()` to external host for doc content (offline-first verified) | Component code | No external `fetch` calls |
| P7-07 | `data-tour` IDs present in component source (`data-tour` attributes) for at least first-run tour | Component code | Attributes present; registry file references them |

---

## P8 — Contextual Documentation (`Context Engine`)

| # | Task | Source / File Ref | Pass Criteria |
|---|---|---|---|
| P8-01 | Create `KnowledgeEntity` model definition (entity types from P2-01) | `docs/knowledge/model.md` or `MANIFEST-SPEC.md` update | All 16 types defined |
| P8-02 | Create relationship schema (`Feature` → `Capability`, etc.) | `docs/knowledge/model.md` | 7 relationships documented |
| P8-03 | Create context resolution logic (reads current route, component, provider, capability, user level, onboarding state) | `frontend/src/lib/context-engine.ts` (new) | Function resolves context object |
| P8-04 | Context engine provides contextual explanation for current provider/capability (not generic docs) | Component integration | `Why am I seeing this?` card renders with provider-specific explanation |
| P8-05 | Contextual help includes `[Learn more]` (deep link to doc section) and `[Show me]` (tour step reference) | Component integration | Both buttons present; links resolve via manifest |

---

## P9 — Feedback Loop (Self-Improving System)

| # | Task | Source / File Ref | Pass Criteria |
|---|---|---|---|
| P9-01 | Define knowledge event tracking (user events: search query, doc open, tour start, tour abandon, capability invoke) | `docs/knowledge/events.md` or `MANIFEST-SPEC.md` | Event schema defined |
| P9-02 | Create drift detection mechanism (compare `inventory.json` against manifest; detect changed capability/provider/file) | `scripts/drift-detector.ts` (new) | Reports differences |
| P9-03 | Create documentation friction analysis (high abandonment rate → propose doc improvement) | `scripts/friction-analyzer.ts` (new) | Proposes changes based on event data |
| P9-04 | Define `update_policy` inheritance (conceptual docs = `auto_update: false`; capability refs = `auto_update: true`) | `MANIFEST-SPEC.md` update | Policy inheritance described |
| P9-05 | Create agent proposal output format (`docs:propose` outputs JSON with `changes`, `reasoning`, `verification_required`) | `scripts/propose-agent.ts` (new) | JSON output valid; includes verification flags |
| P9-06 | Confirm user approval gate exists (`docs:approve` or manual review before `publish`) — never silent rewrite | `MANIFEST-SPEC.md` or `DESIGN.md` | Approval mechanism documented |

---

## P10 — Agent Specialization + Orchestration

| # | Task | Source / File Ref | Pass Criteria |
|---|---|---|---|
| P10-01 | Define `Knowledge Orchestrator` agent (coordinates all others; reads inventory + manifest) | `docs/knowledge/agents.md` or `DESIGN.md` §2.1 update | Agent role defined |
| P10-02 | Define `Code Archaeologist` agent (discovers source changes) | `DESIGN.md` §2.1 / agent docs | Role mapped to `auto-discover.ts` |
| P10-03 | Define `Knowledge Extractor` agent (converts code changes to facts) | `DESIGN.md` §2.1 | Role mapped to `generate-docs.ts` |
| P10-04 | Define `Documentation Writer` agent (updates prose) | `DESIGN.md` §2.1 | Role mapped to `generate-docs.ts` |
| P10-05 | Define `Drift Detector` agent | `DESIGN.md` §2.1 | Role mapped to `verify-docs.ts` |
| P10-06 | Define `UX Documentation Agent` (maps knowledge to user journeys) | `DESIGN.md` §2.1 | Role mapped to `generate-tour.ts` |
| P10-07 | Define `Onboarding Designer` agent (creates/checklists) | `DESIGN.md` §2.1 | Role mapped to `generate-tour.ts` |
| P10-08 | Define `Troubleshooting Agent` agent (derives recovery paths) | `DESIGN.md` §2.1 | Role mapped to `generate-docs.ts` (troubleshooting section) |
| P10-09 | Define `Verification Agent` agent (tests claims against reality) | `DESIGN.md` §2.1 | Role mapped to `verify-docs.ts` |

---

## Completion Gates

Before declaring `LIVIN-LIB v3` complete:

- [ ] `P0` items 01–05 complete (`.ids-registry.json` seed; `MANIFEST-SPEC.md`; `DESIGN.md` + `AUTO-LIB.md` links)
- [ ] `P1` items 01–07 complete (`auto-discover.ts` expanded; `inventory.json` includes tables, capabilities, providers, slots, env vars, config keys)
- [ ] `P2` items 01–06 complete (`MANIFEST-SPEC.md` enhanced; `.ids-registry.json` has status fields)
- [ ] `P3` items 01–08 complete (`generate-docs.ts` produces feature list linked to capabilities + architecture docs)
- [ ] `P4` items 01–06 complete (`docs-manifest.json` + `search-index.json` valid; zero relative `.md` links)
- [ ] `P5` items 01–10 complete (`frontend/src/app/docs/` viewer + `tour-manifest.json` + data-tour attributes in source)
- [ ] `P6` items 01–06 complete (`verify-docs.ts` exits non-zero; `.lefthook` + `package.json` + CI + desktop build integrated)
- [ ] `P7` integration confirmed (`docs:all` runs; `docs:live` works; `docs:view` opens viewer)
- [ ] `P8` context engine present (`context-engine.ts` resolves current context; embedded help renders)
- [ ] `P9` feedback loop defined (event tracking schema; friction analysis; proposal format; approval gate documented)
- [ ] `P10` agent specialization complete (all 8 agent roles defined in `DESIGN.md`; orchestration reference present)

---

*File saved: `docs/librarian-v3/ATOMIC-CHECKLIST.md`*
*Cross-reference: `DESIGN.md`, `AUTO-LIB.md`, `MANIFEST-SPEC.md`, `scripts/auto-discover.ts`, `VALUE-ADD-ASSESSMENT.md`*
