/**
 * VIVIM AI Gateway — Error Taxonomy
 * @module ai/core/errors
 *
 * Every error that crosses the Gateway boundary MUST be representable as
 * AIError. Provider-native exceptions (an Ollama fetch failure, a llama.cpp
 * process signal) must be caught inside the adapter and translated here —
 * they must never escape the protocol boundary as raw exceptions.
 */

import type { AIError, AIErrorCode, ModelId, ProviderId } from './types';

export class VivimAIError extends Error {
  readonly code: AIErrorCode;
  readonly retryable: boolean;
  readonly providerId?: ProviderId;
  readonly modelId?: ModelId;
  readonly details?: Readonly<Record<string, unknown>>;
  override readonly cause?: unknown;

  constructor(
    error: AIError,
    options?: { cause?: unknown; details?: Readonly<Record<string, unknown>> },
  ) {
    super(error.message);
    this.name = 'VivimAIError';
    this.code = error.code;
    this.retryable = error.retryable;
    this.providerId = error.providerId;
    this.modelId = error.modelId;
    this.cause = options?.cause;
    this.details = options?.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): AIError {
    const cause = this.cause;
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      providerId: this.providerId,
      modelId: this.modelId,
      cause:
        cause instanceof Error
          ? { message: cause.message, code: 'code' in cause ? String((cause as { code?: unknown }).code) : undefined }
          : undefined,
      metadata: this.details,
    };
  }
}

export function isVivimAIError(value: unknown): value is VivimAIError {
  return value instanceof VivimAIError;
}

/**
 * Retryability is fixed HERE, not per call site. This is a load-bearing
 * decision: routing/retry logic elsewhere must trust `.retryable` rather
 * than re-deriving it from `.code`, or the two will drift.
 */
export const AI_ERRORS = {
  providerUnavailable(providerId: ProviderId, cause?: unknown): VivimAIError {
    return new VivimAIError(
      { code: 'PROVIDER_UNAVAILABLE', message: `Provider ${providerId} is unavailable.`, retryable: true, providerId },
      { cause },
    );
  },
  providerUnhealthy(providerId: ProviderId, reason?: string): VivimAIError {
    return new VivimAIError({
      code: 'PROVIDER_UNHEALTHY',
      message: reason ?? `Provider ${providerId} is unhealthy.`,
      retryable: true,
      providerId,
    });
  },
  modelUnavailable(modelId: ModelId): VivimAIError {
    return new VivimAIError({ code: 'MODEL_UNAVAILABLE', message: `Model ${modelId} is unavailable.`, retryable: true, modelId });
  },
  capabilityUnsupported(capability: string): VivimAIError {
    return new VivimAIError({
      code: 'CAPABILITY_UNSUPPORTED',
      message: `Required capability is unsupported: ${capability}.`,
      retryable: false,
    });
  },
  policyDenied(reason: string): VivimAIError {
    return new VivimAIError({ code: 'POLICY_DENIED', message: `Execution blocked by policy: ${reason}`, retryable: false });
  },
  toolDenied(toolName: string, reason: string): VivimAIError {
    return new VivimAIError({ code: 'TOOL_DENIED', message: `Tool "${toolName}" denied: ${reason}`, retryable: false });
  },
  toolFailed(toolName: string, cause?: unknown): VivimAIError {
    return new VivimAIError(
      { code: 'TOOL_FAILED', message: `Tool "${toolName}" execution failed.`, retryable: false },
      { cause },
    );
  },
  contextTooLarge(maxTokens: number, actualTokens: number): VivimAIError {
    return new VivimAIError({
      code: 'CONTEXT_TOO_LARGE',
      message: `Context exceeds limit: ${actualTokens} > ${maxTokens}.`,
      retryable: false,
    });
  },
  cancelled(reason = 'Execution cancelled.'): VivimAIError {
    return new VivimAIError({ code: 'CANCELLED', message: reason, retryable: false });
  },
  timeout(timeoutMs: number): VivimAIError {
    return new VivimAIError({ code: 'TIMEOUT', message: `Execution exceeded timeout of ${timeoutMs}ms.`, retryable: true });
  },
  resourceUnavailable(reason: string): VivimAIError {
    return new VivimAIError({ code: 'RESOURCE_UNAVAILABLE', message: reason, retryable: true });
  },
  runtimeCrash(providerId: ProviderId, cause?: unknown): VivimAIError {
    return new VivimAIError(
      { code: 'RUNTIME_CRASH', message: `Provider ${providerId} runtime crashed.`, retryable: true, providerId },
      { cause },
    );
  },
  pluginInvalid(pluginName: string, reason: string): VivimAIError {
    return new VivimAIError({ code: 'PLUGIN_INVALID', message: `Plugin "${pluginName}" is invalid: ${reason}`, retryable: false });
  },
  pluginUntrusted(pluginName: string): VivimAIError {
    return new VivimAIError({
      code: 'PLUGIN_UNTRUSTED',
      message: `Plugin "${pluginName}" failed signature/trust verification.`,
      retryable: false,
    });
  },
  invalidRequest(message: string): VivimAIError {
    return new VivimAIError({ code: 'INVALID_REQUEST', message, retryable: false });
  },
  schemaViolation(message: string): VivimAIError {
    return new VivimAIError({ code: 'SCHEMA_VIOLATION', message, retryable: false });
  },
  protocolError(message: string, cause?: unknown): VivimAIError {
    return new VivimAIError({ code: 'PROTOCOL_ERROR', message, retryable: false }, { cause });
  },
  unknown(message: string, cause?: unknown): VivimAIError {
    return new VivimAIError({ code: 'UNKNOWN', message, retryable: false }, { cause });
  },
};

/** Non-idempotent operations (tool calls, provider install) must consult this before ever retrying. */
export function isSafeToRetry(error: AIError): boolean {
  const neverRetry: readonly AIErrorCode[] = [
    'INVALID_REQUEST', 'SCHEMA_VIOLATION', 'POLICY_DENIED', 'TOOL_DENIED',
    'CANCELLED', 'PLUGIN_INVALID', 'PLUGIN_UNTRUSTED', 'CAPABILITY_UNSUPPORTED',
  ];
  if (neverRetry.includes(error.code)) return false;
  return error.retryable;
}
