import type { UnifiedCommandSpec } from './types.js'

/**
 * `$cap:<namespace>:<action>` command parser.
 * Parses and validates capability direct invocation syntax.
 */
export interface ParsedCapability {
  namespace: string
  action: string
  raw: string
}

/**
 * Parse a `$cap:` command string.
 * Format: $cap:<namespace>:<action>
 */
export function parseCapCommand(input: string): ParsedCapability | null {
  if (!input.startsWith('$cap:')) return null

  const rest = input.slice(5) // Remove "$cap:"
  const parts = rest.split(':')

  if (parts.length < 2 || !parts[0] || !parts[1]) return null

  return {
    namespace: parts[0],
    action: parts[1],
    raw: input,
  }
}

/**
 * Validate a parsed capability command.
 */
export function validateCapCommand(parsed: ParsedCapability): string | null {
  if (parsed.namespace.length === 0) return 'Namespace is required'
  if (parsed.action.length === 0) return 'Action is required'
  if (!/^[a-z0-9_-]+$/.test(parsed.namespace)) {
    return 'Namespace must contain only lowercase letters, numbers, hyphens, and underscores'
  }
  if (!/^[a-z0-9_-]+$/.test(parsed.action)) {
    return 'Action must contain only lowercase letters, numbers, hyphens, and underscores'
  }
  return null
}

/**
 * Create a UnifiedCommandSpec for a `$cap:` command.
 */
export function createCapSpec(capabilityId: string): UnifiedCommandSpec {
  return {
    id: `cap_${capabilityId.replace(/:/g, '_')}`,
    prefix: '$',
    namespace: 'capability',
    title: `Capability: ${capabilityId}`,
    category: 'automation',
    surfaces: ['cli', 'ui', 'api'],
    run: async () => ({
      ok: true,
      toast: `Executing capability: ${capabilityId}`,
    }),
  }
}
