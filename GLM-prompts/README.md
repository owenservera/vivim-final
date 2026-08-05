# GLM Prompts: Backend-to-Frontend API Contract Fixes

## Overview

This directory contains **starting guides** for fixing API contract issues between the backend and frontend. Each prompt identifies **known issues** in a specific area but is **NOT comprehensive** — the agent must run its own audits to find all issues.

## Important Disclaimer

> **Each prompt is a starting point, not a complete audit.**
> The issues listed are examples found during initial inspection.
> The agent MUST:
> 1. Read the prompt to understand the area
> 2. Run comprehensive searches (`grep`, `read`, `glob`) to find ALL issues
> 3. Create a complete fix plan based on actual findings
> 4. Not assume the prompt covers everything

## Prompts

| # | Focus Area | Starting Point | Agent Must Audit |
|---|------------|----------------|------------------|
| 01 | Backend-Frontend API Contract | Type mismatches, response formats | All API routes, all frontend API calls |
| 02 | WebSocket Event Contract | Event type divergences | All WS handlers, all event consumers |
| 03 | Error Handling Standardization | Error format inconsistencies | All error paths, all error boundaries |
| 04 | Storage Contract Alignment | Row vs domain types, timestamps | All storage contracts, all data transformations |
| 05 | API Validation with Zod Schemas | Missing validation patterns | All request/response validation |

## How to Use These Prompts

### Step 1: Read the Prompt
Understand the focus area and known issues.

### Step 2: Run Your Own Audit
```bash
# Find all API routes
grep -r "/api/" src/server/ --include="*.ts"

# Find all frontend API calls
grep -r "fetch(" frontend/src/ --include="*.ts" --include="*.tsx"

# Find all WebSocket handlers
grep -r "ws.on" src/ --include="*.ts"

# Find all type definitions
grep -r "interface.*Response" src/schema/ frontend/src/types/
```

### Step 3: Create Comprehensive Fix Plan
Based on YOUR audit findings, not just the prompt examples.

### Step 4: Implement and Verify
```bash
bun run typecheck
bun run lint
bun test
```

## Common Pitfalls

1. **Don't assume the prompt is complete** — it's a starting point
2. **Don't skip the audit** — run your own searches
3. **Don't assume types match** — verify with actual code
4. **Don't ignore edge cases** — handle null, undefined, empty arrays
5. **Don't forget error handling** — every API call can fail

## File Structure

```
GLM-prompts/
├── README.md                           # This file
├── 01-backend-frontend-api-contract-fix.md
├── 02-websocket-event-contract-fix.md
├── 03-error-handling-standardization.md
├── 04-storage-contract-alignment.md
└── 05-api-validation-zod-schemas.md
```

## Contributing

When adding new prompts:
1. Focus on one area
2. List **example** issues (not all issues)
3. Include audit commands for the agent to run
4. Emphasize that the agent must do their own comprehensive audit
