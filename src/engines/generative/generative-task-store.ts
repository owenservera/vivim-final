// src/engines/generative/generative-task-store.ts
// Tier 4 units 16.2–16.4 — GenerativeTaskStore.
//
// Closes audit findings:
//   🚀-27: shared AsyncCapabilityResult contract (used by both onboarding
//   long-running CDP and NLCL generative tasks).
//   🚀-16: resume-on-reconnect via WS push — when a client reconnects after
//   a generative task completes, the WS layer queries this store for any
//   tasks belonging to the user/session and replays the completion event.
//
// Architecture:
//   • GenerativeTask — a long-running operation (image gen, video gen, large
//     LLM completion, multi-step agent run). Has a stable taskId, status
//     lifecycle, and optional progress events.
//   • GenerativeTaskStore — in-memory Map<taskId, GenerativeTask> with
//     sliding TTL (24h, much longer than dialogue sessions because generative
//     tasks may take minutes to hours and the user may disconnect/reconnect).
//   • Subscriber pattern — clients subscribe to a taskId; on completion,
//     all subscribers receive a push event (the WS layer wires this).
//   • Status lifecycle: pending → running → completed | failed | cancelled.
//
// Integration with UnifiedCapabilityRegistry:
//   • Async capabilities return { taskId } immediately rather than blocking.
//   • The registry's execute() method recognizes AsyncCapabilityResult and
//     auto-registers a completion callback with the GenerativeTaskStore.
//   • The /api/generative/status/:taskId endpoint polls task status.
//   • The /api/generative/subscribe/:taskId endpoint opens a WS for push.

import { newId } from '../../ids.js'

export type GenerativeTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface GenerativeTaskProgress {
  /** 0..1 progress fraction. */
  fraction: number
  /** Human-readable status message. */
  message: string
  /** ISO timestamp of the progress event. */
  timestamp: number
}

export interface GenerativeTask {
  readonly taskId: string
  /** The capability that produced this task (e.g. 'cap:media:image_generate'). */
  readonly capabilityId: string
  /** The original input that triggered the task. */
  readonly input: Readonly<Record<string, unknown>>
  /** The user/session that owns this task. */
  readonly ownerKey: string
  status: GenerativeTaskStatus
  /** Output produced on completion (undefined until status='completed'). */
  output: unknown
  /** Error message on failure (undefined unless status='failed'). */
  error: string | null
  /** Progress events (most recent last). */
  progress: GenerativeTaskProgress[]
  createdAt: number
  updatedAt: number
  /** createdAt + ttlMs. */
  expiresAt: number
  completedAt: number | null
}

export type GenerativeTaskSubscriber = (event: GenerativeTaskEvent) => void

export interface GenerativeTaskEvent {
  type: 'progress' | 'completed' | 'failed' | 'cancelled'
  taskId: string
  timestamp: number
  progress?: GenerativeTaskProgress
  output?: unknown
  error?: string
}

export interface GenerativeTaskStore {
  /** Create a new pending task. Returns the task with a fresh taskId. */
  create(input: {
    capabilityId: string
    input: Record<string, unknown>
    ownerKey: string
    ttlMs?: number
  }): GenerativeTask
  /** Get a task by ID (or null if missing/expired). */
  get(taskId: string): GenerativeTask | null
  /** List all tasks for a given owner (most recent first). */
  listByOwner(ownerKey: string): GenerativeTask[]
  /** Update task status. Returns the updated task, or null if not found. */
  updateStatus(
    taskId: string,
    status: GenerativeTaskStatus,
    patch?: { output?: unknown; error?: string | null },
  ): GenerativeTask | null
  /** Append a progress event. Returns the updated task, or null if not found. */
  reportProgress(
    taskId: string,
    progress: Omit<GenerativeTaskProgress, 'timestamp'>,
  ): GenerativeTask | null
  /** Cancel a task (only if pending/running). Returns the updated task, or null. */
  cancel(taskId: string): GenerativeTask | null
  /** Subscribe to events for a task. Returns an unsubscribe function. */
  subscribe(taskId: string, subscriber: GenerativeTaskSubscriber): () => void
  /** Number of active tasks (for diagnostics). */
  size(): number
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const DEFAULT_SWEEP_MS = 5 * 60 * 1000 // sweep every 5 min

export class InMemoryGenerativeTaskStore implements GenerativeTaskStore {
  private readonly ttlMs: number
  private readonly sweepMs: number
  private readonly tasks = new Map<string, GenerativeTask>()
  private readonly subscribers = new Map<string, Set<GenerativeTaskSubscriber>>()

  constructor(opts?: { ttlMs?: number; sweepMs?: number }) {
    this.ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS
    this.sweepMs = opts?.sweepMs ?? DEFAULT_SWEEP_MS
    setInterval(() => this.sweep(Date.now()), this.sweepMs).unref?.()
  }

  create(input: {
    capabilityId: string
    input: Record<string, unknown>
    ownerKey: string
    ttlMs?: number
  }): GenerativeTask {
    const now = Date.now()
    const ttl = input.ttlMs ?? this.ttlMs
    const task: GenerativeTask = {
      taskId: newId(),
      capabilityId: input.capabilityId,
      input: input.input,
      ownerKey: input.ownerKey,
      status: 'pending',
      output: undefined,
      error: null,
      progress: [],
      createdAt: now,
      updatedAt: now,
      expiresAt: now + ttl,
      completedAt: null,
    }
    this.tasks.set(task.taskId, task)
    return task
  }

  get(taskId: string): GenerativeTask | null {
    const task = this.tasks.get(taskId)
    if (!task) return null
    if (task.expiresAt < Date.now()) {
      this.tasks.delete(taskId)
      this.subscribers.delete(taskId)
      return null
    }
    return task
  }

  listByOwner(ownerKey: string): GenerativeTask[] {
    const now = Date.now()
    return [...this.tasks.values()]
      .filter((t) => t.ownerKey === ownerKey && t.expiresAt >= now)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  updateStatus(
    taskId: string,
    status: GenerativeTaskStatus,
    patch?: { output?: unknown; error?: string | null },
  ): GenerativeTask | null {
    const task = this.tasks.get(taskId)
    if (!task) return null
    const now = Date.now()
    const updated: GenerativeTask = {
      ...task,
      status,
      output: patch?.output ?? task.output,
      error: patch?.error ?? task.error,
      updatedAt: now,
      completedAt:
        status === 'completed' || status === 'failed' || status === 'cancelled' ? now : null,
    }
    this.tasks.set(taskId, updated)
    // Emit event to subscribers.
    this.emit(taskId, {
      type:
        status === 'completed'
          ? 'completed'
          : status === 'failed'
            ? 'failed'
            : status === 'cancelled'
              ? 'cancelled'
              : 'progress',
      taskId,
      timestamp: now,
      output: updated.output,
      error: updated.error ?? undefined,
    })
    return updated
  }

  reportProgress(
    taskId: string,
    progress: Omit<GenerativeTaskProgress, 'timestamp'>,
  ): GenerativeTask | null {
    const task = this.tasks.get(taskId)
    if (!task) return null
    const now = Date.now()
    const event: GenerativeTaskProgress = { ...progress, timestamp: now }
    const updated: GenerativeTask = {
      ...task,
      status: 'running',
      progress: [...task.progress, event].slice(-100), // cap at 100 events
      updatedAt: now,
    }
    this.tasks.set(taskId, updated)
    this.emit(taskId, { type: 'progress', taskId, timestamp: now, progress: event })
    return updated
  }

  cancel(taskId: string): GenerativeTask | null {
    const task = this.tasks.get(taskId)
    if (!task) return null
    if (task.status !== 'pending' && task.status !== 'running') return task
    return this.updateStatus(taskId, 'cancelled')
  }

  subscribe(taskId: string, subscriber: GenerativeTaskSubscriber): () => void {
    let set = this.subscribers.get(taskId)
    if (!set) {
      set = new Set()
      this.subscribers.set(taskId, set)
    }
    set.add(subscriber)
    return () => {
      set?.delete(subscriber)
      if (set && set.size === 0) {
        this.subscribers.delete(taskId)
      }
    }
  }

  size(): number {
    return this.tasks.size
  }

  private emit(taskId: string, event: GenerativeTaskEvent): void {
    const set = this.subscribers.get(taskId)
    if (!set) return
    for (const sub of set) {
      try {
        sub(event)
      } catch {
        // subscriber errors are non-fatal
      }
    }
  }

  private sweep(now: number): void {
    for (const [taskId, task] of this.tasks) {
      if (task.expiresAt < now) {
        this.tasks.delete(taskId)
        this.subscribers.delete(taskId)
      }
    }
  }
}

// ── AsyncCapabilityResult contract (audit 🚀-27) ──────────────────────────

/**
 * Shared contract for async capabilities. Both onboarding (long-running CDP)
 * and NLCL (generative tasks) return this shape from execute() when the
 * operation can't complete synchronously.
 *
 * The UnifiedCapabilityRegistry recognizes this shape and:
 *   1. Auto-registers a completion callback with the GenerativeTaskStore.
 *   2. Returns the taskId to the caller immediately.
 *   3. Emits a WS event when the task completes (audit 🚀-16 resume-on-reconnect).
 */
export interface AsyncCapabilityResult {
  /** Marker field — always 'async'. */
  async: true
  /** The task ID — poll /api/generative/status/:taskId or subscribe via WS. */
  taskId: string
  /** Estimated time to completion (ms), or null if unknown. */
  estimatedMs: number | null
  /** Human-readable status message. */
  message: string
}

export function isAsyncCapabilityResult(v: unknown): v is AsyncCapabilityResult {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { async?: unknown }).async === true &&
    typeof (v as { taskId?: unknown }).taskId === 'string'
  )
}

// ── GENERATIVE_SLOT_MAP (audit Tier 4 unit 16.4) ─────────────────────────

/**
 * Maps generative slots (parameter names in NLCL commands that accept
 * generated content) to the capability that produces the content.
 *
 * Example: the `cap:canvas:set_background` capability has an `imageQuery`
 * slot. When the user provides an imageQuery, the executor looks up the
 * slot in this map, dispatches to `cap:media:image_generate` to produce
 * the image, then uses the resulting image as the `imageBase64` input
 * to set_background.
 */
export const GENERATIVE_SLOT_MAP: Record<
  string,
  {
    generatorCapabilityId: string
    /** The field in the generator's input to populate from the slot's value. */
    generatorInputField: string
    /** The field in the consumer's input to populate from the generator's output. */
    consumerOutputField: string
  }
> = {
  imageQuery: {
    generatorCapabilityId: 'cap:media:image_generate',
    generatorInputField: 'query',
    consumerOutputField: 'imageBase64',
  },
  videoQuery: {
    generatorCapabilityId: 'cap:media:video_generate',
    generatorInputField: 'query',
    consumerOutputField: 'videoBase64',
  },
  audioQuery: {
    generatorCapabilityId: 'cap:media:audio_generate',
    generatorInputField: 'query',
    consumerOutputField: 'audioBase64',
  },
}

/** Check if a given parameter name is a generative slot. */
export function isGenerativeSlot(paramName: string): boolean {
  return paramName in GENERATIVE_SLOT_MAP
}

/** Get the generator spec for a generative slot, or null. */
export function getGeneratorForSlot(
  paramName: string,
): (typeof GENERATIVE_SLOT_MAP)[string] | null {
  return GENERATIVE_SLOT_MAP[paramName] ?? null
}
