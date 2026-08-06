// tsup.config.ts — Build configuration for vivim-final
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false, // Disabled: rollup-plugin-dts@6.1.1 crashes with TS 5.7+; use tsc --noEmit for type safety
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  target: 'node20',
  platform: 'node',
  external: ['@prisma/client', 'bun:sqlite'],
  noExternal: [],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
