/**
 * scripts/tauri/prepare-frontend.ts
 * ------------------------------------
 * Ensures the frontend can be statically exported for Tauri.
 * Called by `beforeBuildCommand` in tauri.conf.json.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');
const frontendDir = resolve(root, 'frontend');

function main() {
  console.log('[prepare-frontend] Ensuring static export readiness...');

  // Ensure fonts directory exists (layout.tsx references them)
  const fontsDir = resolve(frontendDir, 'public/fonts');
  if (!existsSync(fontsDir)) {
    mkdirSync(fontsDir, { recursive: true });
    console.log('[prepare-frontend] Created public/fonts/ (add font files before building)');
  }

  console.log('[prepare-frontend] Frontend ready for static export.');
}

main();
