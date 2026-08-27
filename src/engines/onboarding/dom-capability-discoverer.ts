// src/engines/onboarding/dom-capability-discoverer.ts
// Stage 4 — Guided Interaction Probing (GIP).
// See FINAL-UPGRADE-DESIGN.md §2.2 for design rationale.
//
// Audit-aware upgrades baked in:
//  - ❌-2 (source): real `snapshotResponses()` reading from caller-supplied
//    captured events, NOT a stub returning `{ responses: [], wsFrames: [] }`
//    (which would force classifyTransport to always return dom_mutation_only).
//  - 🚀-4 info-theoretic probe selection: probe text picked from the taxonomy's
//    `probeLibrary` rather than always the canned "vivim-onboarding-probe".

import { ulid } from 'ulid'
import type { DiscoveredDomEntityStoreContract } from '../../storage/contracts/onboarding/discovered-dom-entity-store.js'
import {
  type CapturedResponse,
  type CapturedWsFrame,
  classifyTransport,
} from './protocol-sniffer.js'
import type { GovernorHandleLike, ProtocolFingerprintResult } from './types.js'

const FIND_AFFORDANCES_JS = `(() => {
  const inputs = Array.from(document.querySelectorAll('[contenteditable="true"], textarea, [role="textbox"]'));
  const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
    .filter(b => /send|submit|ask|go/i.test(b.textContent || b.getAttribute('aria-label') || ''));
  const containers = Array.from(document.querySelectorAll('[role="log"], [aria-live], main'));
  const toSelector = (el) => {
    if (el.id) return '#' + el.id;
    const attrs = ['data-testid', 'aria-label', 'role'];
    for (const a of attrs) {
      const v = el.getAttribute(a);
      if (v) return '[' + a + '="' + v + '"]';
    }
    return el.tagName.toLowerCase();
  };
  return {
    inputs: inputs.map(toSelector),
    sendControls: buttons.map(toSelector),
    containers: containers.map(toSelector),
  };
})()`

const DEFAULT_PROBE_TEXT = 'vivim-onboarding-probe'

export interface DiscoverySessionResult {
  entities: Array<{ role: string; selector: string; confidence: number }>
  protocol: ProtocolFingerprintResult
  responseSamples: string[]
  /** Real ProtocolFingerprint ID (audit ❌-3 fix — was sessionId before). */
  protocolFingerprintId: string | null
}

/**
 * Captured network events supplied by the caller (typically the orchestrator
 * reading from a capability-event-bus ring buffer for this slave). Replaces
 * the source MD's `snapshotResponses()` stub.
 */
export interface CapturedEvents {
  responses: CapturedResponse[]
  wsFrames: CapturedWsFrame[]
}

export class DomCapabilityDiscoverer {
  constructor(private readonly entityStore: DiscoveredDomEntityStoreContract) {}

  async discover(
    handle: GovernorHandleLike,
    sessionId: string,
    captured: CapturedEvents,
    probeLibrary?: string[],
  ): Promise<DiscoverySessionResult> {
    await handle.send('Network.enable').catch(() => {})
    await handle.send('Page.enable').catch(() => {})

    const affordances = await handle.evaluate<{
      inputs: string[]
      sendControls: string[]
      containers: string[]
    }>(FIND_AFFORDANCES_JS)

    await this.persistCandidates(sessionId, affordances)

    const inputSelector = affordances.inputs[0]
    const sendSelector = affordances.sendControls[0]
    if (!inputSelector || !sendSelector) {
      // No interactive surface found -> DOM-mutation-only or read-only page.
      const protocol: ProtocolFingerprintResult = {
        transportClass: 'dom_mutation_only',
        endpointPattern: null,
        sampleHeaders: null,
        cadenceMs: null,
        confidence: 0.4,
      }
      return {
        entities: this.toEntitySummaries(affordances),
        protocol,
        responseSamples: [],
        protocolFingerprintId: null,
      }
    }

    // 🚀-4 info-theoretic probe selection — pick the first probe from the
    // taxonomy's library (caller-sorted by expected information gain). Falls
    // back to the canned probe if no library is supplied.
    const probeText = probeLibrary?.[0] ?? DEFAULT_PROBE_TEXT

    // Snapshot response count before the probe.
    const responsesBefore = captured.responses.length

    // Inject the probe text and fire the send control.
    await handle.evaluate(
      `(() => {
        const el = document.querySelector(${JSON.stringify(inputSelector)});
        if (!el) return false;
        el.focus();
        document.execCommand('insertText', false, ${JSON.stringify(probeText)});
        return true;
      })()`,
    )

    await handle.evaluate(
      `(() => {
        const btn = document.querySelector(${JSON.stringify(sendSelector)});
        if (btn) btn.click();
      })()`,
    )

    const samples = await this.collectSamplesWithTimeout(handle, 4000)

    // Compute the protocol from the responses captured *after* the probe.
    const newResponses = captured.responses.slice(responsesBefore)
    const protocol = classifyTransport(newResponses, captured.wsFrames)

    return {
      entities: this.toEntitySummaries(affordances),
      protocol,
      responseSamples: samples,
      // Caller (orchestrator) creates the ProtocolFingerprint row and passes
      // back the real id; we return null here so the orchestrator can fill it in.
      protocolFingerprintId: null,
    }
  }

  private toEntitySummaries(affordances: {
    inputs: string[]
    sendControls: string[]
    containers: string[]
  }): Array<{ role: string; selector: string; confidence: number }> {
    return [
      ...affordances.inputs.map((s) => ({ role: 'input', selector: s, confidence: 0.7 })),
      ...affordances.sendControls.map((s) => ({
        role: 'send_control',
        selector: s,
        confidence: 0.7,
      })),
      ...affordances.containers.map((s) => ({
        role: 'stream_region',
        selector: s,
        confidence: 0.6,
      })),
    ]
  }

  private async persistCandidates(
    sessionId: string,
    affordances: { inputs: string[]; sendControls: string[]; containers: string[] },
  ): Promise<void> {
    const rows = this.toEntitySummaries(affordances)
    for (const row of rows) {
      await this.entityStore.create({
        id: ulid(),
        sessionId,
        role: row.role,
        selectorJson: JSON.stringify({ css: row.selector }),
        confidence: row.confidence,
        status: 'prospect',
      })
    }
  }

  private async collectSamplesWithTimeout(
    handle: GovernorHandleLike,
    timeoutMs: number,
  ): Promise<string[]> {
    const deadline = Date.now() + timeoutMs
    const samples: string[] = []
    while (Date.now() < deadline && samples.length < 8) {
      const text = await handle.evaluate<string>(
        `(document.querySelector('[role="log"], main')?.textContent || '').slice(-2000)`,
      )
      if (text && text !== samples[samples.length - 1]) samples.push(text)
      await new Promise((r) => setTimeout(r, 250))
    }
    return samples
  }
}
