import { defineConfig } from 'bun:test'

export default defineConfig({
  exclude: [
    'node_modules',
    'research-clones',
    'dist',
    '.runtime',
    'docs/dev-code-impl/**',
  ],
})
