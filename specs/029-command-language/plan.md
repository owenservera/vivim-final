# Implementation Plan: Command Language (Enhanced)

**Branch**: `029-command-language` | **Date**: 2026-07-19 | **Spec**: `specs/029-command-language/spec.md`

**Input**: Feature specification from `specs/029-command-language/spec.md`

## Summary

Build a prefix-based command language engine with NLP intent detection, DB-backed command descriptions, color-coded prompt box, progressive live interpretation, and multi-command combo detection. The engine provides deterministic sub-100ms routing for prefixed input, probabilistic NLP matching for plain text, and real-time visual feedback via color and interpretation rendering. Ships as a new engine in the L2-L3 capability layer, integrated with the existing UnifiedCapabilityRegistry, NLCL catalog, CLI/API/UI surfaces, and a new `CommandDescription` Prisma model.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: Bun, Prisma v6.5, Zod, React 18
**Storage**: SQLite via Prisma (dev.db)
**Testing**: Bun test runner (`bun test`)
**Target Platform**: Windows (PowerShell 7+), Bun HTTP server
**Project Type**: Full-stack monorepo (backend engines + API + React frontend)
**Linter/Formatter**: Biome
**Build**: tsup (ESM + DTS)

**Performance Goals**: Prefix resolution < 100ms, NLP matching < 200ms, autocomplete < 50ms, color changes < 16ms
**Constraints**: Governor Canon (no CDP in engine), Store Contracts (no impl imports), One Entry Point (all commands via UnifiedCapability)

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- [x] Governor Canon: no engine imports BunCdpClient directly — command-language engine has no CDP dependency
- [x] Store Contracts: engines depend on contracts, not impls — will use `CommandStore` contract for MRU persistence + `CommandDescriptionStore` for NLP data
- [x] One Entry Point: new operations are UnifiedCapabilities — each command maps to a `capabilityId`
- [ ] Custom errors: no raw `new Error()` in engines — need `CommandLanguageError` + `NlpMatchError` in `src/errors.ts`
- [x] TypeScript strict: no `any`, `type` imports, `.js` extensions
- [ ] Tests: unit + integration + typecheck + lint gates — will add in Phase 3
- [ ] DB schema: new `CommandDescription` model — requires migration

## Project Structure

### Documentation (this feature)

```text
specs/029-command-language/
├── spec.md              # Feature specification (enhanced)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (new files)

```text
src/engines/command-language/
├── types.ts             # UnifiedCommandSpec, ArgSpec v2, CommandContext, CommandResult, CommandIntent, CommandCombo
├── parser.ts            # Prefix detection + token splitting
├── resolver.ts          # Fuzzy matching + MRU ranking + context boost
├── nlp-matcher.ts       # NLP intent detection (CommandDescription lookup + fuzzy + confidence)
├── combo-detector.ts    # Multi-command combo decomposition (sequential/parallel)
├── autocomplete.ts      # Live suggestion engine (debounced, abortable)
├── registry.ts          # Unified command registry (merges all sources)
├── args.ts              # Zod-based arg validation + context injection
├── colors.ts            # Category → primary → shades color system
├── interpretation.ts    # Progressive disclosure interpretation engine
├── slash-specs.ts       # `/` command definitions (27 commands)
├── mention-specs.ts     # `@` mention definitions (6 providers + email)
├── tag-specs.ts         # `#` tag command definitions
├── devops-specs.ts      # `!` system command definitions
├── context-ref.ts       # `~` reference resolution (~last, ~this, ~msg:ID)
├── capability-specs.ts  # `$cap:` direct invoke definitions
├── discovery-specs.ts   # `?` help/discovery definitions
└── index.ts             # Barrel exports

src/storage/contracts/
├── command-store.ts     # MRU persistence + command lookup
└── command-description-store.ts  # NLP description + pattern lookup

src/storage/impl/
├── command-store.ts     # Prisma-backed implementation
└── command-description-store.ts  # Prisma-backed implementation

src/schema/
└── command-description.ts  # Zod schema for CommandDescription validation
```

### Modified Files

```text
prisma/schema.prisma                      # Add CommandDescription model
src/errors.ts                              # Add CommandLanguageError, NlpMatchError
src/engines/capability-bootstrap.ts        # Register command-language commands + seed CommandDescription
src/engines/nlcl/catalog.ts               # Add prefix metadata to patterns
src/server/interpret-router.ts             # Accept prefix-commands + NLP intent via /api/interpret
src/cli/index.ts                           # Wire prefix commands to CLI REPL
web/ui/src/ui/slots.ts                     # Add palette + interpretation slots
web/ui/src/features/chat/PromptBox.tsx     # Add color coding + interpretation rendering (configurable)
```

### Tests

```text
tests/unit/engines/command-language/
├── parser.test.ts
├── resolver.test.ts
├── nlp-matcher.test.ts
├── combo-detector.test.ts
├── args.test.ts
├── context-ref.test.ts
├── autocomplete.test.ts
├── colors.test.ts
├── interpretation.test.ts
└── registry.test.ts

tests/integration/command-language/
├── slash-command.test.ts
├── mention-command.test.ts
├── devops-command.test.ts
├── prefix-nlcl-fallback.test.ts
├── nlp-intent-detection.test.ts
└── combo-execution.test.ts
```

**Structure Decision**: New engine directory under `src/engines/command-language/`. New Prisma model `CommandDescription` for NLP metadata. New store contracts for MRU + NLP data. Frontend changes limited to PromptBox color coding and interpretation rendering.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New Prisma model `CommandDescription` | NLP descriptions + patterns must be queryable and seedable | Seed-only approach loses runtime queryability and update capability |
| New store contracts (`CommandStore`, `CommandDescriptionStore`) | Engines must not import Prisma directly (Store Contracts invariant) | Direct Prisma import would violate constitution |
