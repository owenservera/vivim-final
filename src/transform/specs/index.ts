// src/transform/specs/index.ts
// Barrel export of all entity transformation specs.

export type { CapabilityDomain } from './capability-spec.js'
export { capabilityTransformSpec } from './capability-spec.js'
export type { ConversationDomain, MessageDomain } from './conversation-spec.js'
export { conversationTransformSpec, messageTransformSpec } from './conversation-spec.js'
export type { ProviderDomain } from './provider-spec.js'
export { autoSnakeMappings, providerTransformSpec } from './provider-spec.js'
