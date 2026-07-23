/**
 * storage/impl/memory-canvas-definition-store.ts
 * --------------------------------------------------------------------
 * In-memory CanvasDefinition store. Zod-validated at boundaries; rejects
 * inline scripts (P8). Publishing is a row write — no compile step.
 */

import { z } from 'zod';
import type { CanvasDefinition, LayerStatus } from '../../shared/canvas-types';
import { buildSandboxPolicy } from '../../shared/canvas-types';
import type { CanvasDefinitionInput, CanvasDefinitionStore } from '../contracts/canvas-definition-store';

const SANDBOX_POLICY_SCHEMA = z.object({
  csp: z.string(),
  allowNetwork: z.boolean(),
  allowCapabilities: z.array(z.string()),
  budgetMs: z.number().int().positive(),
  allowInlineScript: z.literal(false), // S93 invariant: forced false
});

const CANVAS_DEF_INPUT_SCHEMA = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.enum([
    'system', 'chat', 'automation', 'agents', 'projects', 'knowledge', 'designer', 'plugin',
  ]),
  html: z.string(),
  css: z.string(),
  scriptUrl: z.string().optional(),
  bindings: z
    .array(z.object({
      regionId: z.string(),
      role: z.string(),
      selector: z.string(),
      primitive: z.enum(['workspace', 'projects', 'knowledge', 'agents', 'providers', 'conversations']).optional(),
      capabilitySlug: z.string().optional(),
      direction: z.enum(['read', 'write', 'bidirectional']),
    }))
    .optional(),
  layout: z.object({
    x: z.number(), y: z.number(), z: z.number(), w: z.number(), h: z.number(),
    minimized: z.boolean().optional(),
    detailZoom: z.number().optional(),
  }).optional(),
  sandbox: SANDBOX_POLICY_SCHEMA.optional(),
  author: z.enum(['system', 'user', 'agent']).optional(),
  status: z.enum(['draft', 'published', 'deprecated']).optional(),
  tags: z.array(z.string()).optional(),
}).strict();

export class MemoryCanvasDefinitionStore implements CanvasDefinitionStore {
  private rows = new Map<string, CanvasDefinition>();
  private bySlug = new Map<string, CanvasDefinition>();

  async define(input: CanvasDefinitionInput): Promise<CanvasDefinition> {
    const parsed = CANVAS_DEF_INPUT_SCHEMA.parse(input) as CanvasDefinitionInput;
    // P8: scan html for inline <script> — forbid at publish time.
    if (/<script\b[^>]*>[^<]*<\/script>/i.test(parsed.html) || /<script\b[^>]*>/i.test(parsed.html)) {
      throw new Error('P8 violation: inline <script> tags are forbidden in CanvasDefinition.html');
    }
    const now = Date.now();
    const id = `cdef:${parsed.slug}:${now.toString(36)}`;
    const def: CanvasDefinition = {
      id,
      slug: parsed.slug,
      name: parsed.name,
      description: parsed.description,
      category: parsed.category,
      version: 1,
      html: parsed.html,
      css: parsed.css,
      scriptUrl: parsed.scriptUrl,
      bindings: parsed.bindings ?? [],
      layout: parsed.layout ?? { x: 0, y: 0, z: 0, w: 320, h: 240 },
      author: parsed.author ?? 'system',
      sandbox: parsed.sandbox ?? buildSandboxPolicy({ allowCapabilities: [] }),
      status: parsed.status ?? 'published',
      tags: parsed.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    // Replace any existing definition with the same slug (hot-swap).
    const existing = this.bySlug.get(def.slug);
    if (existing) {
      def.version = existing.version + 1;
      def.createdAt = existing.createdAt;
      this.rows.delete(existing.id);
    }
    this.rows.set(id, def);
    this.bySlug.set(def.slug, def);
    return def;
  }

  async get(id: string): Promise<CanvasDefinition | null> {
    return this.rows.get(id) ?? null;
  }

  async getBySlug(slug: string): Promise<CanvasDefinition | null> {
    return this.bySlug.get(slug) ?? null;
  }

  async list(filter?: { category?: string; status?: LayerStatus }): Promise<CanvasDefinition[]> {
    const all = [...this.rows.values()];
    return all.filter((r) => {
      if (filter?.category && r.category !== filter.category) return false;
      if (filter?.status && r.status !== filter.status) return false;
      return true;
    });
  }

  async update(id: string, patch: Partial<CanvasDefinitionInput>): Promise<CanvasDefinition> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`CanvasDefinition not found: ${id}`);
    // Re-validate the patched document.
    const merged: CanvasDefinitionInput = {
      slug: existing.slug,
      name: existing.name,
      description: existing.description,
      category: existing.category,
      html: existing.html,
      css: existing.css,
      scriptUrl: existing.scriptUrl,
      bindings: existing.bindings,
      layout: existing.layout,
      sandbox: existing.sandbox,
      author: existing.author,
      status: existing.status,
      tags: existing.tags,
      ...patch,
    };
    const reparsed = CANVAS_DEF_INPUT_SCHEMA.parse(merged) as CanvasDefinitionInput;
    if (/<script\b[^>]*>/i.test(reparsed.html)) {
      throw new Error('P8 violation: inline <script> tags are forbidden in CanvasDefinition.html');
    }
    const updated: CanvasDefinition = {
      ...existing,
      slug: reparsed.slug,
      name: reparsed.name,
      description: reparsed.description,
      category: reparsed.category,
      html: reparsed.html,
      css: reparsed.css,
      scriptUrl: reparsed.scriptUrl,
      bindings: reparsed.bindings ?? [],
      layout: reparsed.layout ?? existing.layout,
      author: reparsed.author ?? existing.author,
      status: reparsed.status ?? existing.status,
      tags: reparsed.tags ?? existing.tags,
      sandbox: reparsed.sandbox ?? buildSandboxPolicy({ allowCapabilities: [] }),
      version: existing.version + 1,
      updatedAt: Date.now(),
    };
    this.rows.set(id, updated);
    this.bySlug.set(updated.slug, updated);
    return updated;
  }

  async deprecate(id: string): Promise<boolean> {
    const existing = this.rows.get(id);
    if (!existing) return false;
    existing.status = 'deprecated';
    existing.updatedAt = Date.now();
    return true;
  }
}
