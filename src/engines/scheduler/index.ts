// src/engines/scheduler/index.ts
// Barrel exports for Resource-Class Scheduler.
// Phase 5: Dependency-aware concurrent scheduling.

export { BrowserScheduler } from './browser-scheduler.js'
export { SchedulerPolicy } from './policy.js'
export { QUEUE_CONFIGS, METHOD_TO_RESOURCE_CLASS, getResourceClass, getQueueConfig } from './queues.js'
export type { QueueName, QueueConfig } from './queues.js'
export type { Task, TaskResult, SchedulerSnapshot } from './browser-scheduler.js'
export { SchedulerBackpressureError, TaskTimeoutError } from './browser-scheduler.js'
export type { PolicyConfig } from './policy.js'
