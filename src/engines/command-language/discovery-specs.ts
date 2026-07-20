import type { UnifiedCommandSpec } from './types.js'

/**
 * `?` prefix discovery command specs.
 * Help, search, and discovery commands.
 */
export const discoverySpecs: UnifiedCommandSpec[] = [
  {
    id: 'discovery_help',
    prefix: '?',
    namespace: 'discovery',
    title: 'Help',
    category: 'discovery',
    surfaces: ['cli', 'ui', 'api'],
    run: async () => ({ ok: true, toast: 'Showing help' }),
  },
  {
    id: 'discovery_providers',
    prefix: '?',
    namespace: 'discovery',
    title: 'List Providers',
    category: 'provider',
    surfaces: ['cli', 'ui', 'api'],
    run: async () => ({ ok: true, toast: 'Listing available providers' }),
  },
  {
    id: 'discovery_tags',
    prefix: '?',
    namespace: 'discovery',
    title: 'List Tags',
    category: 'tag',
    surfaces: ['cli', 'ui', 'api'],
    run: async () => ({ ok: true, toast: 'Listing tags' }),
  },
  {
    id: 'discovery_recent',
    prefix: '?',
    namespace: 'discovery',
    title: 'Recent Commands',
    category: 'system',
    surfaces: ['cli', 'ui', 'api'],
    run: async () => ({ ok: true, toast: 'Showing recent commands' }),
  },
  {
    id: 'discovery_search',
    prefix: '?',
    namespace: 'discovery',
    title: 'Search Commands',
    category: 'discovery',
    surfaces: ['cli', 'ui', 'api'],
    args: [{ name: 'query', kind: 'text', placeholder: 'Search query', required: true }],
    run: async (args) => ({
      ok: true,
      toast: `Searching for: ${args.query}`,
    }),
  },
]
