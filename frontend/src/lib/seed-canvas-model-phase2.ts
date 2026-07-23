/**
 * lib/seed-canvas-model-phase2.ts
 * --------------------------------------------------------------------
 * Phase 2 boot seeder. Idempotent — mirrors the v1 seedCanvasModel()
 * shape but for the new workspace OS surfaces:
 *   - 1 global workspace + 3 example child workspaces
 *   - 100 core automations in the automation workspace
 *   - 3 sample agents in the agents workspace
 *   - HitlGate + PolicyRule guardrails
 *   - Cross-type CanvasDefinitions for the new card kinds:
 *     docs.viewer, media.player, automation.builder, agents.canvas,
 *     shell.terminal
 */

import type { CanvasEngineBag } from './canvas-engine-bootstrap';
import type { AutomationNode, AutomationEdge } from '../shared/automation';
import type { AgentStep, AgentEdge } from '../shared/agent';
import type { PrimitiveScope } from '../shared/conceptual-model';
import type { UiComponent } from '../shared/ui-component';
import { ulid } from './ulid';
import { AUTOMATION_SEEDS } from '../seeds/canvas/automations';

/**
 * Seed Phase 2 data. Idempotent — uses upsert semantics on slugs.
 * Called once at first request after the engine bag is built.
 */
export async function seedCanvasModelPhase2(bag: CanvasEngineBag): Promise<void> {
  // ── Workspaces ───────────────────────────────────────────────────────
  await bag.workspaceStore.getGlobal(); // lazy-create the global workspace

  // Create 3 example child workspaces (idempotent via slug check).
  const existingChildren = await bag.workspaceStore.list({ parentId: 'ws:global' });
  const childDefs = [
    { slug: 'research', displayName: 'Research Lab', kind: 'standard' as const },
    { slug: 'content-team', displayName: 'Content Team', kind: 'standard' as const },
    { slug: 'automation-lab', displayName: 'Automation Lab', kind: 'automation' as const },
  ];
  for (const def of childDefs) {
    if (!existingChildren.some((c) => c.slug === def.slug)) {
      await bag.workspaceEngine.create({
        slug: def.slug,
        displayName: def.displayName,
        kind: def.kind,
        parentId: 'ws:global',
      });
    }
  }

  // ── HitlGate + PolicyRule guardrails ────────────────────────────────
  const existingHitl = await bag.hitlGateStore.list();
  if (existingHitl.length === 0) {
    await bag.hitlGateStore.upsert({
      id: 'hitl:approve-action',
      slug: 'approve-action',
      label: 'Approve Action',
      description: 'Require human approval before destructive ops',
      approverRoles: ['admin', 'owner'],
      autoApproveMs: 86_400_000, // 24h
      onReject: 'block',
    });
    await bag.hitlGateStore.upsert({
      id: 'hitl:review-output',
      slug: 'review-output',
      label: 'Review Output',
      description: 'Require human review of agent output before publishing',
      approverRoles: ['editor'],
      onReject: 'skip',
    });
  }

  const existingPolicies = await bag.policyRuleStore.list();
  if (existingPolicies.length === 0) {
    await bag.policyRuleStore.upsert({
      id: 'policy:rate-limit',
      slug: 'rate-limit',
      label: 'Rate Limit',
      description: 'Max 10 capability invocations per minute',
      expression: 'rate <= 10/min',
      action: 'throttle',
    });
    await bag.policyRuleStore.upsert({
      id: 'policy:no-destructive',
      slug: 'no-destructive',
      label: 'No Destructive Ops',
      description: 'Block destructive ops without HITL approval',
      expression: 'requires(hitl:approve-action) when op.class == "destructive"',
      action: 'block',
    });
  }

  // ── 100 core automations ────────────────────────────────────────────
  const automationWs = (await bag.workspaceStore.getBySlug('automation-lab')) ?? (await bag.workspaceStore.getGlobal());
  const existingAutos = await bag.automationStore.list({ workspaceId: automationWs.id });
  if (existingAutos.length === 0) {
    for (const seed of AUTOMATION_SEEDS) {
      const nodes: AutomationNode[] = seed.nodes.map((n, i) => ({
        id: `n:${seed.slug}:${i}`,
        kind: n.kind,
        capabilityId: n.capabilityId,
        label: n.label,
        position: { x: 40 + (i % 4) * 140, y: 40 + Math.floor(i / 4) * 80 },
        hitlGateId: n.kind === 'hitl' ? 'hitl:approve-action' : undefined,
      }));
      const edges: AutomationEdge[] = nodes.slice(1).map((n, i) => ({
        id: `e:${seed.slug}:${i}`,
        fromNodeId: nodes[i]!.id,
        toNodeId: n.id,
      }));
      await bag.automationBuilder.create({
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        workspaceId: automationWs.id,
        nodes,
        edges,
        trigger: seed.trigger,
        capabilityId: `cap:automation:${seed.slug}`,
        tags: seed.tags,
      });
    }
  }

  // ── 3 sample agents ─────────────────────────────────────────────────
  const agentsWs = (await bag.workspaceStore.getBySlug('research')) ?? (await bag.workspaceStore.getGlobal());
  const existingAgents = await bag.agentStore.list({ workspaceId: agentsWs.id });
  if (existingAgents.length === 0) {
    for (const seed of AGENT_SEEDS) {
      const steps: AgentStep[] = seed.steps.map((s, i) => ({
        id: `s:${seed.slug}:${i}`,
        kind: s.kind,
        label: s.label,
        capabilityId: s.capabilityId,
        promptTemplate: s.promptTemplate,
        position: { x: 40 + (i % 4) * 140, y: 40 + Math.floor(i / 4) * 80 },
        hitlGateId: s.kind === 'hitl' ? 'hitl:review-output' : undefined,
      }));
      const edges: AgentEdge[] = steps.slice(1).map((s, i) => ({
        id: `ae:${seed.slug}:${i}`,
        fromStepId: steps[i]!.id,
        toStepId: s.id,
      }));
      await bag.agentsBuilder.create({
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        workspaceId: agentsWs.id,
        steps,
        edges,
        entryStepId: steps[0]!.id,
        maxLoopIterations: 10,
        policyRuleId: 'policy:rate-limit',
        capabilityId: `cap:agent:${seed.slug}`,
        tags: seed.tags,
      });
    }
  }

  // ── Cross-type CanvasDefinitions for the new card kinds ─────────────
  // These are UiComponent rows (not CanvasDefinitions) so the routeSync
  // resolver can find them via the 6-level tree walk.
  const newSlots = [
    { slot: 'docs.viewer', engine: 'document', html: '<div class="docs-viewer">Document card</div>' },
    { slot: 'media.player', engine: 'media', html: '<div class="media-player">Media card</div>' },
    { slot: 'automation.builder', engine: 'automation', html: '<div class="automation-builder">Automation card</div>' },
    { slot: 'agents.canvas', engine: 'agent', html: '<div class="agents-canvas">Agent card</div>' },
    { slot: 'shell.terminal', engine: 'shell', html: '<div class="shell-terminal">Shell card</div>' },
  ];
  for (const slot of newSlots) {
    const primitiveId = `slot:${slot.slot}`;
    const existing = await bag.uiComponentStore.list({ primitiveId, scope: 'cross-type' });
    if (existing.length > 0) continue;
    const now = Date.now();
    const row: UiComponent = {
      id: `uc:cross-type:${slot.slot}:${ulid()}`,
      primitiveId,
      scope: 'cross-type' as PrimitiveScope,
      ownerId: 'global',
      variant: null,
      componentKey: `global.${slot.slot}`,
      displayName: `cross-type:${slot.slot}`,
      html: slot.html,
      css: `.vivim-${slot.slot.replace('.', '-')} { font-family: ui-sans-serif, system-ui; padding: 12px; }`,
      scriptUrl: null,
      sandboxJson: '{}',
      constraintsJson: '{}',
      contractJson: '{}',
      archetype: null,
      version: 1,
      status: 'published',
      author: 'system',
      defaultRegion: null,
      tags: [slot.engine, 'phase2'],
      createdAt: now,
      updatedAt: now,
    };
    await bag.uiComponentStore.upsert(row);
  }
}

// ── Agent seeds ────────────────────────────────────────────────────────

interface AgentSeed {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  steps: Array<{ kind: AgentStep['kind']; label: string; capabilityId?: string; promptTemplate?: string }>;
}

const AGENT_SEEDS: AgentSeed[] = [
  {
    slug: 'research-assistant',
    name: 'Research Assistant',
    description: 'Perceives a question, thinks, searches, then answers with citations.',
    tags: ['research', 'qa'],
    steps: [
      { kind: 'perceive', label: 'Read question' },
      { kind: 'think', label: 'Plan search', promptTemplate: 'Plan a research strategy for: {{question}}' },
      { kind: 'act', label: 'Web search', capabilityId: 'cap:web:search' },
      { kind: 'think', label: 'Synthesize', promptTemplate: 'Synthesize an answer with citations from: {{results}}' },
      { kind: 'hitl', label: 'Review answer' },
      { kind: 'output', label: 'Return answer' },
    ],
  },
  {
    slug: 'content-curator',
    name: 'Content Curator',
    description: 'Reads new docs, summarizes, tags, and routes to the right workspace.',
    tags: ['content', 'routing'],
    steps: [
      { kind: 'perceive', label: 'Watch for new docs' },
      { kind: 'think', label: 'Classify', promptTemplate: 'Classify this doc: {{doc.title}}' },
      { kind: 'act', label: 'Summarize', capabilityId: 'cap:document:summarize' },
      { kind: 'act', label: 'Route to workspace', capabilityId: 'cap:workspace:route' },
      { kind: 'output', label: 'Confirm routing' },
    ],
  },
  {
    slug: 'inbox-triager',
    name: 'Inbox Triager',
    description: 'Reads incoming messages, triages by priority, drafts replies.',
    tags: ['inbox', 'triage'],
    steps: [
      { kind: 'perceive', label: 'Read inbox' },
      { kind: 'think', label: 'Prioritize', promptTemplate: 'Prioritize these messages: {{messages}}' },
      { kind: 'act', label: 'Draft reply', capabilityId: 'cap:message:draft' },
      { kind: 'hitl', label: 'Approve reply' },
      { kind: 'output', label: 'Send reply' },
    ],
  },
];
