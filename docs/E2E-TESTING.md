# E2E Testing Documentation — vivim-final Frontend

**Last Updated:** 2026-07-24  
**Status:** 12/12 tests passing ✅  
**Framework:** Playwright with @playwright/test  
**Base URL:** `http://localhost:3000` (frontend dev server)  
**API Base:** `http://localhost:9420` (backend server)

---

## Quick Start

```bash
# Install dependencies (once)
cd frontend && bun add -D @playwright/test playwright
bunx playwright install chromium

# Run all E2E tests
bunx playwright test tests/e2e/

# Run specific test file
bunx playwright test tests/e2e/canvas-native.spec.ts

# Run with UI mode
bunx playwright test --ui

# Run headed (visible browser)
bunx playwright test --headed

# Debug mode
bunx playwright test --debug
```

---

## Test Suites

### 1. Canvas-Native Frontend (`canvas-native.spec.ts`)

**Location:** `frontend/tests/e2e/canvas-native.spec.ts`  
**Status:** 12/12 passing ✅  
**Duration:** ~17s

#### Test Categories

| Test | Type | Description |
|------|------|-------------|
| `loads canvas as primary surface (no tabs)` | UI | Verifies canvas is primary surface, no surface tabs |
| `sidebar toggles with Ctrl+B` | Keyboard | Sidebar collapses/expands via Ctrl+B |
| `command palette opens with Ctrl+K` | Keyboard | Palette opens via Ctrl+K |
| `dev console toggles with Ctrl+\`` | Keyboard | Dev console appears via Ctrl+\` |
| `sidebar shows variant input` | UI | Variant input field visible in sidebar |
| `sidebar shows providers section` | UI | Providers section renders in sidebar |
| `sidebar toggle button exists` | UI | Toggle button with Ctrl+B tooltip |
| `agent canvas plan endpoint returns plan` | API | POST /api/agent/canvas/plan returns valid plan |
| `agent canvas command endpoint creates node` | API | POST /api/agent/canvas/command creates node |
| `agent canvas policy CRUD` | API | GET/PUT /api/agent/canvas/policy works |
| `nlcl/interpret classifies canvas commands` | API | NLCL interprets canvas prompts |
| `nlcl/commands lists canvas capabilities` | API | NLCL lists canvas capabilities |

---

## Running Instructions

### Prerequisites

1. **Backend server running** on `http://localhost:9420`
   ```bash
   cd C:\0-BlackBoxProject-0\vivim-final
   bun run src/cli/index.ts serve
   ```

2. **Frontend dev server** on `http://localhost:3000`
   ```bash
   cd C:\0-BlackBoxProject-0\vivim-final\frontend
   bun run dev
   ```

### Run All E2E Tests

```bash
cd frontend
bunx playwright test tests/e2e/
```

### Run Specific Test Categories

```bash
# UI-only tests (no API)
bunx playwright test tests/e2e/canvas-native.spec.ts -g "Canvas-Native Frontend"

# API-only tests
bunx playwright test tests/e2e/canvas-native.spec.ts -g "Agent-Canvas Commands|NLCL"

# Keyboard shortcuts
bunx playwright test tests/e2e/canvas-native.spec.ts -g "Ctrl"
```

---

## Test Results Summary

```
Running 12 tests using 4 workers
12 passed (14-17s)

Test Breakdown:
✅ 5 UI/Keyboard tests (Canvas-Native Frontend)
✅ 3 Agent-Canvas API tests
✅ 2 NLCL API tests
✅ 2 UI validation tests
```

---

## CI/CD Integration

### GitHub Actions Workflow

File: `.github/workflows/ci.yml`

```yaml
e2e:
  runs-on: ubuntu-latest
  needs: test
  if: false  # Enable when Playwright configured

  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v1
    - name: Install
      run: cd frontend && bun install
    - name: Install Playwright
      run: cd frontend && bunx playwright install --with-deps chromium
    - name: Start Backend
      run: cd .. && bun run src/server/index.ts &
      sleep 10
    - name: Start Frontend
      run: cd frontend && bun run build && bun run start &
      sleep 10
    - name: Run E2E Tests
      run: cd frontend && bunx playwright test tests/e2e/
    - name: Upload Screenshots
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-screenshots
        path: frontend/test-results/
```

---

## Test Maintenance

### Adding New Tests

```typescript
// tests/e2e/new-feature.spec.ts
import { test, expect } from '@playwright/test';

test.describe('New Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('aside', { timeout: 15000 });
  });

  test('feature works', async ({ page }) => {
    // Test implementation
  });
});
```

### Debugging Failures

```bash
# View trace
bunx playwright show-trace test-results/<test-name>/trace.zip

# View screenshot
open test-results/<test-name>/screenshot.png

# Run headed for visual debugging
bunx playwright test --headed
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `TimeoutError` waiting for selector | Increase timeout: `await page.waitForSelector('selector', { timeout: 30000 })` |
| `Not found` errors | Check if backend/frontend servers are running |
| Keyboard shortcuts not working | Ensure page has focus: `await page.focus('body')` before keyboard press |
| Flaky tests | Add `await page.waitForTimeout(300)` after actions |

---

## Test Coverage Goals

| Area | Current | Target |
|------|---------|--------|
| Canvas-Native UI | 5 tests | 8 tests |
| Agent-Canvas Commands | 3 tests | 8 tests |
| NLCL Integration | 2 tests | 5 tests |
| Streaming/StreamingNodeWrapper | 0 tests | 5 tests |
| Layout/Node Drag | 0 tests | 3 tests |

---

*Generated: 2026-07-24*  
*Run `bunx playwright test tests/e2e/ --reporter=line` for latest results*