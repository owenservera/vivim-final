# Bento & Similar Projects: Harvest Analysis Report
*Generated: 2026-07-23 | Sources: 14 | Confidence: High*

## Executive Summary

Research into `nyblnet/bento` (706★) and similar projects (`dao-ai/cdp-browser`, `browser-use`, `stagehand`, `skyvern`) reveals **no direct code-lift candidates** for vivim-final's CDP-based provider automation — but several **architectural patterns** and **anti-detection strategies** are directly harvestable. The most valuable findings are from `cdp-browser` (anti-detection injection, humanized interaction, watchdog systems) and `browser-use` (DOM-to-LLM state pipeline, event-driven browser control, context compaction).

## 1. nyblnet/bento — Single-File Office Suite

**What it is:** A PowerPoint alternative where the entire editor + viewer + presenter lives inside a single `.bento.html` file. 706★, MIT, TypeScript.

**What to harvest:**

### 1a. Self-Contained Architecture Pattern
- One HTML file = document + viewer + editor + presenter
- The file saves *itself* via File System Access API (TiddlyWiki trick modernized)
- JSON data block stays plaintext at top of file; runtime is DEFLATE-compressed below
- **Relevance to vivim-final:** The "file-as-software" pattern could apply to provider manifest packages — a single `.provider.html` file that contains the manifest, parser logic, and a test harness, all self-contained.

### 1b. In-House CRDT for Collaboration
- Custom op-based CRDT (`sync/crdt.ts`) with per-property LWW registers
- Element identity = composite `slideId U+001F elementId` (cross-slide morph idiom)
- Fractional index ordering, dead-window value stash, token RGA for text
- Fuzz-tested with hundreds of thousands of convergence checks
- **Relevance:** vivim-final's NodeLayer v2 already has NodeVersion. Bento's CRDT approach (composite keys for per-slide copies, dead-window stash) could inform conflict resolution in the universal node graph.

### 1c. Signed Self-Update Mechanism
- ECDSA P-256 signing of releases
- Version monotonicity check (no downgrade replay)
- Update writes a NEW file (old = rollback)
- **Relevance:** Provider protocol versioning. The signed-update pattern could secure provider manifest updates — ensure a provider manifest hasn't been tampered with and is newer than the current version.

### 1d. AI Round-Trip Document Format
- Document is plain JSON in the file — agents edit `.bento.html` in place
- `window.bento.loadDoc(json)` API for chat round-trip
- Works fully offline with local models (Ollama, llama.cpp)
- **Relevance:** vivim-final's provider manifests are already JSON. The pattern of making the interchange format human-readable and AI-editable is already aligned. But Bento's "file is the software" concept could simplify provider distribution.

### 1e. In-House Chart Engine (Replacing ECharts)
- Removed ECharts (630KB = 47% of shell)
- Built `charts-lite`: pure SVG, ~20KB, same option shape API
- Bar/line/pie/scatter with transitions
- **Relevance:** vivim-final's frontend already uses lightweight rendering. If charts are ever needed in the admin dashboard, Bento's approach of building minimal in-house rather than pulling heavy deps is instructive.

---

## 2. dao-ai/cdp-browser — Anti-Detection CDP Automation

**What it is:** Pure CDP (no Playwright/Puppeteer) browser automation with anti-detection, humanized interaction, and AI agent loop. TypeScript. Chinese-market focused (Douyin, Xiaohongshu, etc.).

**This is the most directly harvestable project for vivim-final.**

### 2a. Anti-Detection Injection Engine (`anti-detection.ts`)
- Auto-injects scripts to hide `navigator.webdriver`, `__playwright`, `__puppeteer`, `__nightmare`, `__selenium`
- Fakes `window.chrome.runtime`, `navigator.plugins`, `navigator.languages`
- Per-site strategies: Douyin (CDP cleanup + login reuse), Xiaohongshu (real UA + random delays), Taobao/JD (canvas noise + viewport jitter), Zhihu (Bézier mouse), WeChat (existing profile)
- **Harvest for vivim-final:** The `getScriptsForUrl()` pattern — a function that returns site-specific anti-detection scripts based on URL. vivim-final's `ChromeGovernor` could use a similar approach when connecting to providers that have bot detection.

### 2b. Humanized Interaction Layer
- Bézier-curve mouse movement (not linear jumps)
- Character-by-character typing with 28-55ms intervals + burst pauses
- Multi-step natural scrolling (not instant jump)
- Random viewport jitter (±18px)
- **Harvest:** These are concrete implementation details for vivim-final's `ChromeGovernor` interaction layer. When clicking send buttons or typing in composer fields, humanized interaction reduces detection risk.

### 2c. Watchdog System (`scripts/watchdog/`)
- `event-bus.ts` — internal event system for watchdog coordination
- `base-watchdog.ts` — abstract watchdog interface
- `popups-watchdog.ts` — auto-dismiss alert/confirm/prompt
- `crash-watchdog.ts` — auto-recover on page crash
- `captcha-watchdog.ts` — detect and handle CAPTCHA challenges
- **Harvest:** vivim-final's `ChromeGovernor` already handles CDP lifecycle. Adding a watchdog pattern (event bus + specialized handlers) for popups, crashes, and CAPTCHAs would improve resilience.

### 2d. Cross-Platform Chrome Manager (`cdp-manager.ts`)
- Auto-detect OS: Windows (direct), WSL (netsh port forwarding), Linux (remote Chrome)
- Single function `connectBrowser()` handles all platforms
- `--login` mode: opens URL and waits for user to authenticate manually
- Cookie persistence: save/load cookies per site
- **Harvest:** The `--login` mode pattern (open URL, wait for manual auth, save session) directly matches vivim-final's relogin flow. The cookie persistence approach (save to JSON, restore on connect) is simpler than profile-based auth.

### 2e. AI Agent Loop (`agent.ts`)
- Natural language → LLM planning → browser action execution
- `BrowserAgent` class: `run(task, opts?)` returns `{success, finalOutput, totalSteps, endReason, history}`
- Loop detector: prevents LLM from repeating same action
- Message compactor: compresses conversation history to save tokens
- Planning system: task tracking + stagnation detection
- **Harvest:** The loop detector and message compactor patterns are directly applicable to vivim-final's agentic loops. When an agent gets stuck repeating actions, or when context grows too large, these patterns prevent runaway behavior.

### 2f. Page Pool (`cdp-pool.ts`)
- Reuse browser pages across tasks
- Concurrency-safe page allocation
- **Harvest:** vivim-final's `FleetSupervisor` manages Chrome instances. A page-pool pattern (reuse tabs instead of creating new ones) could reduce resource usage.

### 2g. Extractor Registry Pattern (`extractors/index.ts`)
- `REGISTRY` array: `{ domain, name, extract }` per site
- `extract(url, browser?)` — single function API
- `batchExtract(urls, opts?)` — parallel with summary stats
- **Harvest:** This is the same pattern as vivim-final's provider manifest system — registry-based dispatch. The batch+summary pattern could improve provider health checks.

---

## 3. browser-use — LLM-Driven Browser Agent

**What it is:** Python library wrapping Playwright, letting LLMs control browsers via natural language. 77K+★, the most popular agent browser framework.

### 3a. Event-Driven Browser Control
- `BrowserSession` uses `EventBus` (via `bubus`) to decouple action requests from CDP execution
- Specialized `Watchdog` classes listen for specific events
- `CrashWatchdog` monitors CDP session disconnects and attempts repair
- **Harvest:** The EventBus + Watchdog pattern is identical to cdp-browser's approach. This is a convergent design — multiple projects independently arrived at event-driven watchdog systems for CDP reliability.

### 3b. DOM-to-LLM State Pipeline
- Multi-stage pipeline: raw DOM → processed DOM tree → LLM-consumable state
- `DomService` converts complex web pages into structured elements with semantic descriptions
- Accessibility tree integration for better element understanding
- **Harvest:** vivim-final's `StreamParserEngine` parses provider wire formats. browser-use's DOM processing pipeline (raw → structured → semantic) could inform how vivim-final processes provider DOM snapshots for selector discovery.

### 3c. Context Compaction
- `MessageManager` manages conversation history, state pruning, and prompt assembly
- `maybe_compact_messages` triggers when history grows too large
- Retains critical task context while shedding verbose history
- **Harvest:** Directly applicable to vivim-final's agentic loops. When an agent session runs long, compacting context while preserving task state prevents token exhaustion.

### 3d. Provider-Agnostic LLM Interface
- Supports OpenAI, Anthropic, Google, and custom providers via `ChatBrowserUse`
- Single API key reaches all models via provider-prefixed IDs
- **Harvest:** vivim-final already has a multi-provider model. browser-use's approach of using provider-prefixed model IDs (`anthropic/claude-sonnet-4-6`) for unified routing is a clean pattern.

### 3e. Custom Tools Pattern
```python
tools = Tools()
@tools.action(description='Description of what this tool does.')
def custom_tool(param: str) -> str:
    return f"Result: {param}"
agent = Agent(task="...", llm=llm, tools=tools)
```
- **Harvest:** vivim-final's capability system is more complex (DB-backed, taxonomy-organized), but the decorator-based tool registration pattern is simpler for quick prototyping.

---

## 4. stagehand — Hybrid AI + Playwright

**What it is:** TypeScript SDK that extends Playwright with AI methods (`act`, `extract`, `observe`). Deterministic-first approach.

### 4a. Hybrid Automation Pattern
- Write standard Playwright for predictable flows (navigation, login)
- Use AI methods only for dynamic/unknown elements
- Full access to Playwright `page` object preserved
- **Relevance:** vivim-final already follows this pattern — deterministic CDP commands for known selectors, with fallback discovery for unknown DOM states. Stagehand validates this as the correct architectural choice.

### 4b. Action Caching (v3)
- Successful actions stored and reused without LLM calls on subsequent runs
- Significantly reduces costs for repeated operations
- **Harvest:** vivim-final's `SelectorHealer` could cache successful selector resolutions. If a selector worked for provider X last time, cache it and skip the discovery phase.

---

## 5. skyvern — Vision-Driven Browser Agent

**What it is:** Computer vision + LLM for browser automation. 20K+★. Layout-independent.

### 5a. Vision + LLM Hybrid
- Uses screenshots + OCR instead of DOM parsing
- Works on complex interfaces with nested iframes
- Visual workflow editor for non-technical users
- **Relevance:** Less directly applicable to vivim-final (which uses CDP DOM access). But the vision approach could be a fallback for providers where DOM inspection is blocked.

### 5b. Production Reliability Features
- Native 2FA/TOTP handling
- CAPTCHA support
- Proxy networks with geographic targeting
- Structured schema-based extraction
- **Harvest:** The 2FA/TOTP handling pattern could improve vivim-final's relogin flow for providers that require MFA.

---

## Cross-Project Patterns

| Pattern | bento | cdp-browser | browser-use | stagehand | skyvern | vivim-final |
|---------|-------|-------------|-------------|-----------|---------|-------------|
| CDP direct (no Playwright) | — | ✅ | ❌ | ❌ | ❌ | ✅ |
| Anti-detection | — | ✅ | partial | — | ✅ | ❌ |
| Humanized interaction | — | ✅ | — | — | — | ❌ |
| Watchdog system | — | ✅ | ✅ | — | — | ❌ |
| Event-driven architecture | — | ✅ | ✅ | — | — | partial |
| DOM-to-semantic pipeline | — | — | ✅ | ✅ | ❌ | ❌ |
| Context compaction | — | ✅ | ✅ | — | — | ❌ |
| Loop detection | — | ✅ | — | — | — | ❌ |
| Action caching | — | — | — | ✅ | — | ❌ |
| CRDT collaboration | ✅ | — | — | — | — | ✅ (NodeLayer) |
| Signed updates | ✅ | — | — | — | — | ❌ |
| Extractor registry | — | ✅ | — | — | — | ✅ (ProviderManifest) |
| Page pool / tab reuse | — | ✅ | — | — | — | ❌ |
| Cross-platform Chrome | — | ✅ | — | — | — | ❌ |

---

## Key Takeaways

1. **Anti-detection is a solved problem** — cdp-browser has concrete, per-site injection scripts. vivim-final should adopt the `getScriptsForUrl()` pattern.

2. **Humanized interaction is cheap insurance** — Bézier mouse, character-by-character typing, viewport jitter. Easy to implement, hard to detect.

3. **Watchdog systems are convergent** — Both cdp-browser and browser-use independently built event-bus + watchdog patterns. This is the correct architecture for CDP reliability.

4. **Context compaction prevents runaway agents** — Both cdp-browser (message compactor) and browser-use (MessageManager) solve the same problem vivim-final faces with long-running agentic sessions.

5. **Loop detection is critical** — cdp-browser's loop detector prevents the LLM from repeating the same failed action. vivim-final's agentic loops should adopt this.

6. **Action caching reduces costs** — stagehand's approach of caching successful actions could save LLM calls in vivim-final's provider testing pipeline.

7. **bento's "file-as-software" pattern** is elegant but not directly applicable to vivim-final's architecture. The signed-update mechanism is the most transferable pattern.

## Sources

1. [nyblnet/bento](https://github.com/nyblnet/bento) — Single-file office suite, 706★
2. [nyblnet/bento CLAUDE.md](https://raw.githubusercontent.com/nyblnet/bento/main/CLAUDE.md) — Deep architecture reference
3. [nyblnet/bento docs/architecture.md](https://raw.githubusercontent.com/nyblnet/bento/main/docs/architecture.md) — Runtime architecture
4. [dao-ai/cdp-browser](https://github.com/dao-ai/cdp-browser) — Anti-detection CDP automation
5. [dao-ai/cdp-browser README](https://raw.githubusercontent.com/dao-ai/cdp-browser/main/README.md) — Full API reference
6. [browser-use/browser-use](https://github.com/browser-use/browser-use) — LLM-driven browser agent, 77K+★
7. [browser-use system architecture](https://deepwiki.com/browser-use/browser-use/1.1-system-architecture) — Event-driven architecture analysis
8. [AI Browser Agents 2026 comparison](https://noqta.tn/en/blog/ai-browser-agents-browser-use-stagehand-web-automation-2026) — Performance benchmarks
9. [Browser Use vs Stagehand](https://www.skyvern.com/blog/browser-use-vs-stagehand-which-is-better/) — Architectural comparison
10. [The Framework Wars](https://dev.to/stevengonsalvez/browser-tools-for-ai-agents-part-2-the-framework-wars-browser-use-stagehand-skyvern-4gn) — practitioner survey
11. [Browser Automation Without Puppeteer](https://michael.vu/post/2026-02-09-browser-automation-cdp-method.html) — CDP method for AI agents
12. [AI Browser Automation Tools 2026](https://gist.github.com/kevinmichaelchen/9d77b8a681238cc45297dff969686175) — Comprehensive tool comparison
13. [Browser-use vs Stagehand vs Skyvern](https://www.joinmassive.com/blog/browser-use-vs-stagehand-vs-skyvern-choosing-an-agent-browser-framework) — Framework selection guide
14. [CDP Browser Skill](https://dao-ai.github.io/cdp-browser/en/) — Anti-detection documentation

## Methodology

Searched 4 query variations across web search. Analyzed 14 sources. Deep-read full README + architecture docs for bento, cdp-browser, and browser-use. Cross-referenced claims across comparison articles.
