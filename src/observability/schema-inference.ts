/**
 * @module observability/schema-inference
 *
 * TypeScript port of the Rust SchemaInferrer.
 * Fingerprinting HTTP traffic to infer JSON Schema types, track schema
 * evolution, and diff between samples.
 *
 * @example
 * ```ts
 * const inferrer = new SchemaInferrer();
 * const schema = inferrer.inferFromSample({ name: 'Alice', age: 30 });
 * // → { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number' } }, required: ['name', 'age'] }
 * ```
 */

// ── Types ────────────────────────────────────────────────────────────────

/** Subset of JSON Schema used for inferred types. */
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  description?: string;
  definitions?: Record<string, JsonSchema>;
  [key: string]: unknown;
}

/** Description of a single change between two schema versions. */
export interface SchemaChange {
  type: 'added' | 'removed' | 'type_changed' | 'required_added' | 'required_removed';
  path: string;
  detail: string;
}

/** Result of diffing two schemas. */
export interface SchemaDiff {
  changes: SchemaChange[];
  hasBreaking: boolean;
}

/** A single sample in the evolution history. */
export interface SchemaSample {
  schema: JsonSchema;
  timestamp: string;
  source?: string;
}

/** Report on schema evolution over time. */
export interface EvolutionReport {
  totalSamples: number;
  firstSeen: string | null;
  lastSeen: string | null;
  stabilityScore: number;
  diffs: Array<{ from: string; to: string; diff: SchemaDiff }>;
}

// ── Schema Inferrer ───────────────────────────────────────────────────────

/**
 * Infers a JSON Schema from a single data sample.
 *
 * Handles primitives, arrays, and nested objects recursively.
 * Produces `required` arrays for object types.
 */
export function inferFromSample(data: unknown): JsonSchema {
  if (data === null) {
    return { type: 'null' };
  }
  if (typeof data === 'boolean') {
    return { type: 'boolean' };
  }
  if (typeof data === 'number') {
    return { type: 'number' };
  }
  if (typeof data === 'string') {
    return { type: 'string' };
  }
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { type: 'array', items: {} };
    }
    // Merge schemas from all elements to find the most permissive type
    const merged = data.reduce((acc, item) => {
      const itemSchema = inferFromSample(item);
      return mergeSchemas(acc, itemSchema);
    }, inferFromSample(data[0]));
    return { type: 'array', items: merged };
  }
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
    if (entries.length === 0) {
      return { type: 'object', properties: {} };
    }
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    for (const [key, value] of entries) {
      properties[key] = inferFromSample(value);
      required.push(key);
    }
    return { type: 'object', properties, required };
  }
  // Fallback for functions, symbols, etc.
  return {};
}

/**
 * Merge two JSON schemas into a union type that accommodates both.
 *
 * For example, merging `{ type: 'string' }` and `{ type: 'number' }`
 * yields `{ type: ['string', 'number'] }`.
 */
export function mergeSchemas(a: JsonSchema, b: JsonSchema): JsonSchema {
  if (a.type && b.type) {
    const aTypes = Array.isArray(a.type) ? a.type : [a.type];
    const bTypes = Array.isArray(b.type) ? b.type : [b.type];
    const union = [...new Set([...aTypes, ...bTypes])];
    if (union.length === 1) {
      return { ...a, ...b, type: union[0] };
    }
    return { ...a, ...b, type: union };
  }
  return { ...a, ...b };
}

// ── Schema Diffing ─────────────────────────────────────────────────────────

/**
 * Compute the diff between two JSON Schema versions.
 *
 * Detects property additions/removals, type changes, and required-field changes.
 * A change is "breaking" if a previously required field is removed or
 * its type changes incompatibly.
 */
export function diffSchemas(oldSchema: JsonSchema, newSchema: JsonSchema): SchemaDiff {
  const changes: SchemaChange[] = [];
  let hasBreaking = false;

  // Top-level type change
  if (oldSchema.type && newSchema.type && oldSchema.type !== newSchema.type) {
    changes.push({
      type: 'type_changed',
      path: '/type',
      detail: `Type changed from ${oldSchema.type} to ${newSchema.type}`,
    });
    hasBreaking = true;
  }

  // Property-level changes
  const oldProps = oldSchema.properties ?? {};
  const newProps = newSchema.properties ?? {};
  const oldRequired = new Set(oldSchema.required ?? []);
  const newRequired = new Set(newSchema.required ?? []);

  for (const key of Object.keys(newProps)) {
    if (!(key in oldProps)) {
      changes.push({
        type: 'added',
        path: `/properties/${key}`,
        detail: `Property '${key}' was added`,
      });
    }
  }

  for (const key of Object.keys(oldProps)) {
    if (!(key in newProps)) {
      changes.push({
        type: 'removed',
        path: `/properties/${key}`,
        detail: `Property '${key}' was removed`,
      });
      if (oldRequired.has(key)) {
        hasBreaking = true;
      }
    } else {
      // Check type change for existing property
      const oldType = oldProps[key].type;
      const newType = newProps[key].type;
      if (oldType && newType && oldType !== newType) {
        changes.push({
          type: 'type_changed',
          path: `/properties/${key}/type`,
          detail: `Property '${key}' type changed from ${oldType} to ${newType}`,
        });
        if (oldRequired.has(key)) {
          hasBreaking = true;
        }
      }
    }
  }

  // Required changes
  for (const key of newRequired) {
    if (!oldRequired.has(key) && key in oldProps) {
      changes.push({
        type: 'required_added',
        path: ``,
        detail: `Property '${key}' became required`,
      });
      hasBreaking = true;
    }
  }

  for (const key of oldRequired) {
    if (!newRequired.has(key) && key in newProps) {
      changes.push({
        type: 'required_removed',
        path: ``,
        detail: `Property '${key}' is no longer required`,
      });
    }
  }

  return { changes, hasBreaking };
}

// ── Schema Evolution Tracker ──────────────────────────────────────────────

/**
 * Tracks schema evolution across a timeline of samples.
 *
 * Maintains an ordered history and computes diffs between consecutive
 * samples to detect API contract drift.
 */
export class SchemaEvolutionTracker {
  private history: SchemaSample[] = [];
  private _maxHistory = 100;

  constructor(maxHistory?: number) {
    if (maxHistory !== undefined) {
      this._maxHistory = maxHistory;
    }
  }

  /**
   * Record a new schema sample.
   */
  recordSample(sample: SchemaSample): void {
    this.history.push(sample);
    if (this.history.length > this._maxHistory) {
      this.history.shift();
    }
  }

  /**
   * Generate a report on schema evolution across all recorded samples.
   */
  trackEvolution(): EvolutionReport {
    if (this.history.length === 0) {
      return {
        totalSamples: 0,
        firstSeen: null,
        lastSeen: null,
        stabilityScore: 1.0,
        diffs: [],
      };
    }

    const diffs: EvolutionReport['diffs'] = [];
    let changeCount = 0;

    for (let i = 1; i < this.history.length; i++) {
      const prev = this.history[i - 1]!;
      const curr = this.history[i]!;
      const diff = diffSchemas(prev.schema, curr.schema);
      if (diff.changes.length > 0) {
        diffs.push({
          from: prev.timestamp,
          to: curr.timestamp,
          diff,
        });
        changeCount++;
      }
    }

    const stabilityScore =
      this.history.length > 1
        ? 1 - changeCount / (this.history.length - 1)
        : 1.0;

    return {
      totalSamples: this.history.length,
      firstSeen: this.history[0]!.timestamp,
      lastSeen: this.history[this.history.length - 1]!.timestamp,
      stabilityScore: Math.max(0, Math.min(1, stabilityScore)),
      diffs,
    };
  }

  /** Get the current (latest) schema. */
  get currentSchema(): JsonSchema | null {
    if (this.history.length === 0) return null;
    return this.history[this.history.length - 1]!.schema;
  }
}
