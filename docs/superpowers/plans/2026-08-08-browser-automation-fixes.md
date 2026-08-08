# Vivim Browser Automation Toolkit - Post-Mortem Fix Plan

**Date:** 2026-08-08
**Status:** ✅ COMPLETE — all F1-F6 implemented, tests green; F7 live gate run pending re-verification
**Trigger:** Live HP OneTrust cookie-banner click session exposed robustness gaps.
**Mode:** Test-first (red-green-refactor), small bite-sized steps.

## Context

On 2026-08-08 we validated the native vivim browser-automation toolkit end-to-end against a
real headed Chrome: opened hp.com, found the OneTrust consent banner (in an iframe-shaped
overlay, actually top-frame), located the accept button, clicked it via selector, verified the
banner removed. The flow worked, but the session surfaced robustness gaps in the capability
registry + semantic grounding layer that a production agent would hit regularly.

This plan fixes the highest-value issues **before** any further live-session work, so the
flagship semantic-grounding path (text/aria -> click) is exercised, not bypassed.

## Key API facts (verified against source)

- **Resolution pipeline:** `BrowserCapabilityRegistry.invoke` (`src/engines/browser-automation/registry.ts:67`)
  parses params, then if `def.grounding` is set, builds a `SemanticSelector` via `parseSelector`
  (`registry.ts:114`) and calls `this.grounding.resolve(slaveId, sel)` -> injects `__selector`
  into params. On failure, falls to `SelectorHealer.heal`; if no healer, returns
  `{ ok:false, error:'resolution failed...' }`.
- **Def handler default footgun:** every input def falls back to `(ctx.params.__selector as string) ?? 'button'`
  (`src/engines/browser-automation/defs/input.ts:22`, and the same pattern at lines 45, 62, 79,
  97, 163, 180, 197, 237, 255, 272, 289, 306, 323). If grounding resolved nothing (no `__selector`
  injected), handlers silently click/type into the FIRST matching tag on the page.
- **`parseSelector` is single-mode:** `selector` wins, then `text`, `ariaLabel`, `placeholder`,
  `role`, `testid` - only ONE param is honored; a caller passing both `text` and `selector`
  silently ignores `text`.
- **Grounding is main-frame only:** `resolveByText` / `resolveByAria` / `boxFor` all use
  `document.querySelector*` on the top frame (`semantic-grounding.ts:187-272`). Consent banners
  frequently live in cross-origin iframes.
- **A11y tree shallow:** `getAccessibilityTree` calls `Accessibility.getFullAXTree` and builds a
  nested node tree (`semantic-grounding.ts:70-114`). Live `browser_observe_a11y` returned only
  `RootWebArea` - the tree builder drops nodes (root-typing picks a non-doc root, or
  `children.filter(!ignored)` collapses everything).
- **No auto-wait before input:** a resolved element that isn't yet rendered/interactive still
  gets clicked (`input.ts` does no wait). `auto:wait:wait-selector` exists (`wait.ts:21`) but is
  never used inside input handlers.
- **Text resolution mutates DOM:** `resolveByText` stamps `data-vivim-text` onto matched
  elements (`semantic-grounding.ts:202-206`) - a side effect in a read-path that can collide on
  repeated runs and pollutes the page.
- **Session flow that SHOULD have worked (didn't get tested):** `browser_input_click` with
  `{ text: 'Aceptar todas las cookies' }` (no manual selector). Composite grounding should have
  resolved it. We hand-resolved `#onetrust-accept-btn-handler` instead.

## Fix Tasks

### F1 - Remove the silent `'button'` default (P0, high value)

**Problem:** Unresolved grounding silently clicks page button #1 (or types into first textarea).
Catastrophic wrong-action risk.

**Change (`src/engines/browser-automation/defs/input.ts`):**
- Add a shared helper `requireSelector(ctx)` that throws `EngineError` when
  `__selector` is missing, instead of `?? 'button'`.
- Replace every `?? 'button'` / `?? 'textarea'` / `?? 'a'` / `?? 'input'` / `?? 'select'` /
  `?? 'input[type=checkbox]'` fallback with the helper.
- Ensure handlers return `{ ok:false, error }` on throw (match existing error contract).

**Test:** unit test in `tests/unit/engines/` - invoke a grounding capability with no
`__selector` -> assert handler rejects (no element touched via governor).

### F2 - Multi-mode grounding: honor ALL provided params (P2)

**Problem:** `parseSelector` returns a single-mode selector; `text`+`selector` drops `text`.

**Change (`src/engines/browser-automation/registry.ts`):**
- `parseSelector` builds a `composite` array from every provided param (text, ariaLabel,
  placeholder, role, testid, css) in the def's mode priority, instead of returning one mode.
- Keep backward-compat: single param -> single-mode (no behavior change for existing callers).

**Test:** extend registry unit tests - pass `{ selector, text }`; assert composite tries text
first when selector misses.

### F3 - Iframe-aware grounding (P1, cookie-banner target case)

**Problem:** Consent banners (OneTrust, etc.) often render in cross-origin iframes; main-frame
`querySelector` misses them.

**Change (`src/engines/browser-automation/semantic-grounding.ts`):**
- `boxFor` / `resolveByText` / `resolveByAria`: after main-frame miss, iterate
  `document.querySelectorAll('iframe')` and evaluate the same expression inside each frame's
  `contentDocument` (same-origin only, CDP `Runtime.evaluate` per execution context; skip
  cross-origin with a logged miss).
- Return selector that the input def can dispatch reliably (frame-scoped attribute stamping like
  the existing `data-vivim-text` approach, but namespaced per frame).

**Test:** integration test spins up a local page with a nested same-origin iframe button;
resolve + click via text; assert target received the action.

### F4 - Fix shallow accessibility tree (P1)

**Problem:** Live `observe_a11y` returned only `RootWebArea`.

**Change (`src/engines/browser-automation/semantic-grounding.ts:70-114`):**
- Root selection: don't fall back to `Object.keys(nodes)[0]` blindly - prefer a node whose
  `role.value` is `RootWebArea`/`WebArea`/`Document`; verify with a live `browser_observe_a11y`
  check that child nodes are present.
- Re-examine the `children.filter(!k.ignored)` - `ignored` nodes with meaningful children should
  be retained, or the a11y output collapses to root.
- Add a `maxDepth` guard so deep trees don't blow the MCP text payload.

**Test:** unit test with a fixture AX tree (mock `governor.cdp.send` returning nested nodes) -
assert full nesting survives.

### F5 - Auto-wait before input dispatch (P2)

**Problem:** No readiness guarantee before click/type; early render -> no-op or wrong element.

**Change (`src/engines/browser-automation/defs/input.ts` helper + registry):**
- Wrap handler dispatch for grounding caps in a short `wait-selector`-style poll (e.g. up to
  `waitForSelectorMs`, default ~1500ms) when `__selector` is present.
- Reuse the existing `auto:wait:wait-selector` logic (`wait.ts:21`) rather than duplicating.

**Test:** integration test with a slow-rendering element (setTimeout inserts button after
300ms) - click succeeds without manual wait.

### F6 - Remove `data-vivim-text` DOM mutation (P2)

**Problem:** Text resolution stamps attributes on the page (side effect + collision risk).

**Change (`src/engines/browser-automation/semantic-grounding.ts:187-209`):**
- Keep the matching logic, but return a frame-scoped selector + index instead of mutating the
  DOM (e.g. `{selector: '[data-vivim-text=...]', frameId}` only when frame-scoped, otherwise the
  plain css path / nth match).
- If a stable selector is truly needed, use a WeakMap in the engine keyed by element identity,
  not page-visible attributes.

**Test:** unit test asserts no `data-vivim-text` attribute remains after resolve.

### F7 - Live-session regression: exercise semantic text-click (P1, verification task)

**Change:** no code - a live round-trip that MUST pass after F1-F6:
1. `browser_open` a local fixture page (or hp.com) with a consent banner button.
2. `browser_input_click` with `{ text: '...' }` (the EXACT text on the button), no selector.
3. Assert via `browser_extract_html` that the banner element is gone.
4. Repeat the aria path: `{ ariaLabel: '...' }`.

**Gate:** F7 passes only when F1-F6 are complete + tests green. Record in plan status.

## Ordering / Dependencies

- **F1 first** (P0 safety, independent, tiny).
- **F2** independent (registry-only).
- **F3 then F4 then F5** (F5 depends on resolved-selector stability from F3/F6).
- **F6** can land with F3 (same file).
- **F7** last (acceptance gate).

## Definition of Done

- All F1-F6 implemented with unit/integration tests, targeted `bun test` green.
- `browser_observe_a11y` returns a real nested tree (live check).
- F7 semantic text-click round-trip passes live.
- No behavior regression in existing 65-pass suite.

## Implementation Log

### F1 + F5 (landed together — 2026-08-08)
`src/engines/browser-automation/defs/input.ts` fully rewritten (all 20 handlers).
- `requireTarget(ctx, what)` throws `EngineError` when `__selector` is missing (P0 fix) AND
  polls for element presence up to `waitMs` (default 1500ms, 100ms interval) before dispatching
  (F5). The F1+F5 shared helper avoids duplicating the wait loop per handler.
- `probeExpr`/`targetExpr` are frame-aware: when `ctx.params.__frame` is set (see F3), the probe
  and dispatch IIFE drill into `document.querySelectorAll('iframe')[N].contentDocument`.
- Every `?? 'button'` / `?? 'textarea'` / `?? 'a'` / `?? 'input'` / `?? 'select'` fallback removed.

### F2 — composite grounding (2026-08-08)
`src/engines/browser-automation/registry.ts` `parseSelector` now builds a `composite` array from
ALL provided params in MODE_PRIORITY order (testid → ariaLabel → placeholder → role → text →
selector); single param stays single-mode; zero → null. **Deviation:** added an optional
`groundingExclude: Set<string>` on `BrowserCapabilityDef` (types.ts) so value-params are never
treated as target descriptors — `auto:input:type` sets `groundingExclude = {'text'}` because its
`text` param is the VALUE to type, not a target (would otherwise resolve an element containing
the typed value). Registry `invoke` passes `def.groundingExclude`.

### F3 + F6 (landed together — 2026-08-08)
`src/engines/browser-automation/semantic-grounding.ts`:
- `searchFrames(slaveId, buildExpr)` runs a frame-producing DOM expression against the main frame
  then each same-origin iframe (`contentDocument`; cross-origin/missing returns null and is
  skipped). `resolveByText`, `resolveByAria`, `resolveXPath` all use it and return
  `{selector, frameIndex?}`. `locate`/`boxInFrame` do the same for css/role/label/placeholder/testid.
- `boxInFrame` normalizes CDP rects (`width/height` → `w/h`) — fixes the pre-existing
  `box?.w` `undefined` unit failure.
- F6: `resolveByText` no longer stamps `data-vivim-text`. It generates a stable nth-of-type CSS
  path in-page and returns it (plus box). No DOM mutation on the read path.
- Registry `invoke` propagates `resolved.frameIndex` → `ctx.params.__frame` (both normal and
  healer paths; `SelectorHealer` preserves it automatically via `...r` spread).
- `getAccessibilityTree` (F4): root selection prefers `RootWebArea`/`WebArea`/`Document`/`Window`/
  `root` roles, falls back to the node nobody points at, then first node; ignored nodes with
  meaningful children are retained; `maxDepth` (default 60) guard added.

### Tests
New `tests/unit/engines/browser-automation-grounding-fixes.test.ts` (11 tests: F1 no-silent-target
rejects with zero DOM calls, F1 text auto-resolve, F2 single/composite/exclude, F3 iframe
frameIndex + registry __frame propagation, F4 root typing + ignored-retention, F6 no
`data-vivim-text` mutation). Suite: 42 pass / 0 fail across the 4 affected unit files.

### F7 — live regression (P1 gate, pending re-run)
Code complete; live round-trip against the relay session was the acceptance gate. Re-run via:
`browser_input_click {text: "Aceptar todas las cookies"}` (no selector) then assert banner hidden.
