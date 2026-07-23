/**
 * sdk/canvas/define-component.ts
 * --------------------------------------------------------------------
 * G1.1 — `defineComponent(input)`: Zod-validated builder for a
 * CanvasDefinition. Plugin authors call this to ship UI without
 * touching core. The returned object is ready for `publish(def)`.
 *
 * Validation rules:
 *  - slug, name, html, css required
 *  - sandbox.allowInlineScript must be literal `false` (P8)
 *  - html must NOT contain inline <script> tags (P8)
 *  - layout bounds positive
 *  - tags ≤ 16 entries
 */

import { z } from 'zod';
import type { CanvasDefinition, LayerAuthor, LayerStatus, LayerCategory, LayerBinding, CanvasLayout, SandboxPolicy } from '../../shared/canvas-types';
import { buildSandboxPolicy, DEFAULT_SANDBOX_CSP } from '../../shared/canvas-types';
import { ulid } from '../../lib/ulid';

const SANDBOX_POLICY_SCHEMA = z.object({
  csp: z.string().default(DEFAULT_SANDBOX_CSP),
  allowNetwork: z.boolean().default(false),
  allowCapabilities: z.array(z.string()).default([]),
  budgetMs: z.number().int().positive().default(5_000),
  allowInlineScript: z.literal(false), // FORCED false — S93
});

const LAYER_BINDING_SCHEMA = z.object({
  regionId: z.string(),
  role: z.string(),
  selector: z.string(),
  primitive: z.enum(['workspace', 'projects', 'knowledge', 'agents', 'providers', 'conversations']).optional(),
  capabilitySlug: z.string().optional(),
  direction: z.enum(['read', 'write', 'bidirectional']),
});

const LAYOUT_SCHEMA = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number().default(0),
  w: z.number().positive(),
  h: z.number().positive(),
  minimized: z.boolean().optional(),
  detailZoom: z.number().optional(),
});

export const CANVAS_DEFINITION_INPUT_SCHEMA = z.object({
  slug: z.string().min(1).max(128),
  name: z.string().min(1).max(256),
  description: z.string().max(2_048).default(''),
  category: z.enum(['system', 'chat', 'automation', 'agents', 'projects', 'knowledge', 'designer', 'plugin']).default('plugin'),
  html: z.string(),
  css: z.string().default(''),
  scriptUrl: z.string().url().optional(),
  bindings: z.array(LAYER_BINDING_SCHEMA).default([]),
  layout: LAYOUT_SCHEMA.default({ x: 0, y: 0, z: 0, w: 320, h: 240 }),
  sandbox: SANDBOX_POLICY_SCHEMA.optional(),
  author: z.enum(['system', 'user', 'agent']).default('user'),
  status: z.enum(['draft', 'published', 'deprecated']).default('published'),
  tags: z.array(z.string()).max(16).default([]),
});

export type CanvasDefinitionInput = z.infer<typeof CANVAS_DEFINITION_INPUT_SCHEMA>;

/**
 * Validate + build a CanvasDefinition. Throws on P8 violation
 * (inline script) or schema error. The returned object is ready
 * for `publish(def)`.
 *
 * @example
 *   const def = defineComponent({
 *     slug: 'chat.send.glow',
 *     name: 'Glowing Send Button',
 *     html: '<button class="send">Send</button>',
 *     css: '.send { background: #f59e0b; }',
 *     sandbox: { allowCapabilities: ['cap:message:send'] },
 *   });
 */
export function defineComponent(input: unknown): CanvasDefinition {
  const parsed = CANVAS_DEFINITION_INPUT_SCHEMA.parse(input);

  // P8: forbid inline <script> in html.
  if (/<script\b[^>]*>[\s\S]*?<\/script>/i.test(parsed.html) || /<script\b[^>]*>/i.test(parsed.html)) {
    throw new Error(
      'P8 violation: inline <script> tags are forbidden in CanvasDefinition.html. ' +
        'Use `scriptUrl` to load sandboxed JS via a Blob URL.',
    );
  }

  const now = Date.now();
  const sandbox: SandboxPolicy = parsed.sandbox
    ? {
        csp: parsed.sandbox.csp,
        allowNetwork: parsed.sandbox.allowNetwork,
        allowCapabilities: parsed.sandbox.allowCapabilities,
        budgetMs: parsed.sandbox.budgetMs,
        allowInlineScript: false, // literal type — always false
      }
    : buildSandboxPolicy({ allowCapabilities: [] });

  return {
    id: `cdef:${parsed.slug}:${now.toString(36)}`,
    slug: parsed.slug,
    name: parsed.name,
    description: parsed.description,
    category: parsed.category as LayerCategory,
    version: 1,
    html: parsed.html,
    css: parsed.css,
    scriptUrl: parsed.scriptUrl,
    bindings: parsed.bindings as LayerBinding[],
    layout: parsed.layout as CanvasLayout,
    author: parsed.author as LayerAuthor,
    sandbox,
    status: parsed.status as LayerStatus,
    tags: parsed.tags,
    createdAt: now,
    updatedAt: now,
  };
}
