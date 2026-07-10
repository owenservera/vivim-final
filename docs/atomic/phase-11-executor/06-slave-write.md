# Unit 11.6: Slave Write

**Phase:** 11 | **File:** `src/executor/slave-write.ts`
**Depends:** 11.1 CDP Client | **Produces:** CDP-based type/click/navigate operations
**Source:** vivim-final `src/executor/slave-write.ts` (87 lines, port to vivim-final)

## Purpose
High-level CDP operations for browser interaction: typing text, clicking elements, navigating to URLs, and evaluating JavaScript. Wraps raw CDP commands into convenient methods.

## Interface
```typescript
export class SlaveWrite {
  constructor(private cdp: BunCdpClient) {}

  async type(selector: string, text: string, opts?: { delayMs?: number; clearFirst?: boolean }): Promise<void>;
  async click(selector: string): Promise<void>;
  async navigate(url: string): Promise<void>;
  async evaluate(expression: string): Promise<unknown>;
  async focus(selector: string): Promise<void>;
  async select(selector: string, value: string): Promise<void>;
  async scrollTo(selector: string): Promise<void>;
  async screenshot(opts?: { format?: 'png' | 'jpeg'; quality?: number }): Promise<Buffer>;
}

export class SlaveWriteError extends Error {}
```

## Required Capabilities
- `type()`: focus element, optionally clear, type text character-by-character or whole
- `click()`: find element by selector, scroll into view, click
- `navigate()`: Page.navigate CDP command, wait for page load
- `evaluate()`: Runtime.evaluate CDP command
- `focus()`: DOM.focus CDP command
- `select()`: set select/option value
- `scrollTo()`: scroll element into view
- `screenshot()`: Page.captureScreenshot CDP command

## Tests
- [ ] `type('#input', 'hello')` types text into input (requires browser)
- [ ] `click('#button')` clicks element (requires browser)
- [ ] `navigate('about:blank')` navigates to URL (requires browser)
- [ ] `evaluate('1+1')` returns 2 (requires browser)

## Gate
- `bun run typecheck` passes
- `bun test tests/unit/executor/slave-write.test.ts` passes

## Port Notes
Port from vivim-final `src/executor/slave-write.ts`. Adapt to use vivim-final's `BunCdpClient` type. Use vivim-final's error classes.
