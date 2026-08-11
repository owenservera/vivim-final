/**
 * Schema Inference Engine
 * ========================
 * Pure-logic module that infers structural type shapes from JSON values,
 * computes SHA-256 hashes of those shapes, diffs them, and produces
 * compatibility reports.
 *
 * This is a TypeScript re-implementation of a Rust schema-inference
 * component. It has zero framework / runtime dependencies beyond Node.js
 * built-ins.
 */

import { createHash } from 'node:crypto';

// ─── Public Types ───────────────────────────────────────────────────────

/** Severity level for a detected schema change. */
export type ChangeSeverity = 'none' | 'minor' | 'critical';

/** A single diff operation between two structural shapes. */
export type DiffOp =
  | { kind: 'key_added'; path: string }
  | { kind: 'key_removed'; path: string }
  | { kind: 'type_changed'; path: string; oldType: string; newType: string };

/** A point-in-time snapshot of an API response shape. */
export interface SchemaSnapshot {
  /** SHA-256 hash of the structural shape. */
  hash: string;
  /** Identifier of the API provider. */
  providerId: string;
  /** Endpoint URL path. */
  endpoint: string;
  /** ISO-8601 timestamp of when this snapshot was taken. */
  timestamp: string;
  /** The inferred structural shape object. */
  shape: unknown;
}

/** Result of a compatibility assessment between two schema shapes. */
export interface CompatibilityReport {
  /** `true` when the change is backwards-compatible (only additions). */
  isCompatible: boolean;
  /** Worst severity found in the diff set. */
  severity: ChangeSeverity;
  /** Individual differences ordered depth-first. */
  diffs: DiffOp[];
}

// ─── Internal Helpers ───────────────────────────────────────────────────

/** Tag used for primitive type labels in structural shapes. */
type PrimLabel = 'string' | 'number' | 'boolean' | 'null' | 'undefined';

/**
 * Determine if a value is a plain object (not array, not null).
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ─── 1. inferShape ─────────────────────────────────────────────────────

/**
 * Recursively normalise an arbitrary JSON value into a structural type shape.
 *
 * Mapping rules:
 * - Primitives → their type name as a string (`"string"`, `"number"`, …)
 * - Objects → `{ key: <inferred shape of value>, … }`
 * - Arrays → array of **unique** element shapes (preserving order of first
 *   appearance of each distinct shape)
 *
 * @param val - Any JSON-compatible value.
 * @returns A structural shape suitable for hashing / diffing.
 */
export function inferShape(val: unknown): unknown {
  // ── Primitives ──
  if (val === undefined) return 'undefined' as PrimLabel;
  if (val === null) return 'null' as PrimLabel;
  if (typeof val === 'string') return 'string' as PrimLabel;
  if (typeof val === 'number') return 'number' as PrimLabel;
  if (typeof val === 'boolean') return 'boolean' as PrimLabel;

  // ── Arrays ──
  if (Array.isArray(val)) {
    if (val.length === 0) return [];

    const seen = new Set<string>();
    const uniqueShapes: unknown[] = [];

    for (const item of val) {
      const shape = inferShape(item);
      const key = JSON.stringify(shape);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueShapes.push(shape);
      }
    }
    return uniqueShapes;
  }

  // ── Plain objects ──
  if (isPlainObject(val)) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      result[k] = inferShape(v);
    }
    return result;
  }

  // Fallback (functions, symbols, etc.) — not expected in JSON payloads
  return 'unknown';
}

// ─── 2. computeHash ─────────────────────────────────────────────────────

/**
 * Compute a deterministic SHA-256 hex digest of a structural shape.
 *
 * The shape is canonicalised via `JSON.stringify` (with sorted keys) so
 * that structurally identical shapes always produce the same hash.
 *
 * @param shape - The structural shape returned by `inferShape`.
 * @returns Lower-case hex SHA-256 string (64 characters).
 */
export function computeHash(shape: unknown): string {
  const canonical = JSON.stringify(shape, Object.keys.bind(null, shape as object).length ? sortKeys : undefined);
  // Fallback: always sort to ensure determinism
  const sorted = canonicalise(shape);
  return createHash('sha256').update(sorted).digest('hex');
}

/**
 * Deterministic JSON serialisation with sorted keys at every level.
 */
function canonicalise(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (val as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return val;
  });
}

/** Dummy replacer helper — unused, canonicalise handles everything. */
function sortKeys(_key: string, _value: unknown): unknown {
  return _value;
}

// ─── 3. diffShapes ──────────────────────────────────────────────────────

/**
 * Recursively diff two structural shapes, producing a flat list of `DiffOp`s.
 *
 * @param oldShape - Baseline structural shape.
 * @param newShape - Current structural shape to compare against the baseline.
 * @param path     - Dot-separated path prefix for human-readable locations.
 * @returns Array of differences, depth-first ordered.
 */
export function diffShapes(
  oldShape: unknown,
  newShape: unknown,
  path: string = '',
): DiffOp[] {
  const diffs: DiffOp[] = [];
  const seg = (key: string) => (path ? `${path}.${key}` : key);

  // Both are plain objects — compare keys
  if (isPlainObject(oldShape) && isPlainObject(newShape)) {
    const oldKeys = new Set(Object.keys(oldShape));
    const newKeys = new Set(Object.keys(newShape));

    for (const key of newKeys) {
      if (!oldKeys.has(key)) {
        diffs.push({ kind: 'key_added', path: seg(key) });
      } else {
        diffs.push(...diffShapes(oldShape[key], newShape[key], seg(key)));
      }
    }

    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        diffs.push({ kind: 'key_removed', path: seg(key) });
      }
    }

    return diffs;
  }

  // Both are arrays — compare element-by-element
  if (Array.isArray(oldShape) && Array.isArray(newShape)) {
    const maxLen = Math.max(oldShape.length, newShape.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= oldShape.length) {
        diffs.push({ kind: 'key_added', path: `${path}[${i}]` });
      } else if (i >= newShape.length) {
        diffs.push({ kind: 'key_removed', path: `${path}[${i}]` });
      } else {
        diffs.push(...diffShapes(oldShape[i], newShape[i], `${path}[${i}]`));
      }
    }
    return diffs;
  }

  // Both are strings (type labels) — check for type change
  if (typeof oldShape === 'string' && typeof newShape === 'string') {
    if (oldShape !== newShape) {
      diffs.push({
        kind: 'type_changed',
        path: path || '$',
        oldType: oldShape,
        newType: newShape,
      });
    }
    return diffs;
  }

  // Structural mismatch (e.g. object vs. array, or object vs. primitive)
  diffs.push({
    kind: 'type_changed',
    path: path || '$',
    oldType: typeof oldShape,
    newType: typeof newShape,
  });

  return diffs;
}

// ─── 4. assessCompatibility ─────────────────────────────────────────────

/**
 * Assess backward-compatibility from a list of schema diffs.
 *
 * Rules:
 * - `key_removed`  → **critical** (breaking)
 * - `type_changed` → **critical** (breaking)
 * - `key_added`   → **minor** (non-breaking)
 * - No diffs      → **none** (fully compatible)
 *
 * @param diffs - The diff operations produced by `diffShapes`.
 * @returns A `CompatibilityReport` with worst-case severity.
 */
export function assessCompatibility(diffs: DiffOp[]): CompatibilityReport {
  if (diffs.length === 0) {
    return { isCompatible: true, severity: 'none', diffs: [] };
  }

  let hasCritical = false;
  let hasMinor = false;

  for (const d of diffs) {
    if (d.kind === 'key_removed' || d.kind === 'type_changed') {
      hasCritical = true;
    } else if (d.kind === 'key_added') {
      hasMinor = true;
    }
  }

  if (hasCritical) {
    return { isCompatible: false, severity: 'critical', diffs };
  }

  if (hasMinor) {
    return { isCompatible: true, severity: 'minor', diffs };
  }

  // Should not reach here, but handle defensively
  return { isCompatible: true, severity: 'none', diffs };
}
