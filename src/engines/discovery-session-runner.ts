// src/engines/discovery-session-runner.ts
// DiscoverySessionRunner — Phase 23.4
// Orchestrates a full logged-in provider discovery session end-to-end:
//   launch logged-in profile -> navigate -> probe message -> capture stream
//   -> align parser -> persist manifest draft.
// All browser I/O goes through ChromeGovernor (Governor Canon). The stream
// capturer is injected so the runner is testable with a mocked CDP surface.

import { EngineError } from '../errors.js'
import type { ChromeGovernor } from './chrome-governor.js'
import type { ProviderDiscoveryEngine, DiscoverySession } from './provider-discovery.js'
import type { StreamParserEngine } from './stream-parser.js'
import type { StreamAlignmentEngine, AlignmentReport, StreamFormat } from './stream-align.js'
import { typeMessage, submitMessage, type ComposerType } from './composer-typing.js'

export interface CaptureOptions {
  urlPattern: string
  timeoutMs: number
  maxSamples?: number
}

/**
 * Stream capture must be armed *before* the probe message fires (the tap has to
 * be installed before the provider's fetch), then collected afterwards.
 */
export interface StreamCapturer {
  arm(slaveId: string, opts: CaptureOptions): Promise<void>
  collect(slaveId: string, opts: CaptureOptions): Promise<string[]>
}

export interface RunSessionInput {
  providerId: string
  accountId?: string
  url: string
  profileDir?: string
  probeMessage?: string
  composerSelector?: string
  composerType?: ComposerType
  sendSelector?: string
  timeoutMs?: number
}

export interface RunSessionResult {
  session: DiscoverySession
  alignment: AlignmentReport
}

const DEFAULT_COMPOSER = 'textarea, [role="textbox"], [contenteditable]'

export class DiscoverySessionRunner {
  constructor(
    private readonly deps: {
      governor: ChromeGovernor
      discovery: ProviderDiscoveryEngine
      streamParser: StreamParserEngine
      align: StreamAlignmentEngine
      captureStream: StreamCapturer
    },
  ) {}

  async runSession(input: RunSessionInput): Promise<RunSessionResult> {
    const {
      providerId,
      accountId = 'default',
      url,
      profileDir,
      probeMessage = 'Say the word "pong" and nothing else.',
      composerSelector = DEFAULT_COMPOSER,
      composerType = 'textarea',
      sendSelector,
      timeoutMs = 20_000,
    } = input

    // 1. Launch the logged-in profile (Governor Canon: only governor touches CDP).
    const slave = await this.deps.governor.ensureRunningForAccount(providerId, accountId, {
      profileDir,
    })
    const slaveId = slave.slaveId

    // 2. Create + navigate the discovery session.
    const session = await this.deps.discovery.createSession(url, { providerNameHint: providerId })
    await this.deps.discovery.navigate(session.id, url)

    // 3. Snapshot + shape match.
    const shape = await this.deps.discovery.matchShape(session.id)
    if (shape) {
      await this.deps.discovery.updateSession(session.id, {
        shapeId: shape.shapeId,
        confidence: shape.confidence,
      })
    }

    const caps = await this.deps.discovery.inferCapabilities(session.id)
    await this.deps.discovery.updateSession(session.id, {
      detectedCapabilities: caps.map((c) => c.slug),
    })

    // 4. Arm the stream tap, then probe: type + submit a message.
    const captureOpts: CaptureOptions = { urlPattern: new URL(url).hostname, timeoutMs }
    await this.deps.captureStream.arm(slaveId, captureOpts)
    await typeMessage(this.deps.governor.cdp, slaveId, composerSelector, probeMessage, composerType)
    await submitMessage(this.deps.governor.cdp, slaveId, sendSelector)

    // 5. Collect the captured live stream.
    const bodies = await this.deps.captureStream.collect(slaveId, captureOpts)

    // 6. Align the captured stream against the parser.
    const alignment = await this.deps.align.alignCaptured(bodies, providerId, this.toFormat(session.parserFormat))

    // 7. Persist + emit manifest draft.
    await this.deps.discovery.updateSession(session.id, {
      status: 'complete',
      parserFormat: alignment.inferredFormat,
      confidence: alignment.confidence,
    })
    const finalSession = await this.deps.discovery.getSession(session.id)
    if (!finalSession) throw new EngineError(`Discovery session ${session.id} vanished`)

    const manifest = await this.deps.discovery.generateManifest(session.id)
    await this.deps.discovery.updateSession(session.id, { manifestDraft: manifest })

    return { session: await this.deps.discovery.getSession(session.id)!, alignment }
  }

  private toFormat(value: string | null | undefined): StreamFormat | null {
    if (!value) return null
    const allowed: StreamFormat[] = ['sse', 'json', 'html', 'websocket', 'custom']
    return (allowed as string[]).includes(value) ? (value as StreamFormat) : null
  }
}
