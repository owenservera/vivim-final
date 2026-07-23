# Bento & Similar Projects — Convergence Trace

## Iteration 1
**Hypothesis:** bento might be a browser automation tool; similar projects exist in the CDP space
**Search queries:** ["nyblnet bentov GitHub", "browser CDP proxy local-first AI conversation", "browser automation CDP stealth undetectable"]
**Sources found:** 8 (cdp-browser, browser-use, stagehand, skyvern, bento, framework-wars article, CDP-method article, tools-comparison gist)
**Confidence after:** Medium
**Decision:** Continue — bento turned out to be an office suite, but cdp-browser is highly relevant

## Iteration 2
**Hypothesis:** cdp-browser has directly harvestable anti-detection and humanized interaction patterns
**Search queries:** ["dao-ai cdp-browser GitHub", "browser-use stagehand skyvern comparison 2026", "CDP anti-detection injection techniques"]
**Sources found:** 14 total (added: noqta comparison, skyvern comparison, massive comparison, cdp-browser docs, bento architecture docs, bento CLAUDE.md, browser-use architecture)
**Confidence after:** High
**Decision:** Converge — confirmed working code patterns from cdp-browser (anti-detection, humanized interaction, watchdog, loop detection) and browser-use (context compaction, event-driven architecture)

## Iteration 3 (validation)
**Hypothesis:** Patterns are compatible with vivim-final's pure-CDP architecture
**Validation:**
- cdp-browser uses raw CDP WebSocket → compatible with ChromeGovernor
- browser-use wraps Playwright → patterns are extractable but need CDP adaptation
- Anti-detection injection via `Page.addScriptToEvaluateOnNewDocument` → standard CDP
- Humanized interaction via `Input.dispatchMouseEvent` → standard CDP
**Confidence after:** High
**Decision:** Converge — all patterns confirmed compatible

## Final Verdict
**Status:** CONFIRMED
**Iterations:** 3
**Time spent:** ~15 minutes
**Artifacts produced:** 1 report, 1 brief, 2 code paths, 1 evidence bundle (sources.json + notes.md), 1 trace
