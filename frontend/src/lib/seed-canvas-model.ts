/**
 * lib/seed-canvas-model.ts
 * --------------------------------------------------------------------
 * Idempotent boot seeder for the canvas conceptual model. Mirrors
 * bundle 01 §6.4 `seeds/conceptual-model/seed.ts`. Seeds:
 *   - 5 ProviderType (family) rows
 *   - 13 slot-level Primitive rows (chat.entry, chat.sidebar, ...)
 *   - cross-type UiComponent rows for each slot (the universal defaults)
 *   - 16 ProviderDefinition rows (chatgpt, gmail, slack, etc.)
 *   - default accounts + capability taxonomies + tier overrides
 *
 * Production reads from `seeds/canvas/*.json` (G6); this helper
 * mirrors that data into the in-memory store at first request.
 */

import type { CanvasEngineBag } from './canvas-engine-bootstrap';
import type { PrimitiveScope } from '../shared/conceptual-model';
import type { UiComponent } from '../shared/ui-component';
import { ulid } from './ulid';

export async function seedCanvasModel(bag: CanvasEngineBag): Promise<void> {
  // ── Families ────────────────────────────────────────────────────────
  const families = [
    { id: 'fam:ai-chat', slug: 'ai-chat' as const, displayName: 'AI Chat', basePrimitive: 'conversations' },
    { id: 'fam:email', slug: 'email' as const, displayName: 'Email', basePrimitive: 'conversations' },
    { id: 'fam:messenger', slug: 'messenger' as const, displayName: 'Messenger', basePrimitive: 'conversations' },
    { id: 'fam:social', slug: 'social' as const, displayName: 'Social', basePrimitive: 'conversations' },
    { id: 'fam:custom', slug: 'custom' as const, displayName: 'Custom', basePrimitive: 'conversations' },
  ];
  const allSlots = [
    'chat.entry', 'chat.sidebar', 'chat.thread', 'chat.bubble', 'chat.composer',
    'chat.send', 'chat.attach', 'chat.streaming', 'chat.result', 'chat.confirm',
    'chat.error', 'chat.header', 'chat.actionBar',
  ];

  for (const fam of families) {
    await bag.providerTypeStore.upsert({
      id: fam.id,
      slug: fam.slug,
      displayName: fam.displayName,
      description: `${fam.displayName} family`,
      slotCatalogJson: JSON.stringify(allSlots.map((s) => `slot:${s}`)),
      regionLayoutJson: '{}',
      interactionGrammarJson: JSON.stringify({ scrollModel: 'infinite' }),
      basePrimitive: fam.basePrimitive,
      version: 1,
    });
  }

  // ── Primitives (slot-level, family-agnostic) ───────────────────────
  for (const slot of allSlots) {
    await bag.primitiveStore.upsert({
      id: `slot:${slot}`,
      scope: 'cross-type' as PrimitiveScope,
      familyId: null,
      providerId: null,
      label: slot,
      description: null,
      defaultRegionJson: JSON.stringify({ x: 0, y: 0, z: 0, w: 320, h: 240 }),
      version: 1,
    });
  }

  // ── Cross-type UiComponents (the universal defaults) ───────────────
  for (const slot of allSlots) {
    const now = Date.now();
    const row: UiComponent = {
      id: `uc:cross-type:${slot}:${ulid()}`,
      primitiveId: `slot:${slot}`,
      scope: 'cross-type',
      ownerId: 'global',
      variant: null,
      componentKey: `global.${slot}`,
      displayName: `cross-type:${slot}`,
      html: defaultHtmlFor(slot),
      css: defaultCssFor(slot),
      scriptUrl: null,
      sandboxJson: '{}',
      constraintsJson: '{}',
      contractJson: '{}',
      archetype: null,
      version: 1,
      status: 'published',
      author: 'system',
      defaultRegion: null,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    await bag.uiComponentStore.upsert(row);
  }

  // ── Providers ───────────────────────────────────────────────────────
  const providers = [
    { id: 'chatgpt', slug: 'chatgpt', displayName: 'ChatGPT', providerTypeId: 'fam:ai-chat' },
    { id: 'claude', slug: 'claude', displayName: 'Claude', providerTypeId: 'fam:ai-chat' },
    { id: 'gemini', slug: 'gemini', displayName: 'Gemini', providerTypeId: 'fam:ai-chat' },
    { id: 'gmail', slug: 'gmail', displayName: 'Gmail', providerTypeId: 'fam:email' },
    { id: 'outlook', slug: 'outlook', displayName: 'Outlook', providerTypeId: 'fam:email' },
    { id: 'protonmail', slug: 'protonmail', displayName: 'ProtonMail', providerTypeId: 'fam:email' },
    { id: 'whatsapp', slug: 'whatsapp', displayName: 'WhatsApp', providerTypeId: 'fam:messenger' },
    { id: 'slack', slug: 'slack', displayName: 'Slack', providerTypeId: 'fam:messenger' },
    { id: 'telegram', slug: 'telegram', displayName: 'Telegram', providerTypeId: 'fam:messenger' },
    { id: 'discord', slug: 'discord', displayName: 'Discord', providerTypeId: 'fam:messenger' },
    { id: 'twitter', slug: 'twitter', displayName: 'Twitter', providerTypeId: 'fam:social' },
    { id: 'linkedin', slug: 'linkedin', displayName: 'LinkedIn', providerTypeId: 'fam:social' },
    { id: 'mastodon', slug: 'mastodon', displayName: 'Mastodon', providerTypeId: 'fam:social' },
    { id: 'notion', slug: 'notion', displayName: 'Notion', providerTypeId: 'fam:custom' },
    { id: 'linear', slug: 'linear', displayName: 'Linear', providerTypeId: 'fam:custom' },
    { id: 'airtable', slug: 'airtable', displayName: 'Airtable', providerTypeId: 'fam:custom' },
  ];
  for (const p of providers) {
    await bag.providerStore.upsert({
      id: p.id,
      slug: p.slug,
      displayName: p.displayName,
      category: 'ai',
      providerType: 'llm',
      providerTypeId: p.providerTypeId,
    });
  }

  // ── Accounts ────────────────────────────────────────────────────────
  const accounts = [
    { id: 'acct:chatgpt:free', providerId: 'chatgpt', userId: 'user:demo', planTier: 'free' as const },
    { id: 'acct:chatgpt:pro', providerId: 'chatgpt', userId: 'user:demo', planTier: 'pro' as const },
    { id: 'acct:claude:free', providerId: 'claude', userId: 'user:demo', planTier: 'free' as const },
    { id: 'acct:gmail:free', providerId: 'gmail', userId: 'user:demo', planTier: 'free' as const },
    { id: 'acct:slack:ent', providerId: 'slack', userId: 'user:demo', planTier: 'enterprise' as const },
    { id: 'acct:twitter:free', providerId: 'twitter', userId: 'user:demo', planTier: 'free' as const },
    { id: 'acct:notion:free', providerId: 'notion', userId: 'user:demo', planTier: 'free' as const },
  ];
  for (const a of accounts) {
    await bag.accountStore.upsert(a);
  }

  // ── Capability taxonomies + tiers ──────────────────────────────────
  const taxonomies = [
    {
      id: 'cap:canvas:send',
      slug: 'cap:message:send',
      displayName: 'Send Message',
      minPlanTier: 'free' as const,
      baseActions: [{ capabilityId: 'cap:message:send', label: 'Send', enabled: true }],
    },
    {
      id: 'cap:canvas:composer',
      slug: 'cap:message:compose',
      displayName: 'Compose',
      minPlanTier: 'free' as const,
      baseActions: [{ capabilityId: 'cap:message:compose', label: 'Compose', enabled: true }],
    },
    {
      id: 'cap:canvas:attach',
      slug: 'cap:attach',
      displayName: 'Attach',
      minPlanTier: 'free' as const,
      baseActions: [
        { capabilityId: 'cap:attach', label: 'Attach', enabled: true },
        { capabilityId: 'cap:attach:large', label: 'Large Attach', enabled: true },
      ],
    },
    {
      id: 'cap:canvas:streaming',
      slug: 'cap:response:stream',
      displayName: 'Streaming',
      minPlanTier: 'free' as const,
      baseActions: [
        { capabilityId: 'cap:response:stream', label: 'Stream', enabled: true },
        { capabilityId: 'cap:export:response', label: 'Export', enabled: true },
      ],
    },
    {
      id: 'cap:canvas:export',
      slug: 'cap:export',
      displayName: 'Export',
      minPlanTier: 'pro' as const,
      baseActions: [{ capabilityId: 'cap:export', label: 'Export', enabled: true }],
    },
  ];
  for (const t of taxonomies) {
    await bag.capabilityTierStore.upsertTaxonomy({
      id: t.id,
      slug: t.slug,
      displayName: t.displayName,
      minPlanTier: t.minPlanTier,
      baseActionsJson: JSON.stringify(t.baseActions),
    });
  }

  // S53: enterprise attach → large files enabled.
  await bag.capabilityTierStore.upsertTier({
    capabilityId: 'cap:canvas:attach',
    planTier: 'enterprise',
    maxFileSize: 100_000_000,
  });
  // S56: free composer → 280-char limit (Twitter-style).
  await bag.capabilityTierStore.upsertTier({
    capabilityId: 'cap:canvas:composer',
    planTier: 'free',
    customConfigJson: JSON.stringify({ charLimit: 280 }),
  });

  // ── Phase 2: workspace OS expansion ────────────────────────────────
  // Delegate to the Phase 2 seeder (workspaces, automations, agents,
  // HitlGate/PolicyRule guardrails, new card-kind CanvasDefinitions).
  const { seedCanvasModelPhase2 } = await import('./seed-canvas-model-phase2');
  await seedCanvasModelPhase2(bag);
}

function defaultHtmlFor(slot: string): string {
  return `<div class="vivim-${slot.replace('.', '-')}">
  <div class="vivim-default-label">${slot}</div>
  <div class="vivim-default-body">Cross-type default — no provider override.</div>
</div>`;
}

function defaultCssFor(slot: string): string {
  return `.vivim-${slot.replace('.', '-')} {
  font-family: ui-sans-serif, system-ui, sans-serif;
  padding: 12px;
  color: #1f2937;
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.vivim-default-label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.vivim-default-body {
  font-size: 14px;
  color: #4b5563;
}`;
}
