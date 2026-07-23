# Research Notes: Bento & Similar Projects

## 2026-07-23 — Initial Research

### nyblnet/bento
- Repo URL corrected: `nyblnet/bento` (not `bentov` as user typed)
- 706★, MIT, TypeScript, 260 commits
- Single-file office suite — NOT browser automation
- Architecture: HTML file = document + viewer + editor + presenter
- In-house CRDT for live collaboration (E2EE, blind relay)
- Signed self-updates (ECDSA P-256)
- Document format: JSON in `<script type="application/bento+json" id="bento-doc">`
- AI round-trip: `window.bento.loadDoc(json)` API
- In-house chart engine replaced ECharts (630KB → ~20KB)
- DEFLATE-compressed shell (~560KB)
- File System Access API for self-save

### dao-ai/cdp-browser
- 0★ (very new, created 2026-05-29), MIT, TypeScript
- Pure CDP — no Playwright/Puppeteer/Selenium
- Anti-detection: hides webdriver, fakes plugins/languages, canvas noise
- Humanized: Bézier mouse, character typing 28-55ms, viewport jitter ±18px
- Watchdog: popup/crash/captcha handlers with event bus
- AI Agent: BrowserAgent class, loop detector, message compactor
- Page pool: reuse tabs across tasks
- Extractor registry: 10 Chinese sites (Douyin, Xiaohongshu, etc.)
- Cross-platform: Windows direct, WSL netsh, Linux remote
- Cookie persistence: save/load per site
- 100% AI-written (no human code)

### browser-use
- 77K+★, Python, wraps Playwright
- Event-driven: EventBus + Watchdogs (CrashWatchdog, etc.)
- DOM pipeline: raw DOM → processed tree → LLM-consumable state
- Context compaction: MessageManager compacts history
- Provider-agnostic: OpenAI, Anthropic, Google via ChatBrowserUse
- Custom tools: decorator-based registration
- Benchmark: 89.1% on WebVoyager with Claude
- #1 on Odysseys leaderboard (87.4% avg)

### stagehand
- TypeScript, extends Playwright
- Hybrid: deterministic Playwright + AI methods (act, extract, observe)
- Action caching (v3): successful actions reused without LLM calls
- ~1-3s per AI action

### skyvern
- 20K+★, computer vision + LLM
- Layout-independent (works on nested iframes)
- 85.85% on WebVoyager
- Visual workflow editor for non-technical users
- Native 2FA/TOTP handling

## Key Patterns to Harvest for vivim-final

1. **Anti-detection injection** — `getScriptsForUrl()` returning site-specific scripts
2. **Humanized interaction** — Bézier mouse, character typing, viewport jitter
3. **Watchdog system** — Event bus + specialized handlers (popup/crash/captcha)
4. **Loop detection** — Prevent LLM repeating same failed action
5. **Message compaction** — Compress history to save tokens
6. **Action caching** — Reuse successful selector resolutions
7. **Page pool** — Reuse tabs across tasks
8. **Cookie persistence** — Save/load auth state per provider
