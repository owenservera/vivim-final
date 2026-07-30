// src/engines/scheduler/queues.ts
// Queue definitions for resource-class scheduling.
// Phase 5: Instead of fixed queues, the scheduler understands Resource Classes.

export type QueueName = 'DOM' | 'Input' | 'Runtime' | 'Network' | 'Screenshot' | 'Target'

export interface QueueConfig {
  name: QueueName
  concurrency: number
  exclusive: boolean
  timeoutMs: number
  priority: number
}

/**
 * Default queue configurations.
 * Priority order: Input > Network > DOM > Runtime > Screenshot > Target
 */
export const QUEUE_CONFIGS: Record<QueueName, QueueConfig> = {
  Input: {
    name: 'Input',
    concurrency: 1,
    exclusive: true,
    timeoutMs: 60_000,
    priority: 100,
  },
  Network: {
    name: 'Network',
    concurrency: 2,
    exclusive: false,
    timeoutMs: 30_000,
    priority: 80,
  },
  DOM: {
    name: 'DOM',
    concurrency: 1,
    exclusive: true,
    timeoutMs: 20_000,
    priority: 60,
  },
  Runtime: {
    name: 'Runtime',
    concurrency: 4,
    exclusive: false,
    timeoutMs: 15_000,
    priority: 40,
  },
  Screenshot: {
    name: 'Screenshot',
    concurrency: 1,
    exclusive: true,
    timeoutMs: 10_000,
    priority: 20,
  },
  Target: {
    name: 'Target',
    concurrency: 1,
    exclusive: true,
    timeoutMs: 10_000,
    priority: 10,
  },
}

/**
 * Map CDP methods to resource classes.
 */
export const METHOD_TO_RESOURCE_CLASS: Record<string, QueueName> = {
  // DOM mutations — exclusive
  'Input.dispatchKeyEvent': 'Input',
  'Input.dispatchMouseEvent': 'Input',
  'Input.dispatchTouchEvent': 'Input',
  'Input.insertText': 'Input',
  'Input.setIgnoreInputEvents': 'Input',
  'Input.setInsets': 'Input',

  // DOM queries — exclusive
  'DOM.getDocument': 'DOM',
  'DOM.querySelector': 'DOM',
  'DOM.querySelectorAll': 'DOM',
  'DOM.getOuterHTML': 'DOM',
  'DOM.setOuterHTML': 'DOM',
  'DOM.setAttributeValue': 'DOM',
  'DOM.removeAttribute': 'DOM',
  'DOM.focus': 'DOM',
  'DOM.scrollIntoViewIfNeeded': 'DOM',

  // Runtime evaluation — shared
  'Runtime.evaluate': 'Runtime',
  'Runtime.callFunctionOn': 'Runtime',
  'Runtime.getProperties': 'Runtime',
  'Runtime.releaseObject': 'Runtime',

  // Network — shared
  'Network.getResponseBody': 'Network',
  'Network.getCookies': 'Network',
  'Network.setCookie': 'Network',
  'Network.deleteCookies': 'Network',
  'Network.enable': 'Network',
  'Network.disable': 'Network',
  'Network.emulateNetworkConditions': 'Network',

  // Screenshot — exclusive
  'Page.captureScreenshot': 'Screenshot',
  'Emulation.captureScreenshot': 'Screenshot',

  // Target management — exclusive
  'Target.createTarget': 'Target',
  'Target.closeTarget': 'Target',
  'Target.attachToTarget': 'Target',
  'Target.detachFromTarget': 'Target',
  'Target.activateTarget': 'Target',

  // Page navigation — DOM
  'Page.navigate': 'DOM',
  'Page.reload': 'DOM',
  'Page.stopLoading': 'DOM',

  // Wait operations — DOM
  'Page.waitForSelector': 'DOM',
  'Page.waitUntilLoad': 'DOM',
}

/**
 * Get the resource class for a CDP method.
 */
export function getResourceClass(method: string): QueueName {
  return METHOD_TO_RESOURCE_CLASS[method] ?? 'Runtime'
}

/**
 * Get queue config for a resource class.
 */
export function getQueueConfig(name: QueueName): QueueConfig {
  return QUEUE_CONFIGS[name]
}
