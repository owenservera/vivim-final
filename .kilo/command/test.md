---
description: Run tests with optional filter
agent: test
---

Run tests for the vivim-final project.

Filter: $ARGUMENTS

If a filter is provided:
- If it matches a file path: `bun test $ARGUMENTS`
- If it matches an engine name: `bun test tests/unit/engines/$ARGUMENTS`
- Otherwise: `bun test --grep "$ARGUMENTS"`

If no filter provided: `bun test`

After tests complete, report:
- Total passed/failed/skipped
- Any flaky tests
- Coverage summary if available
