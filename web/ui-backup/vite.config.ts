import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'shared': resolve(__dirname, '..', '..', 'shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': process.env.VITE_API_URL ?? 'http://localhost:9420',
      '/health': process.env.VITE_API_URL ?? 'http://localhost:9420',
      '/ws': {
        target: process.env.VITE_API_URL ?? 'http://localhost:9420',
        ws: true,
      },
    },
  },
})
