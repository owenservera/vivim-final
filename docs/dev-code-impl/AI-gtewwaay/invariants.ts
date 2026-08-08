/**
 * VIVIM AI Gateway — Contract Invariants
 * @module ai/core/invariants
 *
 * Cheap, dependency-free runtime checks that protect the canonical IR at
 * process boundaries (adapter input/output, IPC deserialization, plugin
 * manifests). These are not a validation framework — they are a small set
 * of non-negotiable guards. Reach for zod/ajv at the IPC edge if you need
 * full schema validation; keep these as the last line of defense.
 */

import type {
  AIRequest, CapabilityMap, AICapability, ProviderManifest,
} from './types';
import { hasCapability } from './types';

export function assertValidRequest(request: AIRequest): void {
  if (!request.requestId) throw new Error('AI request must have a requestId.');
  if (!request.messages?.length && !request.task) {
    throw new Error('AI request must contain messages or a task.');
  }
}

export function assertProviderManifest(provider: ProviderManifest): void {
  if (!provider.id) throw new Error('Provider manifest must contain an id.');
  if (!provider.pluginId) throw new Error('Provider manifest must contain a pluginId.');
  if (!provider.protocolVersion) throw new Error('Provider manifest must declare protocolVersion.');
  if (!provider.capabilities) throw new Error('Provider manifest must declare a capabilities map, even if empty.');
}

export function assertCapabilities(caps: CapabilityMap, required: readonly AICapability[]): void {
  const missing = required.filter((c) => !hasCapability(caps, c));
  if (missing.length > 0) {
    throw new Error(`Missing required capabilities: ${missing.join(', ')}`);
  }
}

/**
 * Guards against the single most common cross-process bug in this kind of
 * system: an adapter mutating a request object it was handed and the
 * mutation silently propagating back through a shared reference. All
 * domain objects are readonly at the type level; this is the runtime
 * backstop for adapters written in a language/tool that won't respect it.
 */
export function assertNotMutated<T extends object>(original: T, candidate: T, label: string): void {
  if (original !== candidate && JSON.stringify(original) !== JSON.stringify(candidate)) {
    throw new Error(`${label} was mutated across a protocol boundary. Construct a new value instead.`);
  }
}
