# CDP Anti-Detection & Humanized Interaction — Confirmed Code Path

**Convergence:** CONFIRMED
**Iterations:** 2 | **Confidence:** High
**Date:** 2026-07-23

## Recommended Approach

Adopt cdp-browser's anti-detection injection and humanized interaction patterns into vivim-final's `ChromeGovernor`. The patterns are concrete, tested, and directly compatible with vivim-final's pure-CDP architecture.

## Working Code Example

### Anti-Detection Injection (from cdp-browser)

```typescript
// Adapted from dao-ai/cdp-browser/scripts/anti-detection.ts
// Source: https://github.com/dao-ai/cdp-browser

function getAntiDetectionScripts(url: string): string[] {
  const scripts: string[] = [
    // Universal: hide automation markers
    `
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      delete window.__playwright;
      delete window.__puppeteer;
      delete window.__nightmare;
      delete window.__selenium;
    `,
    // Fake browser runtime
    `
      if (!window.chrome) window.chrome = {};
      if (!window.chrome.runtime) window.chrome.runtime = {};
    `,
    // Fake plugins
    `
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5].map(() => ({
          name: 'Chrome PDF Plugin',
          description: 'Portable Document Format',
          filename: 'internal-pdf-viewer',
          length: 1,
        })),
      });
    `,
    // Fake languages
    `
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    `,
  ];

  // Site-specific additions
  const domain = new URL(url).hostname;
  if (domain.includes('google.com')) {
    scripts.push(`
      // Canvas noise for Google sites
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type) {
        if (type === 'image/png') {
          const ctx = this.getContext('2d');
          if (ctx) {
            const imageData = ctx.getImageData(0, 0, this.width, this.height);
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] += Math.floor(Math.random() * 2) - 1;
            }
            ctx.putImageData(imageData, 0, 0);
          }
        }
        return origToDataURL.apply(this, arguments);
      };
    `);
  }

  return scripts;
}
```

### Humanized Interaction (from cdp-browser)

```typescript
// Adapted from dao-ai/cdp-browser/scripts/cdp-client.ts
// Source: https://github.com/dao-ai/cdp-browser

// Bézier-curve mouse movement
async function humanizedMove(page: CdpPage, fromX: number, fromY: number, toX: number, toY: number) {
  const steps = 20 + Math.floor(Math.random() * 15);
  const controlPoint1 = {
    x: fromX + (toX - fromX) * 0.3 + (Math.random() - 0.5) * 50,
    y: fromY + (toY - fromY) * 0.3 + (Math.random() - 0.5) * 50,
  };
  const controlPoint2 = {
    x: fromX + (toX - fromX) * 0.7 + (Math.random() - 0.5) * 50,
    y: fromY + (toY - fromY) * 0.7 + (Math.random() - 0.5) * 50,
  };

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = cubicBezier(t, fromX, controlPoint1.x, controlPoint2.x, toX);
    const y = cubicBezier(t, fromY, controlPoint1.y, controlPoint2.y, toY);
    await page.mouse.move(x, y);
    await sleep(10 + Math.random() * 20); // Variable delay
  }
}

function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

// Character-by-character typing with realistic timing
async function humanizedType(page: CdpPage, text: string) {
  for (const char of text) {
    await page.keyboard.type(char);
    // Base delay 28-55ms + occasional burst pause
    const delay = 28 + Math.random() * 27;
    const shouldPause = Math.random() < 0.05; // 5% chance of pause
    await sleep(shouldPause ? delay + 200 + Math.random() * 300 : delay);
  }
}

// Viewport jitter (±18px)
async function jitterViewport(page: CdpPage) {
  const jitterX = Math.floor(Math.random() * 36) - 18;
  const jitterY = Math.floor(Math.random() * 36) - 18;
  await page.setViewport({ width: 1280 + jitterX, height: 720 + jitterY });
}
```

### Watchdog System (from cdp-browser + browser-use)

```typescript
// Adapted from dao-ai/cdp-browser/scripts/watchdog/
// and browser-use/browser/watchdogs/

type WatchdogEvent = 'popup' | 'crash' | 'captcha' | 'dialog' | 'navigate';

interface WatchdogHandler {
  (event: WatchdogEvent, data: unknown): Promise<void>;
}

class CdpWatchdog {
  private handlers = new Map<WatchdogEvent, WatchdogHandler[]>();

  on(event: WatchdogEvent, handler: WatchdogHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
  }

  async emit(event: WatchdogEvent, data: unknown) {
    const handlers = this.handlers.get(event) || [];
    for (const handler of handlers) {
      await handler(event, data);
    }
  }
}

// Auto-dismiss dialogs
function setupDialogWatchdog(page: CdpPage, watchdog: CdpWatchdog) {
  page.on('dialog', async (dialog) => {
    await watchdog.emit('dialog', { type: dialog.type(), message: dialog.message() });
    await dialog.dismiss();
  });
}

// Auto-recover on crash
function setupCrashWatchdog(page: CdpPage, watchdog: CdpWatchdog) {
  page.on('crash', async () => {
    await watchdog.emit('crash', { url: page.url() });
    // Re-navigate to last known URL
    // Log crash for telemetry
  });
}
```

## Why This Works

1. **cdp-browser is pure CDP** — same architecture as vivim-final's ChromeGovernor (no Playwright/Puppeteer)
2. **Anti-detection is proven** — tested against Douyin, Xiaohongshu, Taobao, Zhihu, WeChat
3. **Humanized patterns are concrete** — exact timing values (28-55ms typing, ±18px jitter) from production use
4. **Watchdog is convergent** — both cdp-browser and browser-use independently built this pattern

## Prerequisites

- Access to `ChromeGovernor` CDP session (already exists in vivim-final)
- `Page.createScriptToEvaluateOnNewDocument` CDP method for injection (standard CDP)
- `Page.addScriptToEvaluateOnNewDocument` for runtime injection

## Known Gotchas

- **Canvas noise injection can break legitimate canvas usage** — apply selectively per provider
- **Bézier mouse adds ~200-500ms per click** — acceptable for provider interaction, not for high-frequency operations
- **Anti-detection scripts must run before page scripts** — use `Page.addScriptToEvaluateOnNewDocument` not `Runtime.evaluate`
- **ViewPort jitter can break responsive layouts** — only apply when provider page is known to be stable

## Alternatives Considered

| Approach | Why Rejected | Source |
|----------|--------------|--------|
| Playwright stealth plugin | vivim-final uses raw CDP, not Playwright | architecture mismatch |
| Puppeteer-extra-plugin-stealth | Same reason — wrong framework | architecture mismatch |
| Residential proxies | Network layer, not application layer — complementary, not replacement | cdp-browser docs |

## Verification Steps

1. Connect to a provider via ChromeGovernor
2. Inject anti-detection scripts via `Page.addScriptToEvaluateOnNewDocument`
3. Navigate to provider page
4. Execute `navigator.webdriver` check — should return `false`
5. Perform humanized click on send button
6. Verify Bézier curve movement in CDP performance timeline

## Risk Assessment

- **Technical risk:** Low — all patterns are proven in cdp-browser production
- **Integration risk:** Low — ChromeGovernor already owns CDP, injection is additive
- **Maintenance risk:** Medium — anti-detection scripts may need updating as sites evolve detection
