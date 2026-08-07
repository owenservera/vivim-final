// src/server/onboarding-boot.ts
// Onboarding pipeline boot wiring.
//
// Closes SOTA-AUDIT-V2 §2.2 Gap O-1 (orchestrator unreachable from any surface)
// and Gap O-2 (no live event capturer). Constructs all onboarding engines +
// stores, then registers the orchestrator in the ServiceContainer so the
// `vivim onboard` CLI command can resolve it.
//
// Called from src/server/index.ts after the governor + providerStore + db
// come up. Idempotent: safe to call multiple times (the ServiceContainer
// throws on duplicate registration, which we swallow as a no-op signal).

import type { ChromeGovernor } from '../engines/chrome-governor.js'
import { LiveNetworkCapturer } from '../engines/onboarding/live-network-capturer.js'
import { ProviderOnboardingOrchestrator } from '../engines/onboarding/provider-onboarding-orchestrator.js'
import type { CapStoreDb } from '../storage/db.js'
import { CapabilityBindingStoreImpl } from '../storage/impl/onboarding/capability-binding-store-impl.js'
import { DiscoveredDomEntityStoreImpl } from '../storage/impl/onboarding/discovered-dom-entity-store-impl.js'
import { OnboardingSessionStoreImpl } from '../storage/impl/onboarding/onboarding-session-store-impl.js'
import { ParserCandidateStoreImpl } from '../storage/impl/onboarding/parser-candidate-store-impl.js'
import { ProtocolFingerprintStoreImpl } from '../storage/impl/onboarding/protocol-fingerprint-store-impl.js'
import { WebAppTaxonomyStoreImpl } from '../storage/impl/onboarding/webapp-taxonomy-store-impl.js'
import { serviceContainer } from './service-container.js'

/**
const log = getLogger('server:onboarding boot')
 * Construct + register the onboarding orchestrator in the ServiceContainer.
 * Called once from src/server/index.ts boot.
 *
 * Returns the orchestrator instance (mostly for test inspection).
 */
export async function bootOnboardingPipeline(
  governor: ChromeGovernor,
  db: CapStoreDb,
  providerStore?: import('../storage/contracts/provider-store.js').ProviderStore,
): Promise<ProviderOnboardingOrchestrator | null> {
  // Idempotent — if already registered, return the existing instance.
  if (serviceContainer.has('onboardingOrchestrator')) {
    return serviceContainer.resolve<ProviderOnboardingOrchestrator>('onboardingOrchestrator')
  }

  try {
    const capturer = new LiveNetworkCapturer(governor)

    const orchestrator = new ProviderOnboardingOrchestrator({
      handleProvider: {
        getHandle: (slaveId: string) => {
          // GovernorHandleLike wrapper around the governor's CDP proxy.
          // The orchestrator engines call handle.send(method, params) and
          // handle.evaluate(expr) — both forward through the governor's CDP.
          return {
            slaveId,
            send: (method: string, params?: Record<string, unknown>) =>
              governor.cdp.send(slaveId, method, params),
            evaluate: async <T>(expression: string): Promise<T> => {
              const result = (await governor.cdp.send(slaveId, 'Runtime.evaluate', {
                expression,
                returnByValue: true,
                awaitPromise: true,
              })) as { result?: { value?: T } }
              return result.result?.value as T
            },
          }
        },
      },
      sessions: new OnboardingSessionStoreImpl(db),
      taxonomyStore: new WebAppTaxonomyStoreImpl(db),
      protocolFingerprintStore: new ProtocolFingerprintStoreImpl(db),
      entityStore: new DiscoveredDomEntityStoreImpl(db),
      parserCandidateStore: new ParserCandidateStoreImpl(db),
      bindingStore: new CapabilityBindingStoreImpl(db),
      captureEvents: (slaveId: string, durationMs: number) => capturer.capture(slaveId, durationMs),
      // Tier C (X-4) — providerStore, used to upsert the ProviderDefinition row
      // at Stage 7. Optional: if absent, sessions end in 'promoted' rather than
      // 'registered'.
      providerStore,
    })

    serviceContainer.register('onboardingOrchestrator', orchestrator)
    return orchestrator
  } catch (err) {
    // Best-effort — onboarding is optional. If construction fails (e.g. a
    // store impl throws), log and continue without the orchestrator.
    log.warn('[boot] onboarding pipeline not available:', err)
    return null
  }
}
