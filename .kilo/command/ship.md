---
description: Run pre-merge verification — typecheck + lint + tests + commit check
agent: build
---

Run the full ship pipeline for vivim-final. This is the final quality gate before merging.

1. Type-check: `bun run typecheck`
2. Lint: `bun run lint`
3. Format check: `bun run format`
4. Run all tests: `bun test`
5. Check git status: `git status --short`

If any step fails, STOP and report the failure with details.
If all pass, report:
- "All quality gates passed."
- List any uncommitted changes from step 5
- Confirm ready to ship
