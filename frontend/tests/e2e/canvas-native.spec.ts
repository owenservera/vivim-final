import { test, expect } from '@playwright/test';

test.describe('Canvas-Native Frontend', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for page to load - wait for sidebar or header
    await page.waitForSelector('aside', { timeout: 15000 });
  });

  test('loads canvas as primary surface (no tabs)', async ({ page }) => {
    // Header should be visible
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Sidebar should be visible
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Main area should exist (showing "Resolving canvas..." or canvas content)
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('sidebar toggles with Ctrl+B', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Toggle sidebar with Ctrl+B
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(300);

    // Sidebar should be hidden
    await expect(sidebar).toBeHidden();

    // Toggle back
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(300);
    await expect(sidebar).toBeVisible();
  });

  test('command palette opens with Ctrl+K', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);

    // Command palette should appear
    const palette = page.locator('[data-command-palette="true"]');
    await expect(palette).toBeVisible();
  });

  test('dev console toggles with Ctrl+`', async ({ page }) => {
    await page.keyboard.press('Control+`');
    await page.waitForTimeout(300);

    // Dev console should appear
    const devConsole = page.locator('[data-dev-console="true"]');
    await expect(devConsole).toBeVisible();
  });

  test('sidebar shows variant input', async ({ page }) => {
    const variantInput = page.locator('input[placeholder="opus, voice"]');
    await expect(variantInput).toBeVisible();
  });

  test('sidebar shows providers section', async ({ page }) => {
    const providersSection = page.locator('section:has-text("Providers")');
    await expect(providersSection).toBeVisible();
  });

  test('sidebar toggle button exists', async ({ page }) => {
    const sidebarToggle = page.locator('button[title="Toggle sidebar (Ctrl+B)"]');
    await expect(sidebarToggle).toBeVisible();
  });
});

test.describe('Agent-Canvas Commands', () => {
  test('agent canvas plan endpoint returns plan', async ({ request }) => {
    const response = await request.post('http://localhost:9420/api/agent/canvas/plan', {
      data: { prompt: 'create a competitive analysis layout' },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.plan).toBeDefined();
    expect(body.plan.ops.length).toBeGreaterThan(0);
  });

  test('agent canvas command endpoint creates node', async ({ request }) => {
    const response = await request.post('http://localhost:9420/api/agent/canvas/command', {
      data: {
        agentId: 'agent:test',
        workspaceId: 'ws:test',
        command: { type: 'canvas.createNode', payload: { slotId: 'chat.thread' } },
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.type).toBe('canvas.nodeCreated');
  });

  test('agent canvas policy CRUD', async ({ request }) => {
    // GET default policy
    const getResponse = await request.get('http://localhost:9420/api/agent/canvas/policy?agentId=agent:test&workspaceId=ws:test');
    expect(getResponse.ok()).toBeTruthy();

    // PUT update policy
    const putResponse = await request.put('http://localhost:9420/api/agent/canvas/policy', {
      data: {
        agentId: 'agent:test',
        workspaceId: 'ws:test',
        policy: { maxConcurrentStreams: 5 },
      },
    });
    expect(putResponse.ok()).toBeTruthy();
  });
});

test.describe('NLCL Interpretation', () => {
  test('nlcl/interpret classifies canvas commands', async ({ request }) => {
    const response = await request.post('http://localhost:9420/api/nlcl/interpret', {
      data: { input: 'create a competitive analysis layout' },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.intent).toBeDefined();
  });

  test('nlcl/commands lists canvas capabilities', async ({ request }) => {
    const response = await request.get('http://localhost:9420/api/nlcl/commands');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    const canvasCommands = body.commands.filter((c: any) => c.category === 'canvas');
    expect(canvasCommands.length).toBeGreaterThan(0);
  });
});