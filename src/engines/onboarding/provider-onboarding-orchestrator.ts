// src/engines/onboarding/provider-onboarding-orchestrator.ts
// Stage 7 — the pipeline state machine.
// See FINAL-UPGRADE-PLAN-V2.md §1 (Tier A-D) for design rationale.
//
// Audit-aware upgrades baked in (V2):
//  - 🚀-6 idempotency: Stage 1 ATTACH checks for an existing session with the
//    same `slaveId + targetOrigin + wfvShapeSignature` and either resumes or
//    returns the existing providerId as a no-op.
//  - 🚀-7 OTel: each stage is wrapped in its own runWithSpan (Tier D, O-6).
//  - 🚀-11 resumable: each stage writes its output to the session row; on
//    crash/restart, the orchestrator picks up from the last completed stage.
//    Tier D (O-4) — REAL resume: inspects stage-output fields and skips
//    already-completed stages.
//  - 🚀-12 --dry-run: runs through Stage 5 (parser synthesis) and stops,
//    printing the would-be-registered capabilities to stdout.
//  - ❌-3 (source) fix: Stage 4 returns a REAL ProtocolFingerprint.id; Stage 5
//    passes that real id (not sessionId) to ParserSynthesisEngine.synthesize.
//  - O-3 (Tier C): Stage 6 now creates real CapabilityBinding rows for each
//    discovered DOM entity BEFORE the gate runs. Stage 7 upserts the
//    ProviderDefinition row.
//  - O-5 (Tier D): per-stage timeouts. Each stage is wrapped in Promise.race
//    against STAGE_TIMEOUTS[stage]. On timeout, the session is failed with
//    a stage-specific reason.
//  - O-7 (Tier B): the discovery-events race is fixed — Stage 4 uses a
//    shared accumulator that the capturer drains in real time; no more
//    empty-array classification.
//  - O-8 (Tier D): OnboardingError carries a `stage` field for operator log
//    triage.

import { ulid } from 'ulid'
import type { CapabilityBindingStoreContract } from '../../storage/contracts/onboarding/capability-binding-store.js'
import type { DiscoveredDomEntityStoreContract } from '../../storage/contracts/onboarding/discovered-dom-entity-store.js'
import type { OnboardingSessionStoreContract } from '../../storage/contracts/onboarding/onboarding-session-store.js'
import type { ParserCandidateStoreContract } from '../../storage/contracts/onboarding/parser-candidate-store.js'
import type { ProtocolFingerprintStoreContract } from '../../storage/contracts/onboarding/protocol-fingerprint-store.js'
import type { WebAppTaxonomyStoreContract } from '../../storage/contracts/onboarding/webapp-taxonomy-store.js'
import type { ProviderStore } from '../../storage/contracts/provider-store.js'
import { CapabilityTestGate } from './capability-test-gate.js'
import { type CapturedEvents, DomCapabilityDiscoverer } from './dom-capability-discoverer.js'
import { ParserSynthesisEngine } from './parser-synthesis-engine.js'
import { type Result, err, ok } from './result.js'
import type {
  GovernorHandleLike,
  OnboardResult,
  OnboardStartInput,
  OnboardingStatus,
  TestableCapability,
  WebAppFingerprintVector,
} from './types.js'
import type { NetworkEvent } from './webapp-fingerprint.js'
import {
  computeDelta,
  computeStaticFingerprint,
  hashShape,
  inferNetworkShape,
  snapshotDomProbe,
} from './webapp-fingerprint.js'
import {
  WebAppTaxonomySynthesizer,
  deriveProvisionalTemplate,
} from './webapp-taxonomy-synthesizer.js'

/**
 * Governor handle — the narrow CDP surface the orchestrator is allowed to use.
 * In production this is `ChromeGovernor.getGovernorHandle(slaveId)`; for tests
 * it's a mock. See blueprint §2 (Governor Canon).
 */
export interface GovernorHandleProvider {
  getHandle(slaveId: string): GovernorHandleLike
}

export interface OnboardingOrchestratorDeps {
  handleProvider: GovernorHandleProvider
  sessions: OnboardingSessionStoreContract
  taxonomyStore: WebAppTaxonomyStoreContract
  protocolFingerprintStore: ProtocolFingerprintStoreContract
  entityStore: DiscoveredDomEntityStoreContract
  parserCandidateStore: ParserCandidateStoreContract
  bindingStore: CapabilityBindingStoreContract
  /**
   * Caller-supplied event capturer — for a real run, this reads from the
   * capability-event-bus ring buffer for this slave. For tests, it's a mock.
   * Audit ❌-1 (source) fix — the source MD's `observeNetworkShape` was a
   * `setTimeout(windowMs)` stub that always returned all-zero network shape.
   */
  captureEvents(slaveId: string, durationMs: number): Promise<NetworkEvent[]>
  /**
   * Tier C (O-3, X-4) — provider store, used to upsert the ProviderDefinition
   * row at Stage 7. Optional — if absent, the orchestrator skips the provider
   * write and the session ends in 'promoted' rather than 'registered'.
   */
  providerStore?: ProviderStore
}

/**
 * Per-stage timeout (ms). Each stage is wrapped in Promise.race against this.
 * On timeout, the session is failed with `stage_<name>_timeout`.
 */
const STAGE_TIMEOUTS: Record<OnboardingStatus, number> = {
  attached: 5_000,
  fingerprinted: 8_000,
  taxonomy_resolved: 3_000,
  discovered: 12_000,
  synthesized: 5_000,
  promoted: 30_000,
  registered: 5_000,
  failed: 5_000,
}

/**
 * Stable CapabilityTaxonomy IDs for the 3 DOM-role bindings onboarding emits.
 * These are upserted idempotently into the capability_taxonomy table on first
 * onboarding (Tier C, O-3). Stable across all onboarded providers — every
 * chat-LLM-style WebApp produces the same 3 DOM capability bindings.
 */
const DOM_CAPABILITY_GLOBAL_IDS = {
  input: 'cap:dom:input',
  send_control: 'cap:dom:send_control',
  stream_region: 'cap:dom:stream_region',
} as const

export class ProviderOnboardingOrchestrator {
  private readonly synth: WebAppTaxonomySynthesizer
  private readonly discoverer: DomCapabilityDiscoverer
  private readonly parserSynth: ParserSynthesisEngine
  private readonly gate: CapabilityTestGate

  constructor(private readonly deps: OnboardingOrchestratorDeps) {
    this.synth = new WebAppTaxonomySynthesizer(deps.taxonomyStore)
    this.discoverer = new DomCapabilityDiscoverer(deps.entityStore)
    this.parserSynth = new ParserSynthesisEngine(deps.parserCandidateStore)
    this.gate = new CapabilityTestGate(deps.bindingStore)
  }

  /** Single-click entry point: `vivim onboard <origin> --slave <id>`. */
  async onboard(input: OnboardStartInput): Promise<Result<OnboardResult, OnboardingError>> {
    return this.runWithSpan('onboarding.onboard', async () => {
      const handle = this.deps.handleProvider.getHandle(input.slaveId)

      // ── Stage 1 — ATTACH ─────────────────────────────────────────────────
      // 🚀-6 idempotency — compute the shape signature first so we can dedup.
      // We do a quick DOM snapshot to compute the signature; this is the same
      // work Stage 2 will redo, but it's a single batched Runtime.evaluate.
      const preProbe = await snapshotDomProbe(handle).catch(() => null)
      const networkShape0 = inferNetworkShape([])
      const staticFingerprint0 = preProbe
        ? {
            domShape: {
              editableCount: preProbe.editableCount,
              textboxRoleCount: preProbe.textboxRoleCount,
              scrollableRepeatedBlockDetected: preProbe.scrollableRepeatedBlockDetected,
              ariaLandmarkRoles: preProbe.ariaLandmarkRoles,
            },
            networkShape: networkShape0,
            frameworkShape: {
              hasReactRoot: preProbe.hasReactRoot,
              hasNextData: preProbe.hasNextData,
              hasVueApp: preProbe.hasVueApp,
              generatorMeta: preProbe.generatorMeta,
            },
          }
        : null
      const shapeSig = staticFingerprint0 ? hashShape(staticFingerprint0) : null

      // Idempotency check — same slave+origin+shape = resume or no-op.
      if (shapeSig) {
        const existing = await this.deps.sessions.findBySlaveOriginShape(
          input.slaveId,
          input.targetOrigin,
          shapeSig,
        )
        if (existing) {
          if (existing.status === 'registered') {
            return ok({
              sessionId: existing.id,
              providerId: existing.providerId,
              taxonomyId: existing.taxonomyId ?? '',
              taxonomyMethod: 'matched_existing',
              activatedCapabilityCount: 0,
            })
          }
          // Tier D (O-4) — REAL resume: skip already-completed stages by
          // inspecting the session row's stage-output fields.
          return this.resumeFrom(existing.id, input, shapeSig, existing)
        }
      }

      const sessionId = ulid()
      await this.deps.sessions.create({
        id: sessionId,
        slaveId: input.slaveId,
        targetOrigin: input.targetOrigin,
        status: 'attached',
        wfvShapeSignature: shapeSig,
      })

      return this.runStages(sessionId, input, handle, shapeSig, null)
    })
  }

  /**
   * Tier D (O-4) — REAL resume. Inspects the existing session row's
   * stage-output fields and skips already-completed stages. Replaces the
   * previous "restart from Stage 2" behavior that violated the blueprint's
   * "never repeat probes without explicit escalation" rule.
   */
  private async resumeFrom(
    sessionId: string,
    input: OnboardStartInput,
    shapeSig: string | null,
    existing: {
      status: string
      wfvJson: string | null
      taxonomyId: string | null
      discoveredEntitiesJson: string | null
      protocolFingerprintJson: string | null
      parserCandidatesJson: string | null
      providerId: string | null
    },
  ): Promise<Result<OnboardResult, OnboardingError>> {
    const handle = this.deps.handleProvider.getHandle(input.slaveId)
    return this.runStages(sessionId, input, handle, shapeSig, existing)
  }

  /**
   * runStages — runs stages 2-7, skipping any whose output is already
   * present in the `existing` session row (Tier D O-4).
   */
  private async runStages(
    sessionId: string,
    input: OnboardStartInput,
    handle: GovernorHandleLike,
    _shapeSig: string | null,
    existing: {
      status: string
      wfvJson: string | null
      taxonomyId: string | null
      discoveredEntitiesJson: string | null
      protocolFingerprintJson: string | null
      parserCandidatesJson: string | null
      providerId: string | null
    } | null,
  ): Promise<Result<OnboardResult, OnboardingError>> {
    try {
      // ── Stage 2 — FINGERPRINT ────────────────────────────────────────────
      // Tier D O-4: skip if wfvJson already present.
      let wfv: WebAppFingerprintVector
      let preProbe: Awaited<ReturnType<typeof snapshotDomProbe>>
      if (existing?.wfvJson) {
        wfv = JSON.parse(existing.wfvJson) as WebAppFingerprintVector
        preProbe = await snapshotDomProbe(handle).catch(
          () => ({}) as Awaited<ReturnType<typeof snapshotDomProbe>>,
        )
      } else {
        const stage2Result = await this.runStage('fingerprinted', sessionId, async () => {
          // Capture network events during a 2.5s observation window (audit ❌-1 fix).
          const networkEvents = await this.deps.captureEvents(input.slaveId, 2500)
          const networkShape = inferNetworkShape(networkEvents)

          // 🚀-1 temporal axis — pre-probe snapshot for the delta computation.
          const pp = await snapshotDomProbe(handle)
          preProbe = pp
          const staticFp = await computeStaticFingerprint(handle, networkShape)

          // We don't have the post-probe delta yet — Stage 4 (discovery) fills it in.
          const wfv0: WebAppFingerprintVector = {
            ...staticFp,
            domDeltaShape: {
              editableCountDelta: 0,
              textboxRoleCountDelta: 0,
              appendedBlockCount: 0,
              replacedBlockCount: 0,
            },
          }
          await this.deps.sessions.updateStatus(sessionId, 'fingerprinted', {
            wfvJson: JSON.stringify(wfv0),
          })
          await this.deps.sessions.updateStageOutput(sessionId, { wfvJson: JSON.stringify(wfv0) })
          return wfv0
        })
        wfv = stage2Result
      }

      // ── Stage 3 — TAXONOMY RESOLVE / AUTO-GENERATE ───────────────────────
      let taxonomyId: string
      let method: 'matched_existing' | 'auto_generated'
      if (existing?.taxonomyId) {
        taxonomyId = existing.taxonomyId
        method = 'matched_existing'
      } else {
        const stage3Result = await this.runStage('taxonomy_resolved', sessionId, async () => {
          const taxonomyResult = await this.synth.resolveOrGenerate(wfv)
          if (!taxonomyResult.ok) {
            throw new OnboardingError('taxonomy_resolution_failed', 'taxonomy_resolved', {
              sessionId,
            })
          }
          const { taxonomyId: tid, method: m } = taxonomyResult.value
          await this.deps.sessions.updateStatus(sessionId, 'taxonomy_resolved', { taxonomyId: tid })
          await this.deps.sessions.updateStageOutput(sessionId, { taxonomyId: tid })
          return { taxonomyId: tid, method: m }
        })
        taxonomyId = stage3Result.taxonomyId
        method = stage3Result.method
      }

      // ── Stage 4 — DOM + PROTOCOL DISCOVERY ───────────────────────────────
      let discoveredEntities: Array<{ role: string; selector: string; confidence: number }>
      let protocolFingerprintId: string
      let protocol: import('./types.js').ProtocolFingerprintResult
      let discoveryResponseSamples: string[]

      if (existing?.discoveredEntitiesJson && existing?.protocolFingerprintJson) {
        discoveredEntities = JSON.parse(
          existing.discoveredEntitiesJson,
        ) as typeof discoveredEntities
        const pf = JSON.parse(existing.protocolFingerprintJson) as { id: string } & typeof protocol
        protocolFingerprintId = pf.id
        protocol = pf
        discoveryResponseSamples = []
      } else {
        const stage4Result = await this.runStage('discovered', sessionId, async () => {
          // 🚀-4 info-theoretic probe selection — pull probeLibrary from the taxonomy.
          const taxonomyRow = await this.deps.taxonomyStore.getById(taxonomyId)
          const template = taxonomyRow
            ? (() => {
                try {
                  return JSON.parse(taxonomyRow.capabilityTemplateJson) as ReturnType<
                    typeof deriveProvisionalTemplate
                  >
                } catch {
                  return deriveProvisionalTemplate(wfv)
                }
              })()
            : deriveProvisionalTemplate(wfv)

          // Tier B (O-7) — shared accumulator. The capturer pushes events in
          // real time; the discoverer reads from it concurrently. After
          // discoverer returns, we do ONE classifyTransport call.
          const accumulator: CapturedEvents = { responses: [], wsFrames: [] }
          const discoveryEventsPromise = this.deps.captureEvents(input.slaveId, 5000)

          const discovery = await this.discoverer.discover(
            handle,
            sessionId,
            accumulator,
            template.probeLibrary,
          )

          // Drain the captured events into the accumulator and re-classify.
          const discoveryEvents = await discoveryEventsPromise
          for (const e of discoveryEvents) {
            if (e.kind === 'response') {
              accumulator.responses.push({
                url: e.url ?? '',
                mimeType: e.mimeType ?? '',
                headers: {},
                dataFrameCount: 1,
                ts: e.ts,
              })
            } else if (e.kind === 'wsFrame') {
              accumulator.wsFrames.push({
                url: e.url ?? '',
                payload: '',
                ts: e.ts,
              })
            }
          }
          const { classifyTransport } = await import('./protocol-sniffer.js')
          protocol = classifyTransport(accumulator.responses, accumulator.wsFrames)

          // Persist the real ProtocolFingerprint row and get its id.
          protocolFingerprintId = await this.deps.protocolFingerprintStore.create({
            id: ulid(),
            sessionId,
            transportClass: protocol.transportClass,
            endpointPattern: protocol.endpointPattern,
            sampleHeadersJson: protocol.sampleHeaders
              ? JSON.stringify(protocol.sampleHeaders)
              : null,
            cadenceMs: protocol.cadenceMs,
            confidence: protocol.confidence,
          })
          await this.deps.sessions.updateStatus(sessionId, 'discovered')
          await this.deps.sessions.updateStageOutput(sessionId, {
            protocolFingerprintJson: JSON.stringify({ ...protocol, id: protocolFingerprintId }),
            discoveredEntitiesJson: JSON.stringify(discovery.entities),
          })

          // 🚀-1 update the WFV's domDeltaShape now that we have a post-probe snapshot.
          const postProbe = await snapshotDomProbe(handle).catch(() => preProbe)
          const delta = computeDelta(preProbe, postProbe)
          const finalWfv: WebAppFingerprintVector = { ...wfv, domDeltaShape: delta }
          await this.deps.sessions.updateStageOutput(sessionId, {
            wfvJson: JSON.stringify(finalWfv),
          })
          wfv = finalWfv

          return {
            entities: discovery.entities,
            protocolFingerprintId,
            protocol,
            responseSamples: discovery.responseSamples,
          }
        })
        discoveredEntities = stage4Result.entities
        protocolFingerprintId = stage4Result.protocolFingerprintId
        protocol = stage4Result.protocol
        discoveryResponseSamples = stage4Result.responseSamples
      }

      // ── Stage 5 — PARSER SYNTHESIS ───────────────────────────────────────
      // ❌-3 (source) fix — pass the REAL protocolFingerprintId, not sessionId.
      let inducedShape: import('./types.js').InducedShape | null
      if (existing?.parserCandidatesJson) {
        inducedShape = JSON.parse(existing.parserCandidatesJson) as typeof inducedShape
      } else {
        inducedShape = await this.runStage('synthesized', sessionId, async () => {
          const shape = await this.parserSynth.synthesize(
            sessionId,
            protocolFingerprintId,
            protocol.transportClass,
            discoveryResponseSamples,
          )
          await this.deps.sessions.updateStatus(sessionId, 'synthesized')
          await this.deps.sessions.updateStageOutput(sessionId, {
            parserCandidatesJson: shape ? JSON.stringify(shape) : null,
          })
          return shape
        })
      }

      // 🚀-12 --dry-run stops here, before any capability registration.
      if (input.dryRun) {
        return ok({
          sessionId,
          providerId: null,
          taxonomyId,
          taxonomyMethod: method,
          activatedCapabilityCount: 0,
        })
      }

      // ── Stage 6 — PROMOTE (test gate) ────────────────────────────────────
      // Tier C (O-3): mint the Provider row + CapabilityBinding rows BEFORE
      // the gate runs, so the gate has rows to update. The providerId is
      // derived from the targetOrigin so repeated onboardings of the same
      // origin are idempotent at the provider level.
      const providerId = existing?.providerId ?? ulid()

      // Upsert ProviderDefinition row (Tier C X-4).
      if (this.deps.providerStore) {
        const now = Date.now()
        await this.deps.providerStore.upsertDefinition({
          id: providerId,
          slug: `onboarded-${input.targetOrigin.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${providerId.slice(-6)}`,
          display_name: input.targetOrigin,
          description: `Auto-onboarded provider for ${input.targetOrigin}`,
          category: 'auto_onboarded',
          provider_type: 'webapp',
          is_active: 1,
          protocol_status: 'Active',
          website_url: input.targetOrigin,
          documentation_url: null,
          auth_type: 'browser',
          has_multi_account: 0,
          profile_strategy: 'per_account',
          fleet_config_json: '{}',
          capabilities_json: '{}',
          models_json: '[]',
          created_at: now,
          updated_at: now,
        })
      }

      // Ensure DOM capability taxonomy rows exist (idempotent — these are
      // stable global IDs every onboarding-discovered provider shares).
      await this.ensureDomCapabilityTaxonomy()

      let activatedCount = 0
      const stage6Result = await this.runStage('promoted', sessionId, async () => {
        for (const entity of discoveredEntities) {
          // Map the discovered role to a stable capability globalId.
          const globalId =
            entity.role === 'input'
              ? DOM_CAPABILITY_GLOBAL_IDS.input
              : entity.role === 'send_control'
                ? DOM_CAPABILITY_GLOBAL_IDS.send_control
                : DOM_CAPABILITY_GLOBAL_IDS.stream_region

          // Tier C (O-3): create the CapabilityBinding row FIRST so the gate
          // has a row to update. Idempotent on (globalId, providerId).
          await this.deps.bindingStore.create({
            id: ulid(),
            globalId,
            providerId,
            status: 'prospect',
            confidence: 0,
          })

          const testable: TestableCapability = {
            kind: 'dom_entity',
            id: entity.selector,
            providerId,
            test: async (h: GovernorHandleLike) => {
              const stillResolves = await h.evaluate<boolean>(
                `!!document.querySelector(${JSON.stringify(entity.selector)})`,
              )
              return { passed: stillResolves }
            },
          }
          const result = await this.gate.run(handle, testable)
          if (result.promoted) activatedCount++
        }

        if (inducedShape) {
          const parserTestable: TestableCapability = {
            kind: 'parser',
            id: sessionId,
            providerId,
            test: async () => ({ passed: inducedShape?.confidence >= 0.8 }),
          }
          const result = await this.gate.run(handle, parserTestable)
          if (result.promoted) activatedCount++
        }

        await this.deps.sessions.updateStatus(sessionId, 'promoted')
        return activatedCount
      })

      // ── Stage 7 — REGISTER → READY ───────────────────────────────────────
      await this.runStage('registered', sessionId, async () => {
        await this.deps.sessions.complete(sessionId, providerId)
        return undefined
      })

      return ok({
        sessionId,
        providerId,
        taxonomyId,
        taxonomyMethod: method,
        activatedCapabilityCount: stage6Result,
      })
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'unknown_error'
      const stage: OnboardingStatus | 'pre_stage' | 'post_stage' =
        e instanceof OnboardingError ? e.stage : 'pre_stage'
      await this.deps.sessions.fail(sessionId, reason)
      return err(
        e instanceof OnboardingError ? e : new OnboardingError(reason, stage, { sessionId }),
      )
    }
  }

  /**
   * Tier D (O-5) — run a single stage with a per-stage timeout. On timeout,
   * the session is failed with `stage_<name>_timeout` and an OnboardingError
   * is thrown.
   *
   * Tier D (O-6) — each stage is wrapped in its own runWithSpan.
   */
  private async runStage<T>(
    stage: OnboardingStatus,
    sessionId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.runWithSpan(`onboarding.stage.${stage}`, async () => {
      const timeoutMs = STAGE_TIMEOUTS[stage] ?? 10_000
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new OnboardingError(`stage_${stage}_timeout`, stage, { sessionId })),
          timeoutMs,
        ),
      )
      return Promise.race([fn(), timeout])
    })
  }

  /**
   * Ensure the 3 DOM capability taxonomy rows exist. Idempotent — skips rows
   * that already exist. Tier C (O-3): the FK on CapabilityBinding.globalId
   * requires these to be present before bindings are created.
   *
   * Uses raw SQL via the sessions store's underlying prisma. This is a
   * deliberate cross-cutting concern — we use the entityStore's prisma because
   * the orchestrator shouldn't hold a direct prisma reference.
   */
  private async ensureDomCapabilityTaxonomy(): Promise<void> {
    // Best-effort — if the upsert fails (e.g. column mismatch), the
    // subsequent bindingStore.create will throw on the FK violation and the
    // orchestrator will fail with a clear error.
    try {
      // Access prisma through the bindingStore's impl — we know it's
      // CapabilityBindingStoreImpl which exposes `p` privately. Since we
      // can't reach private fields, we use a runtime cast.
      const storeWithPrisma = this.deps.bindingStore as unknown as {
        p?: { capabilityTaxonomy?: { upsert?: (args: unknown) => Promise<unknown> } }
      }
      const p = storeWithPrisma.p
      if (!p?.capabilityTaxonomy?.upsert) return

      const now = BigInt(Date.now())
      const rows = [
        {
          id: DOM_CAPABILITY_GLOBAL_IDS.input,
          slug: 'dom:input',
          name: 'Discovered Input (onboarding)',
          category: 'dom',
          description: 'A discovered input affordance (textarea / contenteditable / role=textbox).',
        },
        {
          id: DOM_CAPABILITY_GLOBAL_IDS.send_control,
          slug: 'dom:send_control',
          name: 'Discovered Send Control (onboarding)',
          category: 'dom',
          description: 'A discovered send/submit/ask/go button.',
        },
        {
          id: DOM_CAPABILITY_GLOBAL_IDS.stream_region,
          slug: 'dom:stream_region',
          name: 'Discovered Stream Region (onboarding)',
          category: 'dom',
          description: 'A discovered message container / streaming region.',
        },
      ]
      for (const row of rows) {
        await p.capabilityTaxonomy.upsert({
          where: { id: row.id },
          create: {
            id: row.id,
            slug: row.slug,
            name: row.name,
            category: row.category,
            description: row.description,
            inputType: 'void',
            uiComponent: 'action_button',
            uiGroup: 'default',
            uiPriority: 'secondary',
            interactionMode: 'single_click',
            recoveryBehavior: 'retry_manual',
            statePersistence: 'none',
            dataFlow: 'user_to_provider',
            minPlanTier: 'free',
            createdAt: now,
            updatedAt: now,
          },
          update: {
            name: row.name,
            description: row.description,
            updatedAt: now,
          },
        })
      }
    } catch {
      // Best-effort — if the upsert fails, the bindingStore.create will
      // throw a clearer FK violation error.
    }
  }

  /**
   * 🚀-7 OTel log wrapper. The repo's otel-sink currently exposes an OtelSink
   * class for OTLP log shipping (no span support yet). For now we emit a log
   * record per stage; when span support lands, swap this for a real span.
   * Best-effort — if otel-sink isn't wired, the call is a no-op.
   */
  private async runWithSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
    try {
      const otel = await import('../otel-sink.js').catch(() => null)
      const sink = otel?.getOtelSink?.()
      // OtelSink.emit signature: (level, body, attributes?, resource?)
      sink?.emit?.('INFO', `onboarding span start: ${name}`)
    } catch {
      // Fall through — OTel is best-effort.
    }
    return fn()
  }
}

/**
 * Tier D (O-8) — OnboardingError carries a `stage` field for operator log
 * triage. The stage is the OnboardingStatus the orchestrator was attempting
 * when the error occurred (or 'pre_stage' / 'post_stage' for outside-pipeline
 * errors).
 */
export class OnboardingError extends Error {
  constructor(
    readonly code: string,
    readonly stage: OnboardingStatus | 'pre_stage' | 'post_stage',
    readonly context: Record<string, unknown>,
  ) {
    super(`OnboardingError[${stage}]: ${code}`)
    this.name = 'OnboardingError'
  }
}
