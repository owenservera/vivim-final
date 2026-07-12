# M-001: App Launch

**Phase:** 100 (User-Centric Frontend)
**Depends:** 90.8 (Sandbox MVP)
**Status:** PARTIAL (exists, needs enhancement)

## User Story

> As a user, I want to open the app and see what it can do.

## Moment Definition

**Entry State:** User navigates to `http://localhost:5173`
**Exit State:** Sandbox loaded, catalog visible, ready for interaction

## Visual State

```
┌─────────────────────────────────────────────────────┐
│ Vivim Sandbox                    [Provider ▾] [⚙]  │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ Capabilities    │  Select a capability from the     │
│          │      │  catalog to begin.                │
│ ├ Claude │      │                                   │
│ ├ ChatGPT│      │                                   │
│ └ Gemini │      │                                   │
│          │      │                                   │
└──────────┴──────────────────────────────────────────┘
```

## Component Spec

### SandboxApp (existing)
```tsx
// web/sandbox/src/app/sandbox-app.tsx
// Already implements:
// - ProviderSetupWizard (first run)
// - CapabilityCatalog (sidebar)
// - CapabilityHarness (main area)
```

### Enhancements Needed
1. Add `ProviderSelector` to header
2. Add `FleetStatusBar` to header
3. Add `ConversationList` to sidebar (100.1)

## Store Contract

```typescript
// Already exists: useCapabilityStore
// Needs: useConversationStore (for conversation list)
// Needs: useProviderStore (for provider selection)
```

## API Calls

```
GET /api/providers          → ProviderSummary[]
GET /api/fleet/status       → ChromeSlave[] (for fleet status)
```

## Test Scenario

```typescript
// tests/e2e/moments/m-001-app-launch.test.ts
test('M-001: App launches and shows catalog', async ({ page }) => {
  await page.goto('http://localhost:5173')
  
  // Header visible
  await expect(page.locator('h1')).toContainText('Vivim Sandbox')
  
  // Catalog loads
  await expect(page.locator('[data-testid="capability-catalog"]')).toBeVisible()
  
  // At least one capability listed
  const items = page.locator('[data-testid="capability-item"]')
  await expect(items).toHaveCount.greaterThan(0)
})
```

## Gate Criteria

- [ ] Sandbox boots without console errors
- [ ] Catalog renders with capabilities from DB
- [ ] Header shows provider selector placeholder
- [ ] `bun run typecheck` passes

---

*This moment is the entry point for the entire user journey.*
