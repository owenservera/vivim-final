// src/engines/onboarding/webapp-fingerprint.ts
// WFV extractor — Stage 2 of the onboarding pipeline.
// See FINAL-UPGRADE-PLAN-V2.md §6 (Tier E) for design rationale.
//
// Audit-aware upgrades baked in (V2):
//  - 🚀-1: temporal `domDeltaShape` axis (pre-probe vs post-probe diff)
//  - 🚀-9: SHA-256 hex for `shapeSignature` (was Bun.hash variable-length)
//  - ❌-1 (source): real CDP event subscription via capability-event-bus, NOT a
//    setTimeout(windowMs) stub that always returns all-zero network shape.
//  - ❌-5 (source): discrete boolean framework signals (no enum collapsing).
//
// Tier E (V2) additions — close F-1..F-5:
//  - F-1: real repeated-block detector (was a one-liner landmark query).
//  - F-2: real domDeltaShape with container-children count (was aria landmark diff).
//  - F-3: per-dimension z-score normalization in toNumericVector.
//  - F-4: ARIA vocabulary filter (was arbitrary custom roles).
//  - F-5: DOM ready wait before probing.

import { createHash } from 'node:crypto'
import type { GovernorHandleLike, WebAppFingerprintVector } from './types.js'

// Tier E F-4 — WAI-ARIA 1.2 landmark + role vocabulary. Filter arbitrary
// custom roles (e.g. `<div role="foo">`) so two pages with different custom
// roles don't mismatch on structurally-identical WFVs.
const WAI_ARIA_ROLES = new Set([
  'alert',
  'alertdialog',
  'application',
  'article',
  'banner',
  'blockquote',
  'button',
  'caption',
  'cell',
  'checkbox',
  'columnheader',
  'combobox',
  'complementary',
  'contentinfo',
  'definition',
  'dialog',
  'directory',
  'document',
  'feed',
  'figure',
  'form',
  'generic',
  'grid',
  'gridcell',
  'group',
  'heading',
  'img',
  'link',
  'list',
  'listbox',
  'listitem',
  'log',
  'main',
  'marquee',
  'math',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'navigation',
  'none',
  'note',
  'option',
  'presentation',
  'progressbar',
  'radio',
  'radiogroup',
  'region',
  'row',
  'rowgroup',
  'rowheader',
  'scrollbar',
  'search',
  'searchbox',
  'separator',
  'slider',
  'spinbutton',
  'status',
  'switch',
  'tab',
  'table',
  'tablist',
  'tabpanel',
  'term',
  'textbox',
  'timer',
  'toolbar',
  'tooltip',
  'tree',
  'treegrid',
  'treeitem',
])

const DOM_PROBE_JS = `(() => {
  const editable = document.querySelectorAll('[contenteditable="true"], textarea').length;
  const textbox = document.querySelectorAll('[role="textbox"]').length;
  // Tier E F-4 — filter to WAI-ARIA 1.2 vocabulary before deduping.
  const WAI_ARIA_ROLES = new Set(${JSON.stringify([...WAI_ARIA_ROLES])});
  const landmarks = Array.from(document.querySelectorAll('[role]'))
    .map(el => el.getAttribute('role'))
    .filter(r => r && WAI_ARIA_ROLES.has(r));
  const generator = document.querySelector('meta[name="generator"]')?.getAttribute('content') ?? null;
  // Audit ❌-5 fix — discrete boolean framework signals (no enum).
  const hasReactRoot = !!(document.querySelector('[data-reactroot]') || document.querySelector('#root[data-reactroot]'));
  const hasNextData = !!(window).__NEXT_DATA__;
  const hasVueApp = !!(document.querySelector('[data-v-app]'));
  // Tier E F-1 — real repeated-block detector. A "scrollable repeated block"
  // is a container with 3+ siblings of identical tag+class and at least one
  // data-* attribute that strictly increases across siblings. Replaces the
  // previous one-liner that matched any element with role=log/aria-live.
  const repeatedBlockContainers = Array.from(
    document.querySelectorAll('[role="log"], [aria-live], main, [class*="message"], [class*="chat"], [class*="thread"]')
  );
  const scrollableRepeatedBlockDetected = repeatedBlockContainers.some(container => {
    const siblings = Array.from(container.children).slice(0, 5);
    if (siblings.length < 3) return false;
    const tags = new Set(siblings.map(s => s.tagName));
    if (tags.size > 1) return false;
    // Allow up to 2 distinct className values (some frameworks add an
    // :nth-child class). More than that = not a repeated block.
    const classes = new Set(siblings.map(s => s.className));
    if (classes.size > 2) return false;
    // Monotonic data-* check — at least one data-* key strictly increases.
    const firstChild = siblings[0];
    if (!firstChild) return false;
    const dataKeys = Object.keys(firstChild.dataset || {});
    return dataKeys.some(k => {
      const vals = siblings.map(s => s && s.dataset ? s.dataset[k] : '').filter(Boolean);
      if (vals.length < 3) return false;
      // Strictly monotonic non-decreasing.
      let isMonotonic = true;
      for (let i = 1; i < vals.length; i++) {
        if (vals[i] < vals[i - 1]) { isMonotonic = false; break; }
      }
      return isMonotonic;
    });
  });
  return {
    editableCount: editable,
    textboxRoleCount: textbox,
    ariaLandmarkRoles: [...new Set(landmarks)],
    generatorMeta: generator,
    hasReactRoot,
    hasNextData,
    hasVueApp,
    scrollableRepeatedBlockDetected,
  };
})()`

interface DomProbeResult {
  editableCount: number
  textboxRoleCount: number
  ariaLandmarkRoles: string[]
  generatorMeta: string | null
  hasReactRoot: boolean
  hasNextData: boolean
  hasVueApp: boolean
  scrollableRepeatedBlockDetected: boolean
}

export interface NetworkEvent {
  mimeType?: string
  url?: string
  ts: number
  kind: 'response' | 'wsFrame' | 'dataReceived'
  dataLength?: number
}

/**
 * Real CDP event subscription — replaces the source MD's `setTimeout(windowMs)`
 * stub. Caller is expected to feed events captured by capability-event-bus.ts
 * subscribers on `Network.responseReceived` / `Network.webSocketFrameReceived` /
 * `Network.dataReceived` during the observation window.
 */
export function inferNetworkShape(events: NetworkEvent[]): {
  sseResponseCount: number
  websocketUpgradeDetected: boolean
  pollingCadenceMs: number | null
} {
  const sseCount = events.filter(
    (e) => e.kind === 'response' && e.mimeType === 'text/event-stream',
  ).length
  const wsDetected = events.some((e) => e.url?.startsWith('wss://') || e.url?.startsWith('ws://'))
  const pollingCadence = inferPollingCadence(events)
  return {
    sseResponseCount: sseCount,
    websocketUpgradeDetected: wsDetected,
    pollingCadenceMs: pollingCadence,
  }
}

function inferPollingCadence(events: NetworkEvent[]): number | null {
  const polls = events
    .filter((e) => e.kind === 'response' && e.url && !e.url.startsWith('ws'))
    .map((e) => e.ts)
    .sort((a, b) => a - b)
  if (polls.length < 3) return null
  const deltas = polls.slice(1).map((t, i) => t - polls[i]!)
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length
  if (mean === 0) return null
  const variance = deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / deltas.length
  const isRegular = Math.sqrt(variance) < mean * 0.25
  return isRegular ? Math.round(mean) : null
}

/**
 * Tier E F-5 — wait for the DOM to be ready before probing. Up to 2s.
 * Prevents WFVs being computed against an un-hydrated SPA where counts
 * are temporarily zero.
 */
async function waitForDomReady(handle: GovernorHandleLike, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ready = await handle.evaluate<string>('document.readyState').catch(() => 'complete')
    if (ready === 'complete') return
    await new Promise((r) => setTimeout(r, 100))
  }
}

/**
 * Compute the static (pre-probe) WFV from a single batched Runtime.evaluate call.
 * The `networkShape` must be supplied by the caller from the event bus — we do
 * NOT sleep here (audit ❌-1 fix).
 *
 * Tier E F-5 — calls waitForDomReady before probing.
 */
export async function computeStaticFingerprint(
  handle: GovernorHandleLike,
  networkShape: WebAppFingerprintVector['networkShape'],
): Promise<Omit<WebAppFingerprintVector, 'domDeltaShape'>> {
  await waitForDomReady(handle)
  const domFrameworkRaw = await handle.evaluate<DomProbeResult>(DOM_PROBE_JS)
  const domShape = {
    editableCount: domFrameworkRaw.editableCount,
    textboxRoleCount: domFrameworkRaw.textboxRoleCount,
    scrollableRepeatedBlockDetected: domFrameworkRaw.scrollableRepeatedBlockDetected,
    ariaLandmarkRoles: domFrameworkRaw.ariaLandmarkRoles,
  }
  const frameworkShape = {
    hasReactRoot: domFrameworkRaw.hasReactRoot,
    hasNextData: domFrameworkRaw.hasNextData,
    hasVueApp: domFrameworkRaw.hasVueApp,
    generatorMeta: domFrameworkRaw.generatorMeta,
  }
  const vector = { domShape, networkShape, frameworkShape }
  return { ...vector, shapeSignature: hashShape(vector) }
}

/**
 * Compute the temporal `domDeltaShape` by re-running the DOM probe after the
 * GIP probe (Stage 4) has fired one synthetic input. Captures "this DOM
 * mutates under interaction" which static shape cannot.
 *
 * Tier E F-2 fix — the previous implementation used `ariaLandmarkRoles.length`
 * diff as a proxy for `appendedBlockCount`, which is essentially always 0
 * (most chat apps add a `<div>` with role=log once, then append non-landmark
 * children). The new implementation counts the children of the discovered
 * stream_region container, which is the actual chat-message-list metric.
 */
export function computeDelta(
  before: DomProbeResult,
  after: DomProbeResult,
): WebAppFingerprintVector['domDeltaShape'] {
  return {
    editableCountDelta: after.editableCount - before.editableCount,
    textboxRoleCountDelta: after.textboxRoleCount - before.textboxRoleCount,
    // Tier E F-2 — we can't see the container children from the static probe,
    // so we use the scrollableRepeatedBlockDetected flag as a coarse signal.
    // The orchestrator's Stage 4 post-probe snapshot can override these by
    // re-running the probe against the discovered container selector.
    appendedBlockCount: 0, // overwritten by orchestrator with real child count
    replacedBlockCount:
      after.scrollableRepeatedBlockDetected && !before.scrollableRepeatedBlockDetected ? 1 : 0,
  }
}

/**
 * Tier E F-2 — compute a real `appendedBlockCount` by counting the children
 * of a specific container selector before and after the GIP probe. The
 * orchestrator calls this when it has a discovered stream_region selector.
 */
export async function computeContainerChildDelta(
  handle: GovernorHandleLike,
  containerSelector: string,
  beforeCount: number,
): Promise<number> {
  const afterCount = await handle
    .evaluate<number>(
      `(() => {
        const el = document.querySelector(${JSON.stringify(containerSelector)});
        return el ? el.children.length : 0;
      })()`,
    )
    .catch(() => beforeCount)
  return Math.max(0, afterCount - beforeCount)
}

/** Run a pre-probe snapshot to seed the temporal diff computation. */
export async function snapshotDomProbe(handle: GovernorHandleLike): Promise<DomProbeResult> {
  return handle.evaluate<DomProbeResult>(DOM_PROBE_JS)
}

/**
 * Audit 🚀-9 fix — SHA-256 hex for `shapeSignature`.
 * Previously: `Bun.hash(JSON.stringify(v)).toString(16)` which is variable-length
 * and non-cryptographic. Now: stable 64-char hex string suitable as a cache key.
 */
export function hashShape(
  v: Omit<WebAppFingerprintVector, 'shapeSignature' | 'domDeltaShape'>,
): string {
  // Stable JSON.stringify — sort keys at every level.
  const stable = JSON.stringify(v, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (value as Record<string, unknown>)[k]
          return acc
        }, {})
    }
    return value
  })
  return createHash('sha256').update(stable, 'utf8').digest('hex')
}

/** Cosine similarity for taxonomy centroid matching (Stage 3). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    // Audit ❌-6 — throw on length mismatch instead of silently returning 0
    // (which masked the all-zero WFV symptom of the observeNetworkShape stub).
    throw new Error(`cosineSimilarity: length mismatch (${a.length} vs ${b.length})`)
  }
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    const av = a[i]!
    const bv = b[i]!
    dot += av * bv
    magA += av * av
    magB += bv * bv
  }
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

/**
 * Tier E F-3 — per-dimension z-score normalization parameters.
 * Without normalization, pollingCadenceMs (which can be 0 or 30000+) dominates
 * the cosine similarity score. Z-score normalization puts every dimension on
 * the same scale.
 *
 * These values are based on empirical observation of common WebApp shapes:
 *  - editableCount: typical 1-3, occasionally 0 (read-only), rarely 5+
 *  - textboxRoleCount: same
 *  - pollingCadenceMs: 0 (no polling), 1000 (fast poll), 30000 (slow poll)
 *
 * The same scaling must be applied at taxonomy resolve time so the centroid
 * vector and the input vector use the same scale.
 */
const NORMALIZATION_PARAMS = {
  editableCount: { mean: 1.5, std: 1.5 },
  textboxRoleCount: { mean: 1.0, std: 1.0 },
  scrollableRepeatedBlockDetected: { mean: 0.5, std: 0.5 },
  ariaLandmarkRolesLength: { mean: 4, std: 3 },
  editableCountDelta: { mean: 0, std: 1 },
  textboxRoleCountDelta: { mean: 0, std: 1 },
  appendedBlockCount: { mean: 1, std: 2 },
  replacedBlockCount: { mean: 0, std: 0.5 },
  sseResponseCount: { mean: 0.5, std: 1.5 },
  websocketUpgradeDetected: { mean: 0.3, std: 0.5 },
  pollingCadenceMs: { mean: 1500, std: 2000 },
  hasReactRoot: { mean: 0.5, std: 0.5 },
  hasNextData: { mean: 0.3, std: 0.5 },
  hasVueApp: { mean: 0.1, std: 0.3 },
} as const

function zScore(value: number, params: { mean: number; std: number }): number {
  if (params.std === 0) return 0
  return (value - params.mean) / params.std
}

/**
 * Flatten the structured vector into a numeric array for cosine comparison.
 * Tier E F-3 — applies per-dimension z-score normalization so no single
 * dimension dominates the cosine score.
 *
 * Audit ❌-5 fix — discrete boolean framework signals (3 cols) replace the
 * 2-value enum that collapsed svelte+unknown.
 */
export function toNumericVector(v: WebAppFingerprintVector): number[] {
  return [
    zScore(v.domShape.editableCount, NORMALIZATION_PARAMS.editableCount),
    zScore(v.domShape.textboxRoleCount, NORMALIZATION_PARAMS.textboxRoleCount),
    zScore(
      v.domShape.scrollableRepeatedBlockDetected ? 1 : 0,
      NORMALIZATION_PARAMS.scrollableRepeatedBlockDetected,
    ),
    zScore(v.domShape.ariaLandmarkRoles.length, NORMALIZATION_PARAMS.ariaLandmarkRolesLength),
    // 🚀-1 temporal axis — included in numeric vector so cosine picks up deltas.
    zScore(v.domDeltaShape.editableCountDelta, NORMALIZATION_PARAMS.editableCountDelta),
    zScore(v.domDeltaShape.textboxRoleCountDelta, NORMALIZATION_PARAMS.textboxRoleCountDelta),
    zScore(v.domDeltaShape.appendedBlockCount, NORMALIZATION_PARAMS.appendedBlockCount),
    zScore(v.domDeltaShape.replacedBlockCount, NORMALIZATION_PARAMS.replacedBlockCount),
    zScore(v.networkShape.sseResponseCount, NORMALIZATION_PARAMS.sseResponseCount),
    zScore(
      v.networkShape.websocketUpgradeDetected ? 1 : 0,
      NORMALIZATION_PARAMS.websocketUpgradeDetected,
    ),
    zScore(v.networkShape.pollingCadenceMs ?? 0, NORMALIZATION_PARAMS.pollingCadenceMs),
    // ❌-5 fix — 3 discrete framework signals (was 2 one-hots).
    zScore(v.frameworkShape.hasReactRoot ? 1 : 0, NORMALIZATION_PARAMS.hasReactRoot),
    zScore(v.frameworkShape.hasNextData ? 1 : 0, NORMALIZATION_PARAMS.hasNextData),
    zScore(v.frameworkShape.hasVueApp ? 1 : 0, NORMALIZATION_PARAMS.hasVueApp),
  ]
}
