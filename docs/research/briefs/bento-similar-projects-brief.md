# Bento & Similar Projects — Brief

**Source:** [full report](../reports/bento-similar-projects-sota-2026.md)
**Confidence:** High | **Sources:** 14 | **Date:** 2026-07-23

## TL;DR

`nyblnet/bento` is a single-file office suite (not browser automation), but `cdp-browser`, `browser-use`, and `stagehand` are directly relevant to vivim-final's CDP architecture. The top harvestable patterns are: anti-detection injection (cdp-browser), humanized interaction (cdp-browser), watchdog systems (cdp-browser + browser-use), context compaction (browser-use), and loop detection (cdp-browser).

## Key Decisions

1. **Adopt anti-detection injection** — cdp-browser has per-site scripts that hide `navigator.webdriver`, fake plugins/languages, and inject canvas noise. This is cheap insurance against provider bot detection.

2. **Implement humanized interaction** — Bézier-curve mouse, character-by-character typing (28-55ms), viewport jitter (±18px). Concrete, tested patterns from cdp-browser.

3. **Add watchdog system** — Event-bus + specialized handlers for popups, crashes, CAPTCHAs. Convergent design (cdp-browser + browser-use both arrived here independently).

4. **Implement context compaction** — When agentic sessions run long, compact conversation history while preserving task state. browser-use's `MessageManager` pattern.

5. **Add loop detection** — Prevent LLM from repeating same failed action. cdp-browser's `loop-detector.ts` pattern.

## Evidence Summary

- **cdp-browser** ([source](https://github.com/dao-ai/cdp-browser)): Pure CDP anti-detection with per-site strategies. 11-site extractor registry. AI agent with loop detection + message compaction. Watchdog system for popups/crashes/captcha.
- **browser-use** ([source](https://github.com/browser-use/browser-use)): 77K+★. Event-driven browser control via EventBus + Watchdogs. DOM-to-semantic pipeline. Context compaction via MessageManager. Provider-agnostic LLM interface.
- **stagehand** ([source](https://github.com/browserbase/stagehand)): Hybrid Playwright + AI. Action caching (v3) reduces LLM calls on repeated operations.
- **bento** ([source](https://github.com/nyblnet/bento)): 706★. Signed self-updates (ECDSA P-256). In-house CRDT. "File-as-software" pattern. Most patterns not directly applicable to vivim-final.

## Open Questions

1. How does vivim-final's `ChromeGovernor` currently handle anti-detection? (Needs code review)
2. Does vivim-final's agentic loop already have context compaction? (agentic-loop.ts needs audit)
3. Should anti-detection be provider-specific (like cdp-browser) or global?
4. What is the performance cost of Bézier mouse movement in CDP?

## Used In

- Potential: ChromeGovernor hardening (anti-detection, humanized interaction)
- Potential: Agentic loop improvements (context compaction, loop detection)
- Potential: Provider testing resilience (watchdog system)
