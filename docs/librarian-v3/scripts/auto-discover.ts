#!/usr/bin/env bun
/**
 * LIVIN-LIB v3 — Auto Discovery Script (starter)
 * Phase A automation: parses source code and builds .runtime/docs-inventory.json
 *
 * Usage:
 *   bun run docs/librarian-v3/scripts/auto-discover.ts
 */

import { readdirSync, statSync, readFileSync } from 'fs';
import { join, relative } from 'path';

// Minimal discovery: read package.json, tsconfig, .env.example, and list src files
const ROOT = process.cwd();

interface InventoryItem {
  type: 'file' | 'table' | 'command' | 'route' | 'env_var';
  path?: string;
  name: string;
  source_ref?: string; // the line/file that defines it
  discovered_at: string;
}

interface Inventory {
  source_commit: string;
  discovered_at: string;
  items: InventoryItem[];
  stats: { files_scanned: number; tables_found: number; commands_found: number };
}

function scanDir(dir: string): string[] {
  let files: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        files = files.concat(scanDir(full));
      } else if (s.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx') || entry.endsWith('.prisma') || entry.endsWith('.env.example') || entry === 'package.json')) {
        files.push(relative(ROOT, full));
      }
    }
  } catch (e) {
    // ignore unreadable dirs
  }
  return files;
}

function main() {
  const files = scanDir(join(ROOT, 'src'))
    .concat(scanDir(join(ROOT, 'frontend/src')).map(f => 'frontend/' + f))
    .concat(scanDir(join(ROOT, 'prisma')));

  const inventory: Inventory = {
    source_commit: require('child_process').execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
    discovered_at: new Date().toISOString(),
    items: [
      // Starter entry: package.json engines
      { type: 'file', path: 'package.json', name: 'package.json', source_ref: 'root package', discovered_at: new Date().toISOString() },
      // Every .ts file found is an inventory item (expanded by full parser)
      ...files.map(f => ({ type: 'file' as const, path: f, name: f.split('/').pop() || f, source_ref: f, discovered_at: new Date().toISOString() })),
    ],
    stats: {
      files_scanned: files.length,
      tables_found: 0, // expanded by full parser reading schema.prisma
      commands_found: 0, // expanded by full parser reading Rust/TS command definitions
    },
  };

  const outDir = join(ROOT, '.runtime');
  try {
    readdirSync(outDir);
  } catch {
    // .runtime may not exist; we'll create parent
    const { mkdirSync } = require('fs');
    mkdirSync(outDir, { recursive: true });
  }

  const outPath = join(outDir, 'docs-inventory.json');
  const { writeFileSync } = require('fs');
  writeFileSync(outPath, JSON.stringify(inventory, null, 2));
  console.log(`LIVIN-LIB v3: Discovery complete.`);
  console.log(`  Source commit: ${inventory.source_commit}`);
  console.log(`  Files scanned: ${inventory.stats.files_scanned}`);
  console.log(`  Inventory written to: ${outPath}`);
}

main();
