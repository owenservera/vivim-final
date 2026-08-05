// src/arch/boundary-rules.ts
// Architectural boundary rules for build-time validation.
// Each rule defines allowed import sources for a target layer.
//
// These rules enforce the VIVIM layered architecture by declaring, for every
// architectural layer, exactly which other layers (and external packages) it
// may import from. The boundary-scanner uses these rules to detect violations.

import { resolve } from 'node:path'

// ── Types ───────────────────────────────────────────────────────────────────

/** A single architectural boundary rule. */
export interface BoundaryRule {
  /** Machine-readable layer identifier used in violation reports */
  layer: string
  /** Human-readable layer name for display in reports */
  name: string
  /** Absolute path prefix — files whose resolved path starts with this belong to the layer */
  prefix: string
  /** Layer names this layer is allowed to import from */
  mayImportFrom: string[]
  /** External import patterns that are always allowed (e.g. node:, bun:, zod) */
  allowedExternals: string[]
}

/** Result of checking whether an import is permitted. */
export interface ImportVerdict {
  allowed: boolean
  reason?: string
}

// ── Project root ────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dir, '..', '..')

// ── Rule definitions ───────────────────────────────────────────────────────

/**
 * Boundary rules ordered from most foundational to most surface-level.
 *
 * Dependency direction flows downward: a layer may only import layers
 * listed in its `mayImportFrom`. Every layer implicitly may import
 * its own layer (same-layer imports are always allowed).
 */
export const BOUNDARY_RULES: BoundaryRule[] = [
  // ── Layer 0: Shared type contracts ──────────────────────────────────────
  // Pure type definitions with zero runtime deps. Nothing else in the
  // project should be imported here.
  {
    layer: 'shared',
    name: 'Shared Type Contracts',
    prefix: resolve(ROOT, 'shared'),
    mayImportFrom: [],
    allowedExternals: ['node:', 'bun:'],
  },

  // ── Layer 1: src/ foundation files ──────────────────────────────────────
  // Files directly under src/ that form the project foundation:
  // errors.ts, config.ts, ids.ts, index.ts, etc.
  {
    layer: 'src-foundation',
    name: 'Source Foundation',
    prefix: resolve(ROOT, 'src'),
    mayImportFrom: ['shared'],
    allowedExternals: ['node:', 'bun:'],
  },

  // ── Layer 2: Storage contracts ──────────────────────────────────────────
  // Pure interfaces — no implementation deps.
  {
    layer: 'storage-contracts',
    name: 'Storage Contracts',
    prefix: resolve(ROOT, 'src', 'storage', 'contracts'),
    mayImportFrom: ['shared'],
    allowedExternals: ['node:', 'bun:', 'zod'],
  },

  // ── Layer 3: Storage implementations ────────────────────────────────────
  // Concrete store implementations. May depend on contracts, shared types,
  // and the Prisma client.
  {
    layer: 'storage-impl',
    name: 'Storage Implementations',
    prefix: resolve(ROOT, 'src', 'storage', 'impl'),
    mayImportFrom: ['shared', 'src-foundation', 'storage-contracts', 'storage-infra'],
    allowedExternals: ['node:', 'bun:', '@prisma'],
  },

  // ── Layer 3b: Storage infrastructure ────────────────────────────────────
  // Prisma client, DB setup, store-factory — glue between contracts and impl.
  {
    layer: 'storage-infra',
    name: 'Storage Infrastructure',
    prefix: resolve(ROOT, 'src', 'storage'),
    mayImportFrom: ['shared', 'src-foundation', 'storage-contracts'],
    allowedExternals: ['node:', 'bun:', '@prisma'],
  },

  // ── Layer 4: Engines ────────────────────────────────────────────────────
  // Core business logic engines. Depend on storage contracts (not impl),
  // shared types, and the foundation errors module.
  {
    layer: 'engines',
    name: 'Engine Layer',
    prefix: resolve(ROOT, 'src', 'engines'),
    mayImportFrom: ['shared', 'src-foundation', 'storage-contracts'],
    allowedExternals: ['node:', 'bun:', 'zod'],
  },

  // ── Layer 5: Executor (Chrome CDP) ──────────────────────────────────────
  // Chrome browser automation substrate. Depends on shared types and engines.
  {
    layer: 'executor',
    name: 'Chrome CDP Executor',
    prefix: resolve(ROOT, 'src', 'executor'),
    mayImportFrom: ['shared', 'src-foundation', 'engines'],
    allowedExternals: ['node:', 'bun:'],
  },

  // ── Layer 6: Server (API surface) ───────────────────────────────────────
  // HTTP/WebSocket API. May import engines, storage, and shared.
  {
    layer: 'server',
    name: 'API Server',
    prefix: resolve(ROOT, 'src', 'server'),
    mayImportFrom: [
      'shared',
      'src-foundation',
      'storage-contracts',
      'storage-infra',
      'storage-impl',
      'engines',
      'executor',
    ],
    allowedExternals: ['node:', 'bun:'],
  },

  // ── Layer 7: CLI surface ────────────────────────────────────────────────
  // Command-line interface. May import engines, storage, and shared.
  {
    layer: 'cli',
    name: 'CLI Surface',
    prefix: resolve(ROOT, 'src', 'cli'),
    mayImportFrom: [
      'shared',
      'src-foundation',
      'storage-contracts',
      'storage-infra',
      'storage-impl',
      'engines',
      'executor',
    ],
    allowedExternals: ['node:', 'bun:'],
  },

  // ── Layer 8: Frontend ───────────────────────────────────────────────────
  // React/Next.js frontend. May only import from shared/ from the backend.
  // Its own internal imports are unrestricted (within frontend/).
  {
    layer: 'frontend',
    name: 'Frontend',
    prefix: resolve(ROOT, 'frontend'),
    mayImportFrom: ['shared'],
    allowedExternals: ['node:', 'bun:', 'zod'],
  },

  // ── Layer 9: DevOps ─────────────────────────────────────────────────────
  // Operational tooling — may import anything.
  {
    layer: 'devops',
    name: 'DevOps Tools',
    prefix: resolve(ROOT, 'devops'),
    mayImportFrom: [
      'shared',
      'src-foundation',
      'storage-contracts',
      'storage-infra',
      'storage-impl',
      'engines',
      'executor',
      'server',
      'cli',
      'frontend',
    ],
    allowedExternals: ['node:', 'bun:'],
  },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Classify an absolute file path into its architectural layer.
 * Uses longest-prefix matching so that `src/storage/contracts/...`
 * matches `storage-contracts` (longer) rather than `storage-infra`.
 *
 * @returns The layer name (e.g. `'engines'`), or `undefined` if the path
 *          does not belong to any declared layer.
 */
export function classifyPath(
  absPath: string,
  rules: BoundaryRule[] = BOUNDARY_RULES,
): string | undefined {
  const normalized = absPath.replace(/\\/g, '/')
  let bestLayer: string | undefined
  let bestLen = 0
  for (const rule of rules) {
    const prefix = rule.prefix.replace(/\\/g, '/')
    if (normalized.startsWith(prefix + '/') || normalized === prefix) {
      if (prefix.length > bestLen) {
        bestLen = prefix.length
        bestLayer = rule.layer
      }
    }
  }
  return bestLayer
}

/**
 * Look up a rule by layer name.
 */
export function getRule(
  layer: string,
  rules: BoundaryRule[] = BOUNDARY_RULES,
): BoundaryRule | undefined {
  return rules.find((r) => r.layer === layer)
}

/**
 * Check whether an import from `fromLayer` to the given `importPath` is
 * allowed according to the boundary rules.
 *
 * @param fromLayer  The layer name of the importing file.
 * @param importPath The import specifier as written in source (may be
 *                   relative, aliased like `@/...` or `shared/...`,
 *                   or external like `node:fs`).
 * @param fromFile   Absolute path of the importing file (used to resolve
 *                   relative specifiers).
 * @param rules      The boundary rules to check against.
 */
export function isImportAllowed(
  fromLayer: string,
  importPath: string,
  rules: BoundaryRule[] = BOUNDARY_RULES,
): ImportVerdict {
  const fromRule = getRule(fromLayer, rules)
  if (!fromRule) {
    return { allowed: true, reason: `Unknown source layer: ${fromLayer}` }
  }

  // ── External imports (node:, bun:, bare package names) ──────────────────
  const isExternal =
    importPath.startsWith('node:') ||
    importPath.startsWith('bun:') ||
    (!importPath.startsWith('.') &&
      !importPath.startsWith('@/') &&
      !importPath.startsWith('shared/'))

  if (isExternal) {
    // Extract the package name (everything before the first /)
    const pkgName = importPath.split('/')[0] ?? importPath
    const allowed = fromRule.allowedExternals.some((ext) => pkgName.startsWith(ext))
    if (allowed) return { allowed: true }
    return {
      allowed: false,
      reason: `Layer '${fromLayer}' may not import external package '${importPath}'`,
    }
  }

  // ── Path-alias imports ──────────────────────────────────────────────────
  // `shared/*` maps to `shared/` directory
  if (importPath.startsWith('shared/')) {
    if (fromRule.mayImportFrom.includes('shared')) {
      return { allowed: true }
    }
    return { allowed: false, reason: `Layer '${fromLayer}' may not import from 'shared/'` }
  }

  // `@/*` maps to `src/*`
  if (importPath.startsWith('@/')) {
    const targetAbs = resolve(ROOT, 'src', importPath.slice(2))
    const targetLayer = classifyPath(targetAbs, rules)
    if (!targetLayer) {
      // Couldn't classify — allow (could be a new unclassified file)
      return { allowed: true, reason: 'Target path unclassified' }
    }
    return checkLayerPermit(fromRule, fromLayer, targetLayer, importPath)
  }

  // ── Relative imports ────────────────────────────────────────────────────
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    // For relative imports, the scanner resolves the absolute path before
    // calling this function, so importPath should already be absolute.
    // But if called with a relative path, we note we can't fully resolve.
    return {
      allowed: true,
      reason: 'Relative import — requires resolved absolute path for checking',
    }
  }

  // ── Absolute resolved imports ───────────────────────────────────────────
  const targetLayer = classifyPath(importPath, rules)
  if (!targetLayer) {
    return { allowed: true, reason: 'Target path unclassified' }
  }
  return checkLayerPermit(fromRule, fromLayer, targetLayer, importPath)
}

/**
 * Check if one layer is permitted to import from another.
 */
function checkLayerPermit(
  fromRule: BoundaryRule,
  fromLayer: string,
  targetLayer: string,
  importPath: string,
): ImportVerdict {
  // Same-layer imports are always allowed
  if (fromLayer === targetLayer) {
    return { allowed: true }
  }

  if (fromRule.mayImportFrom.includes(targetLayer)) {
    return { allowed: true }
  }

  return {
    allowed: false,
    reason: `Layer '${fromLayer}' may not import from layer '${targetLayer}' (${importPath})`,
  }
}

/**
 * Resolve a path alias to an absolute path.
 * Handles `@/` → `src/`, `shared/` → `shared/` prefixes.
 */
export function resolveAlias(importPath: string): string | null {
  if (importPath.startsWith('shared/')) {
    return resolve(ROOT, importPath)
  }
  if (importPath.startsWith('@/')) {
    return resolve(ROOT, 'src', importPath.slice(2))
  }
  return null
}
