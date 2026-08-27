// src/engines/scheduler/index.ts
// Barrel exports for Resource-Class Scheduler.
// Phase 5: Dependency-aware concurrent scheduling.

export type { SchedulerSnapshot, Task, TaskResult } from './browser-scheduler.js'
export {
  BrowserScheduler,
  SchedulerBackpressureError,
  TaskTimeoutError,
} from './browser-scheduler.js'
export type { PolicyConfig } from './policy.js'
export { SchedulerPolicy } from './policy.js'
export type { QueueConfig, QueueName } from './queues.js'
export {
  getQueueConfig,
  getResourceClass,
  METHOD_TO_RESOURCE_CLASS,
  QUEUE_CONFIGS,
} from './queues.js'
