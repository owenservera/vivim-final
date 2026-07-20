import type { UnifiedCommandSpec } from './types.js'

/**
 * `#<tag>` command specs.
 * Tag management for conversations.
 */
export const tagSpecs: UnifiedCommandSpec[] = [
  {
    id: 'tag_add',
    prefix: '#',
    namespace: 'tag',
    title: 'Add Tag',
    category: 'tag',
    surfaces: ['cli', 'ui', 'api'],
    args: [{ name: 'tag', kind: 'tag', placeholder: 'Tag name', required: true }],
    run: async (args) => ({
      ok: true,
      toast: `Tagged as: ${args.tag}`,
    }),
  },
  {
    id: 'tag_list',
    prefix: '#',
    namespace: 'tag',
    title: 'List Tags',
    category: 'tag',
    surfaces: ['cli', 'ui', 'api'],
    run: async () => ({ ok: true, toast: 'Listing tags' }),
  },
  {
    id: 'tag_search',
    prefix: '#',
    namespace: 'tag',
    title: 'Search by Tag',
    category: 'tag',
    surfaces: ['cli', 'ui', 'api'],
    args: [{ name: 'query', kind: 'text', placeholder: 'Search query', required: true }],
    run: async (args) => ({
      ok: true,
      toast: `Searching tags: ${args.query}`,
    }),
  },
]
