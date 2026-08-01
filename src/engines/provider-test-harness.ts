// src/engines/provider-test-harness.ts
// Unit 6.10 — Provider test harness
// Automated per-provider integration test that exercises each declared capability
// against the live site or an API mock.

import { newId } from '../ids.js'
import type {
  CapabilityBindingMatrixRow,
  CapabilityStore,
} from '../storage/contracts/capability-store.js'
import { CapabilityEventBus } from './capability-event-bus.js'
import type { ChromeGovernor } from './chrome-governor.js'

export interface HarnessOutcome {
  providerId: string
  capabilitySlug: string
  ok: boolean
  error?: string
  drift: boolean
}

export class ProviderTestHarness {
  constructor(
    private capStore: CapabilityStore,
    private governor: ChromeGovernor,
    private bus: CapabilityEventBus = CapabilityEventBus.getInstance(),
  ) {}

  async runAll(providers?: string[]): Promise<HarnessOutcome[]> {
    const bindings = await this.capStore.listBindings(providers)
    const outcomes: HarnessOutcome[] = []
    for (const b of bindings) {
      const outcome = await this.runOne(b)
      outcomes.push(outcome)
      if (outcome.drift) {
        await this.capStore.recordDrift({
          id: newId(),
          providerId: b.providerId,
          capabilitySlug: b.capabilitySlug,
          selector: b.selector,
          status: 'open',
        })
        this.bus.emit({
          type: 'provider:drift_detected',
          providerId: b.providerId,
          capabilitySlug: b.capabilitySlug,
        })
      }
    }
    return outcomes
  }

  private async runOne(b: CapabilityBindingMatrixRow): Promise<HarnessOutcome> {
    try {
      const slave = await this.governor.spawn(b.providerId, 'test', { visible: false })
      const res = await this.governor.cdp.send(slave.slaveId, 'Runtime.evaluate', {
        expression: `!!document.querySelector(${JSON.stringify(b.selector)})`,
        returnByValue: true,
      })
      const present = Boolean((res as { result?: { value?: boolean } }).result?.value)
      return {
        providerId: b.providerId,
        capabilitySlug: b.capabilitySlug,
        ok: present,
        drift: !present,
      }
    } catch (err) {
      return {
        providerId: b.providerId,
        capabilitySlug: b.capabilitySlug,
        ok: false,
        drift: false,
        error: String(err),
      }
    }
  }
}
