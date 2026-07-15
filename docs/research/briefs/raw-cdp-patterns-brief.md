# Raw CDP Patterns Brief

**Source:** SOC-AI browser automation evolution research + web findings
**Confidence:** High | **Sources:** 6 | **Date:** 2026-07-12

## TL;DR

Raw CDP (Chrome DevTools Protocol) over WebSocket provides the thinnest possible automation surface. Two architectural camps exist: Playwright-wrappers (browser-use, Stagehand) vs CDP-direct (agent-browser, Veil, cdp-browser). vivim-final's ChromeGovernor follows CDP-direct approach — giving agents direct control without abstraction overhead. Key patterns: flat session mode, per-slave mutex, atomic command execution, and avoid `Runtime.enable` (detectable).

## Key Decisions

1. **CDP-direct over Playwright-wrappers** — vivim-final uses ChromeGovernor.CDPProxy for direct protocol access; no Puppeteer/Playwright dependency needed
2. **Flat session mode** — Connect once to target tab, reuse session for multiple commands; eliminates page-load reattachment costs
3. **Per-slave concurrency control** — Each Chrome slave gets its own AsyncMutex; parallel sends to DIFFERENT slaves OK, SAME slave serializes
4. **Atomic command execution** — One CDP command per harness step; Chrome's event loop remains free between commands
5. **Avoid `Runtime.enable`** — Primary CDP detection vector; many commands work without enabling runtime domain

## Evidence Summary

- **SOC-AI evolution (May 2026):** Bifurcation into Playwright-wrappers vs CDP-direct camp; CDP-direct chosen for agent use cases (source: socai-io/browser-automation-evolution.md)
- **Veil (April 2026):** 57/57 sannysoft stealth score, raw WebSocket CDP, zero runtime dependencies, auto-Xvfb for headful on servers (source: veilbrowser)
- **cdp-browser:** Lightweight CLI for agents, uses native WebSocket (Node 22+/Bun built-in), no `ws` dependency (source: sids/cdp-browser)
- **agent-browser (Vercel):** Detached daemon pattern; Bun.WebView abstraction with `view.cdp()` method (source: oven-sh/bun WebView.cdp)
- **browser-harness:** Real Chrome attachment pattern; inherits logged-in sessions instead of fresh Chromium (source: socai-io/browser-harness)
- **HTEK.dev:** Raw CDP for viewport control fixes Playwright sizing issues; 120 lines of CDP transport without abstraction overhead (source: I Replaced Playwright With Raw CDP)

## Key Patterns

### Pattern A: Detached Daemon (Vercel agent-browser)
- Launch Chrome with `--remote-debugging-port`
- Agent connects via WebSocket when needed
- Chrome lifetime independent of agent

### Pattern B: Attach to Existing Chrome (browser-harness)
- Attach to user's daily-driver Chrome
- Inherits logged-in sessions
- No fresh Chromium spawn overhead

### Pattern C: In-Process via Bun.WebView (vivim-final)
- `Bun.WebView({ backend: "chrome" })` manages Chrome lifecycle
- `view.cdp(domain.method, params)` for atomic commands
- Governor owns ALL Chrome interaction (Canon invariant)

## Implementation Notes

```typescript
// ChromeGovernor.CDPProxy pattern (vivim-final)
class CDPProxy {
  async send<T>(method: string, params: unknown): Promise<T> {
    // Per-slave mutex ensures serialization per slave
    const result = await this.session.send(method, params);
    return result;
  }
  
  async capture(slaveId: string, pattern: string, timeout: number) {
    // Network.enable + getResponseBody for response capture
    await this.send("Network.enable", {});
    // ... wait + getResponseBody
  }
  
  async executeHarnessPlan(slaveId: string, dag: HarnessDAG) {
    // Iterate DAG steps, send one atomic CDP command per step
    for (const node of dag.nodes) {
      await this.send(node.method, node.params);
    }
  }
}
```

## Used In

- ChromeGovernor.CDPProxy (src/engines/chrome-governor.ts)
- HarnessRuntime DAG executor (design docs: harness-runtime)
- SelectorHealer (SOTA-05) — raw CDP for element interaction
- Anti-detection stealth (SOTA-05) — script injection before page load