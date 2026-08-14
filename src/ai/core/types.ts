/**
 * VIVIM AI Gateway — Canonical Domain Types
 *
 * @module ai/core/types
 * @version 1.1.0
 *
 * This file defines the provider-neutral semantic contract between VIVIM
 * and AI execution providers. It is the most expensive file in the system
 * to get wrong, and the cheapest to get right early.
 *
 * ARCHITECTURAL RULES
 * ───────────────────
 * 1. No provider SDKs may be imported here.
 * 2. No runtime-specific types may leak into this layer.
 * 3. Provider implementations adapt TO these types (see protocol/adapter.ts).
 * 4. VIVIM application code depends ON these types.
 * 5. Behavioral contracts (interfaces with methods) do NOT belong here.
 *    This file is data-only: requests, events, errors, descriptors.
 *    "What can execute an AIRequest" lives in protocol/adapter.ts, not here.
 *    (v1.0 made this mistake by defining an `AIProvider` runtime contract
 *    inline; it has been removed. See CHANGELOG at the bottom of this file.)
 *
 * Dependency direction:
 *
 *   VIVIM Application
 *          ↓
 *   AI Gateway / Domain   ← you are here
 *          ↓
 *   Provider Adapters
 *          ↓
 *   External AI Runtime
 */

/* ============================================================================
 * VERSIONING
 * ========================================================================== */

export const VIVIM_AI_PROTOCOL = {
  major: 1,
  minor: 1,
  version: '1.1',
} as const

export type VivimAIProtocolVersion = typeof VIVIM_AI_PROTOCOL.version

/* ============================================================================
 * IDENTIFIERS
 * ========================================================================== */

export type Brand<T, B extends string> = T & { readonly __brand: B }

export type RequestId = Brand<string, 'RequestId'>
export type ProviderId = Brand<string, 'ProviderId'>
export type ModelId = Brand<string, 'ModelId'>
export type SessionId = Brand<string, 'SessionId'>
export type ToolCallId = Brand<string, 'ToolCallId'>
export type EventId = Brand<string, 'EventId'>
export type PluginId = Brand<string, 'PluginId'>
export type WorkspaceId = Brand<string, 'WorkspaceId'>

export const requestId = (v: string): RequestId => v as RequestId
export const providerId = (v: string): ProviderId => v as ProviderId
export const modelId = (v: string): ModelId => v as ModelId
export const sessionId = (v: string): SessionId => v as SessionId
export const toolCallId = (v: string): ToolCallId => v as ToolCallId
export const eventId = (v: string): EventId => v as EventId
export const pluginId = (v: string): PluginId => v as PluginId
export const workspaceId = (v: string): WorkspaceId => v as WorkspaceId

export function createRequestId(): RequestId {
  return requestId(crypto.randomUUID())
}
export function createEventId(): EventId {
  return eventId(crypto.randomUUID())
}

/* ============================================================================
 * MODALITIES
 * ========================================================================== */

export type InputModality = 'text' | 'image' | 'audio' | 'video' | 'file' | 'structured-data'
export type OutputModality =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'structured-data'
  | 'embedding'
  | 'tool-call'
export type Modality = InputModality | OutputModality

/* ============================================================================
 * CAPABILITIES
 * ========================================================================== */

/**
 * Capability names are semantic, never provider-specific.
 * Forbidden: "ollama-function-calling". Provider quirks live in
 * ProviderManifest.extensions, never in this union.
 */
export type AICapability =
  | 'chat'
  | 'generation'
  | 'streaming'
  | 'reasoning'
  | 'vision'
  | 'audio-input'
  | 'audio-output'
  | 'video-input'
  | 'tool-calling'
  | 'parallel-tool-calls'
  | 'structured-output'
  | 'embeddings'
  | 'reranking'
  | 'image-generation'
  | 'code-execution'
  | 'json-schema'
  | 'grammar-constrained-output'
  | 'cancellation'
  | 'usage-reporting'
  | 'prompt-caching'
  | 'context-caching'

export type CapabilitySupport =
  | { supported: true; level?: 'basic' | 'advanced' | 'strict'; constraints?: readonly string[] }
  | { supported: false; reason?: string }

export type CapabilityMap = Readonly<Partial<Record<AICapability, CapabilitySupport>>>

export function hasCapability(caps: CapabilityMap, cap: AICapability): boolean {
  return caps[cap]?.supported === true
}

/* ============================================================================
 * PROVIDERS (identity/manifest only — behavior lives in protocol/adapter.ts)
 * ========================================================================== */

export type ProviderKind = 'local' | 'remote' | 'hybrid' | 'embedded'
export type ProviderTrust = 'official' | 'verified' | 'community' | 'unverified' | 'blocked'

/**
 * Full provider lifecycle. Registry and Gateway both key off this —
 * see registry/registry.ts for the state machine and legal transitions.
 */
export type ProviderState =
  | 'discovered'
  | 'installed'
  | 'validating'
  | 'enabled'
  | 'starting'
  | 'ready'
  | 'active'
  | 'degraded'
  | 'unhealthy'
  | 'draining'
  | 'disabled'
  | 'stopped'
  | 'failed'

export type Platform = 'windows' | 'macos' | 'linux' | 'web'
export type Architecture = 'x64' | 'arm64' | 'x86'

export type ProviderPermission =
  | 'filesystem.models'
  | 'filesystem.config'
  | 'network.localhost'
  | 'network.specific-hosts'
  | 'network.internet'
  | 'gpu'
  | 'process.spawn'
  | 'microphone'
  | 'camera'
  | 'credentials'

export interface ProviderManifest {
  readonly id: ProviderId
  readonly pluginId: PluginId

  readonly name: string
  readonly version: string
  readonly protocolVersion: VivimAIProtocolVersion

  readonly kind: ProviderKind
  readonly trust: ProviderTrust

  readonly description?: string
  readonly capabilities: CapabilityMap

  readonly supportedPlatforms?: readonly Platform[]
  readonly supportedArchitectures?: readonly Architecture[]
  readonly permissions?: readonly ProviderPermission[]

  readonly minimumGatewayVersion?: string
  readonly maximumGatewayVersion?: string

  /** Provider-specific metadata. Core VIVIM code must never depend on it. */
  readonly extensions?: Readonly<Record<string, unknown>>
}

/* ============================================================================
 * MODELS
 * ========================================================================== */

export interface ModelArtifact {
  readonly uri?: string
  readonly checksum?: string
  readonly checksumAlgorithm?: 'sha256' | 'sha512'
  readonly sizeBytes?: number
  readonly format?: 'gguf' | 'safetensors' | 'onnx' | 'mlx' | 'other'
}

export interface ResourceRequirements {
  readonly minimumRamMB?: number
  readonly recommendedRamMB?: number
  readonly minimumVramMB?: number
  readonly recommendedVramMB?: number
  readonly cpuCores?: number
  readonly diskBytes?: number
  readonly gpuRequired?: boolean
}

export interface PerformanceProfile {
  readonly tokensPerSecond?: number
  readonly timeToFirstTokenMs?: number
  readonly measuredAt?: string
  readonly benchmarkId?: string
}

export interface LicenseInfo {
  readonly name?: string
  readonly url?: string
}

export interface ModelDescriptor {
  readonly id: ModelId
  readonly providerId: ProviderId

  readonly name: string
  readonly family?: string
  readonly revision?: string

  readonly modalities: {
    readonly input: readonly InputModality[]
    readonly output: readonly OutputModality[]
  }

  readonly capabilities: CapabilityMap

  readonly contextWindow?: number
  readonly maxOutputTokens?: number
  readonly parameters?: number
  readonly quantization?: string

  readonly artifact?: ModelArtifact
  readonly resourceRequirements?: ResourceRequirements
  readonly performance?: PerformanceProfile
  readonly license?: LicenseInfo

  readonly extensions?: Readonly<Record<string, unknown>>
}

/* ============================================================================
 * MESSAGES & CONTENT
 * ========================================================================== */

export type MessageRole = 'system' | 'developer' | 'user' | 'assistant' | 'tool'

export interface Message {
  readonly role: MessageRole
  readonly content: readonly ContentPart[]
  readonly name?: string
  readonly toolCallId?: ToolCallId
  readonly metadata?: Readonly<Record<string, unknown>>
}

export type ContentPart =
  | TextContent
  | ImageContent
  | AudioContent
  | VideoContent
  | FileContent
  | DataContent
  | ToolCallContent
  | ToolResultContent
  | CitationContent

export interface TextContent {
  readonly type: 'text'
  readonly text: string
}

type MediaSource =
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'data'; readonly mediaType: string; readonly data: string }
  | { readonly kind: 'file'; readonly path: string }

export interface ImageContent {
  readonly type: 'image'
  readonly source: MediaSource
}
export interface AudioContent {
  readonly type: 'audio'
  readonly source: MediaSource
}
export interface VideoContent {
  readonly type: 'video'
  readonly source: Exclude<MediaSource, { kind: 'data' }>
}

export interface FileContent {
  readonly type: 'file'
  readonly name?: string
  readonly mediaType?: string
  readonly source:
    | { readonly kind: 'path'; readonly path: string }
    | { readonly kind: 'url'; readonly url: string }
    | { readonly kind: 'data'; readonly data: string }
}

export interface DataContent {
  readonly type: 'data'
  readonly mediaType: string
  readonly data: unknown
}

export interface ToolCallContent {
  readonly type: 'tool-call'
  readonly id: ToolCallId
  readonly name: string
  readonly arguments: unknown
}

export interface ToolResultContent {
  readonly type: 'tool-result'
  readonly toolCallId: ToolCallId
  readonly result: unknown
  readonly isError?: boolean
}

export interface CitationContent {
  readonly type: 'citation'
  readonly sourceId: string
  readonly title?: string
  readonly uri?: string
}

export function isTextContent(c: ContentPart): c is TextContent {
  return c.type === 'text'
}
export function isToolCallContent(c: ContentPart): c is ToolCallContent {
  return c.type === 'tool-call'
}
export function isToolResultContent(c: ContentPart): c is ToolResultContent {
  return c.type === 'tool-result'
}
export function messageContainsToolCall(m: Message): boolean {
  return m.content.some(isToolCallContent)
}

/* ============================================================================
 * TOOLS
 * ========================================================================== */

export type ToolPermission =
  | 'filesystem.read'
  | 'filesystem.write'
  | 'network'
  | 'process'
  | 'browser'
  | 'credentials'
  | 'external-service'

export interface JsonSchema {
  readonly type?: string
  readonly properties?: Readonly<Record<string, JsonSchema>>
  readonly required?: readonly string[]
  readonly items?: JsonSchema
  readonly enum?: readonly unknown[]
  readonly [key: string]: unknown
}

export interface ToolDefinition {
  readonly name: string
  readonly description?: string
  readonly inputSchema: JsonSchema
  readonly permissions?: readonly ToolPermission[]
  readonly requiresApproval?: boolean
  readonly metadata?: Readonly<Record<string, unknown>>
}

/* ============================================================================
 * GENERATION / STRUCTURED OUTPUT
 * ========================================================================== */

export interface ReasoningConfig {
  readonly enabled?: boolean
  readonly effort?: 'minimal' | 'low' | 'medium' | 'high' | 'maximum'
}

export interface GenerationConfig {
  readonly temperature?: number
  readonly topP?: number
  readonly topK?: number
  readonly maxOutputTokens?: number
  readonly stopSequences?: readonly string[]
  readonly seed?: number
  readonly frequencyPenalty?: number
  readonly presencePenalty?: number
  readonly reasoning?: ReasoningConfig
}

export type ResponseFormat =
  | { readonly type: 'text' }
  | { readonly type: 'json' }
  | {
      readonly type: 'json-schema'
      readonly name: string
      readonly schema: JsonSchema
      readonly strict?: boolean
    }

/* ============================================================================
 * EXECUTION POLICY
 * ========================================================================== */

export type LocalityPolicy =
  | 'local-only'
  | 'local-preferred'
  | 'local-with-fallback'
  | 'remote-preferred'
  | 'remote-only'
export type NetworkPolicy = 'deny' | 'localhost' | 'allow-listed' | 'allow'
export type PersistencePolicy = 'deny' | 'session' | 'allow'

export interface ExecutionPolicy {
  readonly locality?: LocalityPolicy
  readonly network?: NetworkPolicy
  readonly persistence?: PersistencePolicy

  readonly allowTelemetry?: boolean
  readonly allowPromptLogging?: boolean
  readonly allowToolExecution?: boolean
  readonly requireToolApproval?: boolean

  readonly maxLatencyMs?: number
  readonly maxMemoryMB?: number

  readonly preferredProviderIds?: readonly ProviderId[]
  readonly excludedProviderIds?: readonly ProviderId[]

  readonly requiredCapabilities?: readonly AICapability[]
  readonly deniedCapabilities?: readonly AICapability[]

  /** Routing priority when multiple strategies could apply. */
  readonly priority?: 'cost' | 'quality' | 'latency' | 'balanced'

  readonly allowedNetworkHosts?: readonly string[]
}

/* ============================================================================
 * MODEL SELECTION
 * ========================================================================== */

export interface ModelSelectionConstraints {
  readonly minimumContextWindow?: number
  readonly maximumMemoryMB?: number
  readonly maximumVramMB?: number
  readonly modalities?: {
    readonly input?: readonly InputModality[]
    readonly output?: readonly OutputModality[]
  }
}

export interface ModelSelector {
  readonly modelId?: ModelId
  readonly providerId?: ProviderId
  readonly capabilities?: readonly AICapability[]
  readonly task?: string
  readonly constraints?: ModelSelectionConstraints
}

/* ============================================================================
 * REQUEST
 * ========================================================================== */

export type RequestPriority = 'interactive' | 'foreground' | 'background' | 'maintenance'

export interface TaskDescriptor {
  readonly name: string
  readonly description?: string
  readonly requirements?: readonly AICapability[]
  readonly priority?: RequestPriority
}

export interface RequestMetadata {
  readonly source?: string
  readonly workspaceId?: WorkspaceId
  readonly userInitiated?: boolean
  readonly createdAt?: string
  readonly traceId?: string
  readonly extensions?: Readonly<Record<string, unknown>>
}

export interface AIRequest {
  readonly requestId: RequestId
  readonly sessionId?: SessionId
  readonly model?: ModelSelector
  readonly task?: TaskDescriptor
  readonly messages?: readonly Message[]
  readonly tools?: readonly ToolDefinition[]
  readonly responseFormat?: ResponseFormat
  readonly generation?: GenerationConfig
  readonly policy?: ExecutionPolicy
  readonly metadata?: RequestMetadata
}

/* ============================================================================
 * EVENT STREAM
 * ========================================================================== */

export interface BaseAIEvent {
  readonly eventId: EventId
  readonly requestId: RequestId
  readonly sequence: number
  readonly timestamp: string
}

export interface RequestStartedEvent extends BaseAIEvent {
  readonly type: 'request.started'
}
export interface ResponseStartedEvent extends BaseAIEvent {
  readonly type: 'response.started'
  readonly providerId: ProviderId
  readonly modelId: ModelId
}
export interface TextDeltaEvent extends BaseAIEvent {
  readonly type: 'output.text.delta'
  readonly text: string
}
export interface ReasoningDeltaEvent extends BaseAIEvent {
  readonly type: 'output.reasoning.delta'
  readonly text: string
}
export interface ToolCallCreatedEvent extends BaseAIEvent {
  readonly type: 'tool.call.created'
  readonly toolCallId: ToolCallId
  readonly name: string
}
export interface ToolCallDeltaEvent extends BaseAIEvent {
  readonly type: 'tool.call.delta'
  readonly toolCallId: ToolCallId
  readonly argumentsDelta: string
}
export interface ToolCallCompletedEvent extends BaseAIEvent {
  readonly type: 'tool.call.completed'
  readonly toolCallId: ToolCallId
  readonly arguments: unknown
}
export interface StructuredOutputDeltaEvent extends BaseAIEvent {
  readonly type: 'output.structured.delta'
  readonly data: unknown
}
export interface UsageUpdatedEvent extends BaseAIEvent {
  readonly type: 'usage.updated'
  readonly usage: UsageMetrics
}
export interface ProviderWarningEvent extends BaseAIEvent {
  readonly type: 'provider.warning'
  readonly code: string
  readonly message: string
}
export interface ResponseCompletedEvent extends BaseAIEvent {
  readonly type: 'response.completed'
  readonly usage?: UsageMetrics
}
export interface ResponseFailedEvent extends BaseAIEvent {
  readonly type: 'response.failed'
  readonly error: AIError
}
export interface ResponseCancelledEvent extends BaseAIEvent {
  readonly type: 'response.cancelled'
  readonly reason?: string
}

/**
 * Outcome event — emitted when a downstream consumer implicitly signals
 * success or failure of a routed provider, recalled entity, or context layer.
 * Consumed by OutcomeTracker (§7) for adaptive scoring across routing,
 * entity confidence decay, and context ranking.
 */
export interface OutcomeEvent extends BaseAIEvent {
  readonly type: 'outcome.recorded'
  readonly subjectId: string
  readonly subjectType: 'provider' | 'entity' | 'contextLayer' | 'commandIntent'
  readonly outcome: 'reinforced' | 'ignored' | 'rejected'
  readonly metadata?: Readonly<Record<string, unknown>>
}

export type AIEvent =
  | RequestStartedEvent
  | ResponseStartedEvent
  | TextDeltaEvent
  | ReasoningDeltaEvent
  | ToolCallCreatedEvent
  | ToolCallDeltaEvent
  | ToolCallCompletedEvent
  | StructuredOutputDeltaEvent
  | UsageUpdatedEvent
  | ProviderWarningEvent
  | ResponseCompletedEvent
  | ResponseFailedEvent
  | ResponseCancelledEvent
  | OutcomeEvent

export function isTerminalAIEvent(
  e: AIEvent,
): e is ResponseCompletedEvent | ResponseFailedEvent | ResponseCancelledEvent {
  return (
    e.type === 'response.completed' ||
    e.type === 'response.failed' ||
    e.type === 'response.cancelled'
  )
}

/* ============================================================================
 * USAGE
 * ========================================================================== */

export interface UsageMetrics {
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly totalTokens?: number
  readonly cachedTokens?: number
  readonly timeToFirstTokenMs?: number
  readonly totalLatencyMs?: number
  readonly tokensPerSecond?: number
  readonly queueTimeMs?: number
  readonly modelLoadTimeMs?: number
}

/* ============================================================================
 * ERRORS
 * ========================================================================== */

export type AIErrorCode =
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_UNHEALTHY'
  | 'MODEL_UNAVAILABLE'
  | 'CAPABILITY_UNSUPPORTED'
  | 'POLICY_DENIED'
  | 'AUTHENTICATION_FAILED'
  | 'RATE_LIMITED'
  | 'CONTEXT_TOO_LARGE'
  | 'INVALID_REQUEST'
  | 'SCHEMA_VIOLATION'
  | 'TOOL_DENIED'
  | 'TOOL_FAILED'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'RESOURCE_UNAVAILABLE'
  | 'PLUGIN_INVALID'
  | 'PLUGIN_UNTRUSTED'
  | 'RUNTIME_CRASH'
  | 'HARDWARE_UNAVAILABLE'
  | 'PROTOCOL_ERROR'
  | 'UNKNOWN'

export interface AIError {
  readonly code: AIErrorCode
  readonly message: string
  readonly retryable: boolean
  readonly providerId?: ProviderId
  readonly modelId?: ModelId
  readonly cause?: { readonly code?: string; readonly message?: string }
  readonly metadata?: Readonly<Record<string, unknown>>
}

/* ============================================================================
 * HEALTH & RESOURCES
 * ========================================================================== */

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

export interface ResourceUsage {
  readonly cpuPercent?: number
  readonly memoryMB?: number
  readonly gpuPercent?: number
  readonly vramMB?: number
}

export interface ProviderHealth {
  readonly status: HealthStatus
  readonly state: ProviderState
  readonly checkedAt: string
  readonly latencyMs?: number
  readonly message?: string
  readonly resourceUsage?: ResourceUsage
}

/* ============================================================================
 * ROUTING (data shapes only — decision logic lives in routing/router.ts)
 * ========================================================================== */

export type RoutingFactor =
  | 'capability'
  | 'locality'
  | 'policy'
  | 'resource'
  | 'latency'
  | 'quality'
  | 'availability'
  | 'cost'

export interface RoutingReason {
  readonly factor: RoutingFactor
  readonly score: number
  readonly explanation?: string
}

export interface RoutingCandidate {
  readonly providerId: ProviderId
  readonly modelId: ModelId
  readonly score: number
  readonly reasons: readonly RoutingReason[]
}

export interface RoutingDecision {
  readonly providerId: ProviderId
  readonly modelId: ModelId
  readonly candidates: readonly RoutingCandidate[]
  readonly decidedAt: string
}

/* ============================================================================
 * PLUGINS (identity/descriptor only — lifecycle contract in plugins/manager.ts)
 * ========================================================================== */

export type PluginState =
  | 'discovered'
  | 'installing'
  | 'installed'
  | 'validating'
  | 'enabled'
  | 'disabled'
  | 'failed'
  | 'uninstalled'

export interface PluginDescriptor {
  readonly id: PluginId
  readonly name: string
  readonly version: string
  readonly type: 'ai-provider'
  readonly state: PluginState
  readonly manifest: ProviderManifest
  readonly checksum?: string
  readonly installedAt?: string
}

/* ============================================================================
 * CHANGELOG (kept here deliberately — this file's history IS architecture)
 * ========================================================================== *
 * 1.1.0 — Removed the inline `AIProvider` behavioral contract. v1.0 defined
 *         both a data-only `AIProvider` here and a separate `IProviderAdapter`
 *         in the adapter layer with `extends AIProvider`, which silently
 *         coupled the translation contract to a redundant execution contract
 *         and made "who actually owns execute()" ambiguous. There is now
 *         exactly one behavioral contract for provider execution:
 *         IProviderAdapter in protocol/adapter.ts. This file stays data-only.
 *         Added ProviderState transitional values (enabled/disabled) to match
 *         the registry lifecycle machine. Added WorkspaceId brand. Added
 *         prompt/context caching capabilities.
 * ========================================================================== */
