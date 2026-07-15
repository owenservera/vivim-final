import { defineConfig } from 'vite'
import { existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The `@ui` / sibling imports use Bun's `.js`-means-`.ts` convention. Vite does
// not rewrite explicit `.js` specifiers, so resolve them to the real `.ts(x)`
// file when present.
function resolveTsExtensions() {
  return {
    name: 'resolve-ts-extensions',
    resolveId(source: string, importer?: string) {
      if (!importer || !source.endsWith('.js')) return null
      const base = resolve(dirname(importer), source).replace(/\.js$/, '')
      for (const ext of ['.ts', '.tsx', '.jsx']) {
        if (existsSync(base + ext)) return base + ext
      }
      return null
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), resolveTsExtensions()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:9420',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:9420',
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      '@ui': join(__dirname, '..', 'ui', 'src'),
      '@api-client': join(__dirname, '..', 'api-client', 'src'),
    },
  },
})
