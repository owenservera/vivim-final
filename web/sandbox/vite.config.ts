import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
      '@ui': '../ui/src',
      '@api-client': '../api-client/src',
    },
  },
})