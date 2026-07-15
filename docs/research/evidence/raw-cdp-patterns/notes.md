# Raw CDP Patterns — Evidence Notes

## Two Architectural Camps (SOC-AI, 2026)

### Playwright-Wrappers
- **Frameworks:** browser-use, Stagehand
- **Approach:** Inherit Playwright's auto-wait, locators, multi-target coordination
- **Tradeoff:** Launch cost (fresh Chromium) + Node runtime

### CDP-Direct
- **Frameworks:** agent-browser (Vercel), browser-harness, Veil, cdp-browser
- **Approach:** Build own primitives, get predictability + smaller footprint
- **Tradeoff:** DIY anti-detection, no auto-wait

## Key Patterns

### Pattern A: Detached Daemon (Vercel agent-browser)
- Chrome lifetime independent of agent
- Launch with `--remote-debugging-port`
- Agent connects via WebSocket

### Pattern B: Attach to Existing Chrome (browser-harness)
- Inherit logged-in sessions
- No fresh Chromium spawn
- Pitch: "every site you're logged into is immediately accessible"

### Pattern C: In-Process via Bun.WebView (vivim-final)
- `Bun.WebView({ backend: "chrome" })` manages lifecycle
- Governor owns ALL Chrome interaction (Canon invariant)
- No other engine imports BunCdpClient

## Detection Avoidance (Veil, 2026)

- Never call `Runtime.enable` — primary CDP detection vector
- Use `--disable-blink-features=AutomationControlled` to flip `navigator.webdriver` to false
- Inject stealth script via `Page.addScriptToEvaluateOnNewDocument` before page load
- Normalize UA + client hints (strip "HeadlessChrome" token)
- Human input dynamics: curved mouse paths, jittered keystroke timing, random delays

## Concurrency Control

- Per-slave AsyncMutex in ChromeGovernor
- Parallel sends to different slaves OK
- Two sends to same slave serialize

## Sources
1. SOC-AI browser automation evolution — Bifurcation into camps
2. Veil browser — Zero-dep CDP runtime, stealth patches
3. cdp-browser — Lightweight CLI for agents, native WebSocket
4. agent-browser (Vercel) — Bun.WebView abstraction
5. browser-harness — Real Chrome attachment pattern
6. HTek.dev — Raw CDP vs Playwright for viewport control