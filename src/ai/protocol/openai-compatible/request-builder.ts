/**
 * VIVIM AI Gateway — OpenAI-Compatible Request Builder
 * @module ai/protocol/openai-compatible/request-builder
 *
 * Translates canonical AIRequest → OpenAI ChatCompletionRequest body.
 */

import type {
  AIRequest,
  ContentPart,
  Message,
  TextContent,
  ToolDefinition,
} from '../../core/types.js'
import type { OpenAICompatibleManifest } from './manifest.js'

interface OpenAIChatCompletionRequest {
  model: string
  messages: Array<{
    role: string
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
    name?: string
    tool_call_id?: string
  }>
  stream: boolean
  temperature?: number
  top_p?: number
  max_tokens?: number
  stop?: string[]
  seed?: number
  frequency_penalty?: number
  presence_penalty?: number
  tools?: Array<{
    type: 'function'
    function: {
      name: string
      description?: string
      parameters: unknown
    }
  }>
  response_format?:
    | { type: 'text' | 'json_object' }
    | { type: 'json_schema'; json_schema: { name: string; schema: unknown; strict?: boolean } }
}

export function buildChatCompletionRequest(
  request: AIRequest,
  manifest: OpenAICompatibleManifest,
): OpenAIChatCompletionRequest {
  const model = resolveModelName(request, manifest)
  const messages = (request.messages ?? []).map((m) => translateMessage(m))

  const body: OpenAIChatCompletionRequest = {
    model,
    messages,
    stream: true,
  }

  // Generation config
  if (request.generation) {
    const g = request.generation
    if (g.temperature !== undefined) body.temperature = g.temperature
    if (g.topP !== undefined) body.top_p = g.topP
    if (g.maxOutputTokens !== undefined) body.max_tokens = g.maxOutputTokens
    if (g.stopSequences) body.stop = [...g.stopSequences]
    if (g.seed !== undefined) body.seed = g.seed
    if (g.frequencyPenalty !== undefined) body.frequency_penalty = g.frequencyPenalty
    if (g.presencePenalty !== undefined) body.presence_penalty = g.presencePenalty
  }

  // Tools
  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools.map((t) => translateTool(t))
  }

  // Response format
  if (request.responseFormat) {
    if (request.responseFormat.type === 'text') {
      body.response_format = { type: 'text' }
    } else if (request.responseFormat.type === 'json') {
      body.response_format = { type: 'json_object' }
    } else if (request.responseFormat.type === 'json-schema') {
      body.response_format = {
        type: 'json_schema',
        json_schema: {
          name: request.responseFormat.name,
          schema: request.responseFormat.schema,
          strict: request.responseFormat.strict,
        },
      }
    }
  }

  // Apply manifest-level request patches
  if (manifest.extensions?.requestPatches) {
    Object.assign(body, manifest.extensions.requestPatches)
  }

  return body
}

function resolveModelName(request: AIRequest, manifest: OpenAICompatibleManifest): string {
  // If request pins a modelId, find its openAIModelName in the manifest
  if (request.model?.modelId) {
    const entry = manifest.models.find((m) => m.modelId === request.model?.modelId)
    if (entry) return entry.openAIModelName
    // If not in manifest, maybe it's already an openAIModelName
    return request.model.modelId as string
  }
  // Default: first model marked isDefault, or first model in manifest
  const defaultEntry = manifest.models.find((m) => m.isDefault) ?? manifest.models[0]
  if (defaultEntry) return defaultEntry.openAIModelName
  throw new Error(`Manifest ${manifest.providerId} has no models and request didn't pin one`)
}

function translateMessage(m: Message): OpenAIChatCompletionRequest['messages'][number] {
  const content = translateContent(m.content)
  const out: OpenAIChatCompletionRequest['messages'][number] = {
    role: m.role,
    content,
  }
  if (m.name) out.name = m.name
  if (m.toolCallId) out.tool_call_id = m.toolCallId as string
  return out
}

function translateContent(
  content: readonly ContentPart[],
): string | Array<{ type: string; text?: string; image_url?: { url: string } }> {
  // If all parts are text, concatenate into a single string (most compatible)
  const allText = content.every((c) => c.type === 'text')
  if (allText) {
    return content.map((c) => (c as TextContent).text).join('')
  }
  // Otherwise, return as array of content parts
  return content.map((c) => {
    if (c.type === 'text') {
      return { type: 'text', text: (c as TextContent).text }
    }
    if (c.type === 'image') {
      const img = c as {
        type: 'image'
        source: { kind: string; url?: string; data?: string; mediaType?: string }
      }
      const url =
        img.source.kind === 'url'
          ? img.source.url!
          : img.source.kind === 'data'
            ? `data:${img.source.mediaType ?? 'image/png'};base64,${img.source.data}`
            : ''
      return { type: 'image_url', image_url: { url } }
    }
    // Other content types fall back to JSON string
    return { type: 'text', text: JSON.stringify(c) }
  })
}

function translateTool(t: ToolDefinition): {
  type: 'function'
  function: { name: string; description?: string; parameters: unknown }
} {
  return {
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }
}
