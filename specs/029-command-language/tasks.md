---
description: "Task list for command-language feature (enhanced) — vivim-final (TypeScript + Bun + Prisma)"
---

# Tasks: Command Language (Enhanced)

**Input**: Design documents from `/docs/specs/029-command-language/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Gate (per unit)**:
```powershell
bun run typecheck              # 0 errors in touched files
bun test tests/unit/engines/command-language  # unit tests pass
bun run lint                   # 0 new warnings
```

**Gate (per phase)**:
```powershell
bun run devops invariants check --category B  # 0 block violations
bun run devops audit-code standard             # 0 P0
```

**Gate (final)**:
```powershell
bun test                                      # all tests pass
bun run devops verify-cross-surface           # all caps resolve
```

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US8)
- Include exact file paths in descriptions
- Backend tasks use `src/engines/`, `src/storage/contracts/`, `src/storage/impl/`
- Frontend tasks use `web/ui/src/features/`, `web/sandbox/src/features/`
- Test tasks use `tests/unit/engines/`, `tests/integration/`, `tests/e2e/`

## Project Conventions

- **Language**: TypeScript strict, ESNext, `.js` extension in imports
- **Runtime**: Bun
- **ORM**: Prisma v6.5
- **Linter**: Biome
- **Testing**: `bun test` (Bun test runner)
- **Patterns**: `type` imports, `no any`, Zod validation, `Result<T,E>`, custom errors from `src/errors.ts`
- **Invariants**: Governor Canon (only ChromeGovernor touches CDP), Store Contracts (engines depend on contracts, not impls), One Entry Point (everything via UnifiedCapability)

---

## Phase 1: Type System + Parser + Resolver + NLP Matcher (US1 + US7 — Foundation)

**Goal**: Core routing engine — prefix detection, token parsing, fuzzy resolution, NLP intent detection. This is the blocking MVP.

**Independent Test**: Type `/health` → health response < 100ms. Type "switch to claude" → intent detected with confidence.

### Tests (write FIRST, ensure FAIL before implementation)

- [x] T001 [P] [US1] Unit test `tests/unit/engines/command-language/parser.test.ts` — prefix detection, token splitting, edge cases (empty input, whitespace-only, multi-word args, quoted strings)
- [x] T002 [P] [US1] Unit test `tests/unit/engines/command-language/resolver.test.ts` — fuzzy matching, MRU ranking, boost calculation, namespace prefix matching
- [x] T003 [P] [US7] Unit test `tests/unit/engines/command-language/nlp-matcher.test.ts` — pattern matching, confidence scoring, threshold gating, category detection

### Implementation

- [x] T004 [P] [US1] Create `src/engines/command-language/types.ts` — `Prefix`, `CommandCategory`, `ArgKind` (v2 with `ref`, `cron`, `duration`, `url`, `json`, `provider`), `ArgSpec`, `UnifiedCommandSpec`, `UnifiedLiveCommand`, `CommandContext`, `CommandResult`, `ParsedCommand`, `CommandIntent`, `CommandCombo`, `InterpretationState`, `DisclosureLevel`
- [x] T005 [P] [US1] Create `src/engines/command-language/parser.ts` — `parseInput(input: string): ParsedCommand` — detects prefix char, splits tokens, handles quoted strings, returns `{ prefix, command, rawArgs, tokens }`
- [x] T006 [P] [US1] Create `src/engines/command-language/resolver.ts` — `resolveCommand(parsed: ParsedCommand, ctx: CommandContext): UnifiedCommandSpec | null` — fuzzy match against registry, apply MRU + boost + namespace prefix scoring
- [x] T007 [P] [US7] Create `src/engines/command-language/nlp-matcher.ts` — `matchIntent(input: string, ctx: CommandContext): Promise<CommandIntent | null>` — query `CommandDescription` table, fuzzy match patterns, calculate confidence, return intent with category + color
- [x] T008 [US1] Add `CommandLanguageError` + `NlpMatchError` to `src/errors.ts` — codes: `UNKNOWN_PREFIX`, `UNKNOWN_COMMAND`, `MISSING_ARGS`, `INVALID_ARG`, `UNKNOWN_PROVIDER`, `CONTEXT_NOT_FOUND`, `CAPABILITY_NOT_FOUND`, `LOW_CONFIDENCE`, `COMBO_AMBIGUOUS`
- [x] T009 [US1] Run gate: `bun run typecheck && bun test tests/unit/engines/command-language && bun run lint`

**Checkpoint**: Parser + resolver + NLP matcher work. `/health` resolves. "switch to claude" detected as intent. Proceed ONLY if gate passes.

---

## Phase 2: DB Schema + Registry + All Spec Files (US1 + US4 + US5 + US8)

**Goal**: New `CommandDescription` Prisma model. Register all 8 prefix surfaces + full engine command surface. Seed NLP patterns from NLCL catalog.

**Independent Test**: All prefix commands appear in registry. `CommandDescription` table seeded with 200+ commands. `!health`, `@claude`, `#important`, `?help` all resolve.

### Tests (write FIRST)

- [x] T010 [P] [US1] Unit test `tests/unit/engines/command-language/registry.test.ts` — register commands, lookup by id, list by prefix, list by category, dedup by id
- [x] T011 [P] [US4] Unit test `tests/unit/engines/command-language/args.test.ts` — Zod validation, required/optional, context injection, suggestion stubs

### Implementation

- [x] T012 [P] [US8] Create Prisma migration for `CommandDescription` model — fields: id, commandId, description, patterns (JSON), category, prefix, confidence, enabled, timestamps. Add indexes on commandId, category, enabled.
- [x] T013 [P] [US1] Create `src/engines/command-language/registry.ts` — `CommandLanguageRegistry` class: `register(spec)`, `resolve(parsed, ctx)`, `listByPrefix(prefix)`, `listByCategory(cat)`, `getById(id)`, `getAll()`, `getMRU()`, `recordMRU(id)`
- [x] T014 [P] [US1] Create `src/engines/command-language/slash-specs.ts` — all 27 `/` commands (new, switch, list, search, send, draft, save, review, recall, tag, export, open, screenshot, health, providers, fleet, help, clear, focus, copy, undo, automate, moments, opencode, session, newsletter, schedule, background, theme, layout)
- [x] T015 [P] [US5] Create `src/engines/command-language/mention-specs.ts` — `@<provider>` for 6 providers + `@<email>` shorthand
- [x] T016 [P] [US1] Create `src/engines/command-language/tag-specs.ts` — `#<tag>` commands (tag, list, search)
- [x] T017 [P] [US4] Create `src/engines/command-language/devops-specs.ts` — all `!` commands (health, fleet, providers, caps, version, workspace, trace export/clear, config export/import, deploy, audit, gate, converge, invariants)
- [x] T018 [P] [US1] Create `src/engines/command-language/context-ref.ts` — `resolveContextRef(ref: string, ctx: CommandContext): string` — resolves `~last`, `~this`, `~msg:ID`, `~conv:ID`, `~file:path`
- [x] T019 [P] [US6] Create `src/engines/command-language/capability-specs.ts` — `$cap:<namespace>:<action>` parser + validation
- [x] T020 [P] [US1] Create `src/engines/command-language/discovery-specs.ts` — `?` prefix: `?help`, `?providers`, `?tags`, `?recent`, `?<query>`
- [x] T021 [US1] Create `src/engines/command-language/args.ts` — `validateArgs(spec: ArgSpec[], raw: Record<string, unknown>, ctx: CommandContext): Result<Record<string, unknown>, CommandLanguageError>` — Zod-based validation with context injection
- [x] T022 [US8] Create seed script `seeds/command-descriptions/seed.ts` — seed `CommandDescription` table from: (1) existing NLCL catalog patterns, (2) new prefix commands, (3) CLI builtins, (4) raw engine operations. Target: ~200 commands, ~600 patterns.
- [x] T023 [US8] Create store contracts: `src/storage/contracts/command-store.ts` (MRU persistence + command lookup) and `src/storage/contracts/command-description-store.ts` (NLP description + pattern lookup)
- [x] T024 [US8] Create store implementations: `src/storage/impl/command-store.ts` and `src/storage/impl/command-description-store.ts` — Prisma-backed
- [x] T025 [US1] Create `src/engines/command-language/index.ts` — barrel exports for all modules
- [x] T026 [US1] Run gate: `bun run typecheck && bun test tests/unit/engines/command-language && bun run lint`

**Checkpoint**: All 8 prefix surfaces registered. CommandDescription seeded. Store contracts in place. Proceed ONLY if gate passes.

---

## Phase 3: Color System + Combo Detection + Interpretation (US7 + US8)

**Goal**: Visual feedback layer — category→color→shades system, multi-command combo detection, progressive disclosure interpretation engine.

**Independent Test**: Type `/health` → prompt box turns Rose. Type "switch to claude and ask about rust" → interpretation shows "Switch to Claude → Ask about rust" with color-separated steps.

### Tests (write FIRST)

- [x] T027 [P] [US7] Unit test `tests/unit/engines/command-language/colors.test.ts` — shade generation, WCAG contrast, blended colors, all 12 categories
- [x] T028 [P] [US7] Unit test `tests/unit/engines/command-language/combo-detector.test.ts` — sequential vs parallel detection, dependency graph, ambiguity handling
- [x] T029 [P] [US7] Unit test `tests/unit/engines/command-language/interpretation.test.ts` — disclosure levels (L0-L3), expansion rules, dismissal, rendering config

### Implementation

- [x] T030 [P] [US7] Create `src/engines/command-language/colors.ts` — `CATEGORY_COLORS` map (12 categories × HSL), `getShade(category, shade)`, `getBlendedColor(categories[])`, `getContrastRatio(fg, bg)`. WCAG AA compliant.
- [x] T031 [P] [US7] Create `src/engines/command-language/combo-detector.ts` — `detectCombo(intents: CommandIntent[], ctx: CommandContext): CommandCombo` — analyze dependency graph between commands, determine sequential vs parallel, return ordered execution plan
- [x] T032 [P] [US7] Create `src/engines/command-language/interpretation.ts` — `InterpretationEngine` class: `render(intent: CommandIntent, level: DisclosureLevel): InterpretationState` — progressive disclosure from L0 (none) to L3 (full), configurable position, expansion rules, dismissal handling
- [x] T033 [US7] Wire combo detection into NLP matcher — when multiple intents detected, call `detectCombo` to decompose into execution plan
- [x] T034 [US7] Wire color mapping into interpretation engine — each intent carries category, interpretation engine calls `getShade` for rendering
- [x] T035 [US7] Run gate: `bun run typecheck && bun test tests/unit/engines/command-language && bun run lint`

**Checkpoint**: Colors render correctly. Combos decompose. Interpretation progresses. Proceed ONLY if gate passes.

---

## Phase 4: Autocomplete + API/CLI/UI Wiring (US1-US8)

**Goal**: Commands work across all surfaces. API endpoint accepts prefix + NLP commands. CLI REPL wires prefix commands. Composer UI supports color coding + interpretation rendering.

**Independent Test**: Type `/health` in CLI → response. Type `@claude hello` via API → response. Type "switch to claude" in UI → color changes + interpretation shows.

### Tests (write FIRST)

- [ ] T036 [P] [US1] Integration test `tests/integration/command-language/slash-command.test.ts` — `/health` end-to-end: parse → resolve → arg validate → capability execute
- [ ] T037 [P] [US5] Integration test `tests/integration/command-language/mention-command.test.ts` — `@claude` mention → provider resolution → prompt routing
- [ ] T038 [P] [US4] Integration test `tests/integration/command-language/devops-command.test.ts` — `!health` → capability → response formatting
- [ ] T039 [P] [US1] Integration test `tests/integration/command-language/prefix-nlcl-fallback.test.ts` — "/sw" resolves via prefix, "switch to claude" resolves via NLP
- [ ] T040 [P] [US7] Integration test `tests/integration/command-language/nlp-intent-detection.test.ts` — plain text → intent detection → color mapping → interpretation
- [ ] T041 [P] [US7] Integration test `tests/integration/command-language/combo-execution.test.ts` — combo detection → sequential/parallel execution → progress bar

### Implementation

- [x] T042 [US1] Create `src/engines/command-language/autocomplete.ts` — `AutocompleteEngine` class: `suggest(input: string, ctx: CommandContext): Promise<Suggestion[]>` — debounced 150ms, abort previous, limit 10 results, apply boost rules from spec §3.6
- [ ] T043 [US1] Wire `src/server/interpret-router.ts` — add prefix detection + NLP intent detection before NLCL fallback: if prefix char → `CommandLanguageEngine`, if plain text → `nlp-matcher`, else NLCL
- [ ] T044 [US4] Wire `src/cli/index.ts` — register prefix commands with `CommandRegistry` via `syncCliFromUnified()` pattern, ensure `/`, `@`, `#`, `!`, `~`, `$`, `?` work in CLI REPL
- [ ] T045 [US7] Wire `web/ui/src/ui/slots.ts` — add `palette` slot + `interpretation` slot for command palette and interpretation rendering
- [ ] T046 [US7] Wire `web/ui/src/features/chat/PromptBox.tsx` — add color coding (border color changes by category) + interpretation rendering (configurable position, progressive disclosure)
- [ ] T047 [US1] Wire `src/engines/capability-bootstrap.ts` — register command-language engine in boot sequence, initialize registry with all spec files, seed `CommandDescription` table
- [x] T048 [US7] Create `src/schema/command-description.ts` — Zod schema for `CommandDescription` validation (description, patterns JSON, category, prefix, confidence)
- [ ] T049 [US1] Run gate: `bun run typecheck && bun test tests/unit/engines/command-language && bun test tests/integration/command-language && bun run lint`

**Checkpoint**: Commands work across CLI, API, and UI. Colors render. Interpretations show. Combos execute. Proceed ONLY if gate passes.

---

## Phase 5: Polish + Verification (All Stories)

**Goal**: Full gate checklist passes. Cross-surface verification. Edge case hardening.

**Independent Test**: `bun run devops verify-cross-surface` passes. `bun test` passes. `bun run devops audit-code standard` returns 0 P0.

### Implementation

- [x] T050 [P] [US1] Run `bun run devops invariants check --category B` — confirm 0 violations
- [x] T051 [P] [US1] Run `bun run devops audit-code standard` — confirm 0 P0
- [x] T052 [P] [US1] Run `bun run devops verify-cross-surface` — all capabilities resolve
- [x] T053 [P] [US1] Run full test suite: `bun test` — all tests pass
- [x] T054 [US7] Edge case hardening: empty input, whitespace-only, unclosed quotes, unknown prefix chars, missing context for `~last`, invalid `$cap:` IDs, disconnected providers in `@` mentions, ambiguous combos, low-confidence NLP matches
- [x] T055 [US7] Performance optimization: NLP matcher cache (LRU, 1000 entries), autocomplete debounce tuning, color transition CSS animations, interpretation render budget < 16ms
- [x] T056 [US1] Update `CHANGELOG.md` with completed work
- [x] T057 [US1] Final gate: `bun run typecheck && bun test && bun run lint && bun run devops invariants check --category B && bun run devops audit-code standard && bun run devops verify-cross-surface`

---

## Dependencies & Execution Order

- **Phase 1** (T001-T009): No dependencies — foundational, BLOCKS all other phases
- **Phase 2** (T010-T026): Depends on Phase 1 — BLOCKS Phase 3 and Phase 4
- **Phase 3** (T027-T035): Depends on Phase 2 — colors/combos need registered commands + DB
- **Phase 4** (T036-T049): Depends on Phase 2 — integration needs registered commands. Can overlap with Phase 3.
- **Phase 5** (T050-T057): Depends on all previous phases — final verification

## Parallel Opportunities

- T001 + T002 + T003 (tests) can run in parallel
- T004 + T005 + T006 + T007 (types, parser, resolver, nlp-matcher) can run in parallel
- T010 + T011 (tests) can run in parallel
- T013 + T014 + T015 + T016 + T017 + T018 + T019 + T020 (all spec files) can run in parallel
- T023 + T024 (store contracts + impls) can run in parallel
- T027 + T028 + T029 (tests) can run in parallel
- T030 + T031 + T032 (colors, combo-detector, interpretation) can run in parallel
- T036 + T037 + T038 + T039 + T040 + T041 (integration tests) can run in parallel
- T050 + T051 + T052 + T053 (verification gates) can run in parallel

## Implementation Strategy — MVP First

1. Complete Phase 1: Type system + parser + resolver + NLP matcher → core routing works
2. Complete Phase 2: DB schema + registry + all spec files → all commands registered + NLP seeded
3. **STOP and VALIDATE**: Full gate checklist
4. Complete Phase 3: Color system + combo detection + interpretation → visual feedback
5. Complete Phase 4: Autocomplete + API/CLI/UI wiring → cross-surface
6. Complete Phase 5: Polish + verification → ship-ready

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to user story for traceability
- Each user story must be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Never bypass the gate checklist per unit/per phase/final
- Pre-existing LSP errors in `opencode-supervisor.ts`, `permission.test.ts`, `ingest.test.ts` are NOT caused by this feature — ignore them
- The `CommandDescription` model requires a Prisma migration — run `bunx prisma migrate dev` after schema change
- NLP seed script must run after migration — include in `bun run db:setup` or as standalone `bun run seed:commands`
