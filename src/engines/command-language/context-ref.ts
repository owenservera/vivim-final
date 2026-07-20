import { ContextNotFoundError } from '../../errors.js'
import type { CommandContext } from './types.js'

/**
 * Resolve context references like `~last`, `~this`, `~msg:ID`, etc.
 * Returns the resolved string value.
 */
export function resolveContextRef(ref: string, ctx: CommandContext): string {
  const lower = ref.toLowerCase()

  // ~last — last assistant text
  if (lower === '~last') {
    if (!ctx.lastAssistantText) {
      throw new ContextNotFoundError('~last')
    }
    return ctx.lastAssistantText
  }

  // ~this — last user prompt
  if (lower === '~this') {
    if (!ctx.lastUserPrompt) {
      throw new ContextNotFoundError('~this')
    }
    return ctx.lastUserPrompt
  }

  // ~msg:ID — specific message (placeholder)
  if (lower.startsWith('~msg:')) {
    const msgId = ref.slice(5)
    if (!msgId) {
      throw new ContextNotFoundError('~msg:')
    }
    // In a real implementation, this would fetch from DB
    return `[message:${msgId}]`
  }

  // ~conv:ID — specific conversation (placeholder)
  if (lower.startsWith('~conv:')) {
    const convId = ref.slice(6)
    if (!convId) {
      throw new ContextNotFoundError('~conv:')
    }
    // In a real implementation, this would fetch from DB
    return `[conversation:${convId}]`
  }

  // ~file:path — file content (placeholder)
  if (lower.startsWith('~file:')) {
    const filePath = ref.slice(6)
    if (!filePath) {
      throw new ContextNotFoundError('~file:')
    }
    // In a real implementation, this would read the file
    return `[file:${filePath}]`
  }

  // ~active — active conversation
  if (lower === '~active') {
    if (!ctx.activeConvId) {
      throw new ContextNotFoundError('~active')
    }
    return ctx.activeConvId
  }

  // ~provider — active provider
  if (lower === '~provider') {
    if (!ctx.activeProvider) {
      throw new ContextNotFoundError('~provider')
    }
    return ctx.activeProvider
  }

  // Unknown reference — return as-is
  return ref
}

/**
 * Check if a string is a context reference.
 */
export function isContextRef(str: string): boolean {
  return str.startsWith('~')
}

/**
 * Get all available context ref types.
 */
export function getContextRefTypes(): Array<{ prefix: string; description: string }> {
  return [
    { prefix: '~last', description: 'Last assistant message' },
    { prefix: '~this', description: 'Last user prompt' },
    { prefix: '~msg:ID', description: 'Specific message by ID' },
    { prefix: '~conv:ID', description: 'Specific conversation by ID' },
    { prefix: '~file:path', description: 'File content' },
    { prefix: '~active', description: 'Active conversation ID' },
    { prefix: '~provider', description: 'Active provider name' },
  ]
}
