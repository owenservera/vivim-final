# Unit 11.7: Slave Read

**Phase:** 11 | **File:** `src/executor/slave-read.ts`
**Depends:** 11.1 CDP Client | **Produces:** CDP-based DOM read/screenshot operations
**Source:** vivim-final `src/executor/slave-read.ts` (67 lines, port to vivim-final)

## Purpose
High-level CDP operations for reading browser state: getting page content, extracting DOM elements, reading attributes, and capturing screenshots.

## Interface
```typescript
export class SlaveRead {
  constructor(private cdp: BunCdpClient) {}

  async getText(selector: string): Promise<string>;
  async getHtml(selector?: string): Promise<string>;
  async getAttribute(selector: string, attr: string): Promise<string | null>;
  async getUrl(): Promise<string>;
  async getTitle(): Promise<string>;
  async isVisible(selector: string): Promise<boolean>;
  async getElementCount(selector: string): Promise<number>;
  async getConsoleLogs(): Promise<Array<{ level: string; text: string }>>;
  async screenshot(selector?: string, opts?: { format?: 'png' | 'jpeg'; quality?: number }): Promise<Buffer>;
}

export class SlaveReadError extends Error {}
```

## Required Capabilities
- `getText()`: evaluate `document.querySelector(selector)?.textContent`
- `getHtml()`: evaluate `document.querySelector(selector)?.innerHTML`
- `getAttribute()`: evaluate `document.querySelector(selector)?.getAttribute(attr)`
- `getUrl()`: evaluate `window.location.href`
- `getTitle()`: evaluate `document.title`
- `isVisible()`: check element visibility via getBoundingClientRect
- `getElementCount()`: evaluate `document.querySelectorAll(selector).length`
- `getConsoleLogs()`: return captured console entries
- `screenshot()`: full page or element screenshot via CDP

## Tests
- [ ] `getUrl()` returns current URL (requires browser)
- [ ] `getTitle()` returns page title (requires browser)
- [ ] `getText('body')` returns body text (requires browser)
- [ ] `isVisible('body')` returns true (requires browser)

## Gate
- `bun run typecheck` passes
- `bun test tests/unit/executor/slave-read.test.ts` passes

## Port Notes
Port from vivim-final `src/executor/slave-read.ts`. Adapt to vivim-final's `BunCdpClient`.
