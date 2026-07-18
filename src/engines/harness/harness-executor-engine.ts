// src/engines/harness/harness-executor-engine.ts
// Unit 23.1 - Harness executor engine.
// The cap-store "program -> recipe -> CDP injection" boundary. The actual CDP
// injection happens ONLY inside ChromeGovernor.executeHarnessPlan (Governor
// Canon). This engine: resolves the best program, compiles it to a HarnessDAG,
// gates on the circuit state, executes under a timeout, reconstructs captured
// content, emits stream blocks, and records the outcome.

import { ulid } from '../../ids.js'
import type { CapabilityProgramRow } from '../../storage/contracts/capability-store.js'
import type { HarnessDAG } from '../chrome-governor.js'
import { canExecute } from './circuit-breaker-adapter.js'
import type {
  HarnessExecutionRequest,
  HarnessExecutionResult,
  HarnessExecutor,
  HarnessExecutorDeps,
  HarnessSink,
} from './harness-contract.js'
import { configToProgram } from './program-schema.js'
import { compileRecipe } from './recipe-compiler.js'
import { captureAndStore } from './stream-capture-reconstruct.js'
import { withTimeout } from './timeout-guard.js'

function defaultSink(deps: HarnessExecutorDeps): HarnessSink {
  return {
    onBlock(block) {
      void deps.blockStore.storeBlocks('harness', block.messageId, [
        {
          type: block.blockKind === 'code' ? 'code' : 'text',
          text:
            typeof block.blockData === 'string' ? block.blockData : JSON.stringify(block.blockData),
        },
      ])
      deps.eventBus.emit({ type: 'capability:streamBlock', ...block } as never)
    },
    onDone(result) {
      deps.eventBus.emit({ type: 'capability:streamDone', ...result } as never)
    },
    onError(error) {
      deps.eventBus.emit({ type: 'capability:streamError', error: String(error) } as never)
    },
  }
}

export class HarnessExecutorEngine implements HarnessExecutor {
  private readonly sink: HarnessSink

  constructor(
    private readonly deps: HarnessExecutorDeps,
    sink?: HarnessSink,
  ) {
    this.sink = sink ?? defaultSink(deps)
  }

  async execute(req: HarnessExecutionRequest): Promise<HarnessExecutionResult> {
    const start = Date.now()
    const traceId = ulid()

    const program = await this.resolveProgram(req)
    if (!program) {
      const msg = `No program for capability=${req.capabilitySlug} provider=${req.providerId}`
      this.sink.onError(msg)
      return this.fail(msg, start)
    }

    const recipe = configToProgram(program.configJson).recipe
    const dag = compileRecipe(recipe)

    const slaveId = await this.deps.slaveResolver.resolve(req.providerId, req.accountId)
    if (!slaveId) {
      const msg = `No live slave for provider=${req.providerId} account=${req.accountId}`
      this.sink.onError(msg)
      return this.fail(msg, start)
    }

    // Governor Canon circuit gate (cap-store gate) — do not attempt if open.
    if (!(await canExecute(this.deps.governor, slaveId))) {
      const msg = `Circuit open for slave=${slaveId}`
      this.sink.onError(msg)
      return this.fail(msg, start)
    }

    const timeoutMs = recipe.timeoutMs ?? this.deps.defaultTimeoutMs ?? 30_000
    const guarded = await withTimeout(
      (signal) => this.runPlan(slaveId, dag, req, traceId, signal),
      timeoutMs,
    )

    if (guarded.timedOut || guarded.result === undefined) {
      const msg = `Execution timed out after ${timeoutMs}ms`
      this.sink.onError(msg)
      await this.recordOutcome(req, program, false, start, msg, traceId)
      return this.fail(msg, start)
    }

    const r = guarded.result
    await this.recordOutcome(req, program, r.ok, start, r.error, traceId)
    this.sink.onDone(r)
    return r
  }

  private async runPlan(
    slaveId: string,
    dag: HarnessDAG,
    req: HarnessExecutionRequest,
    traceId: string,
    _signal: AbortSignal,
  ): Promise<HarnessExecutionResult> {
    const result = await this.deps.governor.runHarnessPlan(slaveId, dag)
    const messageId = req.messageId ?? ulid()
    const bindingId = req.bindingId ?? `${req.capabilitySlug}:${req.providerId}`
    let lastSeq = 0
    if (result.success && result.capturedBody) {
      // 23.3 - reconstruct + persist + emit captured blocks.
      lastSeq = await captureAndStore(
        result.capturedBody,
        { conversationId: req.conversationId ?? 'harness', messageId, bindingId },
        this.deps.blockStore,
        this.sink,
        0,
      )
    }
    void traceId
    void lastSeq
    return {
      ok: result.success,
      bindingId,
      programId: req.programId,
      slaveId,
      stepsCompleted: result.stepsCompleted,
      captured: result.capturedBody,
      error: result.error,
      durationMs: 0,
    }
  }

  private async resolveProgram(req: HarnessExecutionRequest): Promise<CapabilityProgramRow | null> {
    // Program resolution is owned by the ProgramStore contract (the recipe source
    // of truth). CapabilityStore is used only for outcome telemetry below.
    if (req.programId) return this.deps.programStore.getProgramById(req.programId)
    return this.deps.programStore.getBestProgramByCapability(req.capabilitySlug, req.providerId)
  }

  private async recordOutcome(
    req: HarnessExecutionRequest,
    program: CapabilityProgramRow,
    ok: boolean,
    start: number,
    error: string | undefined,
    traceId: string,
  ): Promise<void> {
    await this.deps.store.createOutcome({
      capabilityId: `cap:${req.capabilitySlug}`,
      bindingId: req.bindingId ?? program.bindingId,
      providerId: req.providerId,
      accountId: req.accountId,
      ok,
      latencyMs: Date.now() - start,
      error: error ?? null,
      outputJson: JSON.stringify({ programId: program.id }),
      traceId,
    })
  }

  private fail(error: string, start: number): HarnessExecutionResult {
    return { ok: false, error, stepsCompleted: 0, durationMs: Date.now() - start }
  }
}
