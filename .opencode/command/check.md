---
description: Run full quality gate — typecheck, lint, and tests
agent: build
---

Run the complete quality check pipeline for vivim-final:

1. Type-check: `bun run typecheck`
2. Lint: `bun run lint`
3. Run all tests: `bun test`

If any step fails, stop and report the errors with file:line references.
If all pass, confirm "All quality gates passed."

For targeted checks, run individual steps and report each result separately.
