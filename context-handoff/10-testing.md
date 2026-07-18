# Testing

## Test Structure
```
tests/
  unit/         # Individual function tests
  integration/  # Engine interactions (mocked stores)
  e2e/          # Full stack tests
```

## Running Tests
```bash
# Run all tests
bun test

# Run specific engine tests
bun test tests/unit/engines/memory-engine.test.ts

# Run integration tests
bun test tests/integration/
```

## Coverage Targets
- Unit tests: 80%+ per engine
- Integration tests: Engine-to-engine interactions
- E2E tests: Full capability execution flows

## Test Files (Unit)
- `tests/unit/engines/memory-engine.test.ts`
- `tests/unit/engines/harness-runtime.test.ts`
- `tests/unit/engines/mirror-engine.test.ts`
- `tests/unit/engines/selector-healer.test.ts`
- `tests/unit/engines/semantic-grounding.test.ts`
- `tests/unit/engines/observation-tap.test.ts`
- `tests/unit/engines/workflow-engine.test.ts`
- `tests/unit/engines/agentic-loop.test.ts`
- `tests/unit/engines/streaming-protocol.test.ts`

## Mocking Pattern
```typescript
// Mock store contracts
const mockStore = {
  get: vi.fn(),
  set: vi.fn(),
  // ... required methods
}
```

## Lint & TypeCheck
```bash
bun run typecheck  # tsc --noEmit
bun run lint       # biome check --apply
```