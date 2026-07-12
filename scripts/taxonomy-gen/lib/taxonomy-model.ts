// scripts/taxonomy-gen/lib/taxonomy-model.ts
//
// CANONICAL TAXONOMY MODEL — the master schema blueprint.
//
// This single model drives BOTH the generator's output AND the persisted database
// schema. The vivim-final goal is ONE master-schema-driven database that can be
// enriched at any time. Taxonomies are SHARED (a capability/protocol/tech-stack
// node is defined once and referenced by many platforms). Every node has a
// FUNCTIONAL CHAIN LINK to a protocol (cdp / dom / rest / ws / sse / mirroring):
//
//   platform ─uses→ webapp_tech_stack
//   platform ─exposes→ capability
//   capability ─implemented_by→ method
//   method ─uses_protocol→ protocol
//   method ─targets_tech_stack→ webapp_tech_stack
//   method ─parsed_by→ parser
//   protocol ─decoded_by→ parser
//   taxonomy_term ─synonym_of→ taxonomy_term (canonical)
//   taxonomy_term ─implies_protocol→ protocol   (probability)
//   capability ─has_probability→ probability_table
//
// The Prisma schema is a 1:1 projection of this model. Running the generator
// reveals missing fields, which completes the schema.

import { z } from 'zod'

// ── Controlled vocabularies ────────────────────────────────────────────────
export const PROTOCOLS = ['cdp', 'dom', 'rest', 'ws', 'sse', 'graphql', 'mirroring'] as const
export const TECH_STACK_FAMILIES = ['editor', 'framework', 'dom'] as const
export const PARSER_TYPES = ['sse', 'ndjson', 'batchexecute', 'frame', 'html-diff', 'json', 'xml', 'text'] as const
export const SELECTOR_TYPES = ['css', 'xpath', 'text', 'aria', 'data', 'regex', 'composite'] as const
export const SEND_METHODS = ['enter_key', 'button_click', 'both', 'none'] as const
export const CAPABILITY_KINDS = ['action', 'query', 'state', 'config', 'navigation'] as const

export type Protocol = (typeof PROTOCOLS)[number]
export type TechStackFamily = (typeof TECH_STACK_FAMILIES)[number]
export type ParserType = (typeof PARSER_TYPES)[number]
export type SelectorType = (typeof SELECTOR_TYPES)[number]
export type SendMethod = (typeof SEND_METHODS)[number]
export type CapabilityKind = (typeof CAPABILITY_KINDS)[number]

// ── Node kinds ──────────────────────────────────────────────────────────────
export const NODE_KINDS = [
  'platform',
  'capability',
  'protocol',
  'method',
  'webapp_tech_stack',
  'parser',
  'taxonomy_term',
  'probability_table',
] as const
export type NodeKind = (typeof NODE_KINDS)[number]

// ── Base node ───────────────────────────────────────────────────────────────
export const BaseNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(NODE_KINDS),
  slug: z.string().min(1),
  label: z.string().min(1),
  description: z.string().default(''),
  sourceConfidence: z.enum(['high', 'medium', 'low']).default('medium'),
  tags: z.array(z.string()).default([]),
  // shared nodes are defined once and referenced by many platforms
  shared: z.boolean().default(false),
})
export type BaseNode = z.infer<typeof BaseNodeSchema>

// ── Platform ────────────────────────────────────────────────────────────────
export const PlatformNodeSchema = BaseNodeSchema.extend({
  kind: z.literal('platform'),
  category: z.string(), // social_messaging|social_feed|ai_chatbot|...
  url: z.string().default(''),
  authType: z.string().default('browser'), // browser|api|oauth|none
  interactionPattern: z.string().default('feed'), // feed|chat|form|canvas
  techStackSlugs: z.array(z.string()).default([]), // → webapp_tech_stack nodes
})
export type PlatformNode = z.infer<typeof PlatformNodeSchema>

// ── Capability (shared action concept) ─────────────────────────────────────
export const CapabilityNodeSchema = BaseNodeSchema.extend({
  kind: z.literal('capability'),
  shared: z.literal(true),
  capabilityKind: z.enum(CAPABILITY_KINDS).default('action'),
})
export type CapabilityNode = z.infer<typeof CapabilityNodeSchema>

// ── Protocol (transport/channel) ───────────────────────────────────────────
export const ProtocolNodeSchema = BaseNodeSchema.extend({
  kind: z.literal('protocol'),
  shared: z.literal(true),
  transport: z.enum(PROTOCOLS),
})
export type ProtocolNode = z.infer<typeof ProtocolNodeSchema>

// ── Webapp tech stack (DOM/UI surface) ─────────────────────────────────────
export const WebappTechStackNodeSchema = BaseNodeSchema.extend({
  kind: z.literal('webapp_tech_stack'),
  shared: z.literal(true),
  family: z.enum(TECH_STACK_FAMILIES),
  // canonical composer/editor selector hints for this stack
  composerHint: z.string().default(''),
  sendHint: z.string().default(''),
})
export type WebappTechStackNode = z.infer<typeof WebappTechStackNodeSchema>

// ── Parser (streaming / mirror decoder) ────────────────────────────────────
export const ParserNodeSchema = BaseNodeSchema.extend({
  kind: z.literal('parser'),
  shared: z.literal(true),
  parserType: z.enum(PARSER_TYPES),
  fallbackSlug: z.string().nullable().default(null),
})
export type ParserNode = z.infer<typeof ParserNodeSchema>

// ── Method (executable mechanism: selector + protocol + tech stack) ─────────
export const MethodNodeSchema = BaseNodeSchema.extend({
  kind: z.literal('method'),
  // functional chain links
  capabilitySlug: z.string(), // → capability
  platformSlug: z.string(), // → platform
  protocolSlug: z.string(), // → protocol (cdp/dom/rest/...)
  techStackSlug: z.string().nullable().default(null), // → webapp_tech_stack
  parserSlug: z.string().nullable().default(null), // → parser
  // the executable spec
  selectorType: z.enum(SELECTOR_TYPES).default('css'),
  selectorValue: z.string().default(''),
  sendMethod: z.enum(SEND_METHODS).default('both'),
  programConfigJson: z.string().default('{}'), // CapabilityProgram.config_json
  recoveryStrategies: z.array(z.string()).default(['retry_selector', 'navigate_home']),
})
export type MethodNode = z.infer<typeof MethodNodeSchema>

// ── Taxonomy term (controlled vocabulary word / synonym) ────────────────────
export const TaxonomyTermNodeSchema = BaseNodeSchema.extend({
  kind: z.literal('taxonomy_term'),
  shared: z.literal(true),
  vocabulary: z.string(), // e.g. "sse-official", "capability-synonyms"
  canonicalSlug: z.string().nullable().default(null), // synonym_of canonical term
})
export type TaxonomyTermNode = z.infer<typeof TaxonomyTermNodeSchema>

// ── Probability table (LLM-harvested insight) ──────────────────────────────
export const ProbabilityRowSchema = z.object({
  conditions: z.record(z.string()), // { capability: "send_message", techStack: "prosemirror" }
  target: z.string(), // e.g. "cdp" or a term slug
  p: z.number().min(0).max(1),
  n: z.number().int().nonnegative().default(1), // sample size / support
  evidence: z.string().default(''),
})
export type ProbabilityRow = z.infer<typeof ProbabilityRowSchema>

export const ProbabilityTableNodeSchema = BaseNodeSchema.extend({
  kind: z.literal('probability_table'),
  shared: z.literal(true),
  targetKind: z.enum(NODE_KINDS),
  conditionKind: z.enum(NODE_KINDS),
  rows: z.array(ProbabilityRowSchema).default([]),
})
export type ProbabilityTableNode = z.infer<typeof ProbabilityTableNodeSchema>

// ── Union ───────────────────────────────────────────────────────────────────
export const TaxonomyNodeSchema = z.union([
  PlatformNodeSchema,
  CapabilityNodeSchema,
  ProtocolNodeSchema,
  WebappTechStackNodeSchema,
  ParserNodeSchema,
  MethodNodeSchema,
  TaxonomyTermNodeSchema,
  ProbabilityTableNodeSchema,
])
export type TaxonomyNode = z.infer<typeof TaxonomyNodeSchema>

// ── Edges (typed functional chain links) ───────────────────────────────────
export const EDGE_RELATIONS = [
  'uses', // platform → tech_stack
  'exposes', // platform → capability
  'implemented_by', // capability → method
  'uses_protocol', // method → protocol
  'targets_tech_stack', // method → tech_stack
  'parsed_by', // method → parser
  'decoded_by', // protocol → parser
  'synonym_of', // term → term (canonical)
  'implies_protocol', // term → protocol (probability)
  'has_probability', // capability → probability_table
] as const
export type EdgeRelation = (typeof EDGE_RELATIONS)[number]

export const TaxonomyEdgeSchema = z.object({
  id: z.string(),
  fromSlug: z.string(),
  fromKind: z.enum(NODE_KINDS),
  toSlug: z.string(),
  toKind: z.enum(NODE_KINDS),
  relation: z.enum(EDGE_RELATIONS),
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
})
export type TaxonomyEdge = z.infer<typeof TaxonomyEdgeSchema>

// ── Full taxonomy document (one DB "pool") ─────────────────────────────────
export const TaxonomyDocumentSchema = z.object({
  version: z.string().default('1.0.0'),
  generatedAt: z.string().default(''),
  nodes: z.array(TaxonomyNodeSchema).default([]),
  edges: z.array(TaxonomyEdgeSchema).default([]),
})
export type TaxonomyDocument = z.infer<typeof TaxonomyDocumentSchema>

// Convenience: node lookup by slug
export function indexNodes(doc: TaxonomyDocument): Map<string, TaxonomyNode> {
  const m = new Map<string, TaxonomyNode>()
  for (const n of doc.nodes) m.set(n.slug, n)
  return m
}
