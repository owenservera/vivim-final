---
description: Create a new engine in the vivim-final project following spec conventions
agent: build
---

Create a new engine for the vivim-final project.

Engine name: $ARGUMENTS

Steps:
1. Read the engine spec from `docs/merged-design-v2/04-merged-engines.md` or `05-merged-lifecycles.md`
2. Create `src/engines/$ARGUMENTS.ts` with:
   - TypeScript interface matching the spec exactly
   - Store Contract type (what the engine needs from storage)
   - Implementation with proper error handling
   - Export from `src/engines/index.ts`
3. Create `tests/unit/engines/$ARGUMENTS.test.ts` with:
   - Mock store contract
   - Unit tests for each public method
   - Edge case coverage
4. Create `tests/integration/engines/$ARGUMENTS.test.ts` with:
   - Engine-to-engine interaction tests
   - Event bus integration tests
5. Run `bun test tests/unit/engines/$ARGUMENTS` to verify
6. Run `bun run typecheck` to verify types

If no engine name provided, ask for one.
Reference the spec document for exact interface definitions.
