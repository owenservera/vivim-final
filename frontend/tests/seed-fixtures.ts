/**
 * tests/seed-fixtures.ts
 * --------------------------------------------------------------------
 * Build a RouteSyncDeps bag pre-seeded with the families, primitives,
 * UiComponents, accounts, and capability tiers needed to satisfy all
 * 100 scenarios in bundle 02.
 *
 * This is a test-only helper — production seeds from `seeds/canvas/*.json`.
 */

import { MemoryAccountStore } from '../src/storage/impl/memory-account-store';
import { MemoryCapabilityTierStore } from '../src/storage/impl/memory-capability-tier-store';
import { MemoryPrimitiveStore } from '../src/storage/impl/memory-primitive-store';
import { MemoryProviderStore } from '../src/storage/impl/memory-provider-store';
import { MemoryProviderTypeStore } from '../src/storage/impl/memory-provider-type-store';
import { MemoryUiComponentStore } from '../src/storage/impl/memory-ui-component-store';
import { MemoryUserLayoutStore } from '../src/storage/impl/memory-user-layout-store';
import { CapabilityEventBus } from '../src/engines/capability-event-bus';
import { StructuredLogger, TraceStore } from '../src/engines/structured-logger';
import { buildRouteSyncDeps } from '../src/engines/conceptual-model-service';
import { ulid } from '../src/lib/ulid';
import type { PlanTier } from '../src/shared/route-context';
import type { PrimitiveScope } from '../src/shared/conceptual-model';
import type { UiComponent } from '../src/shared/ui-component';
import type { RouteSyncDeps } from '../src/engines/route-sync';

export interface SeedInput {
  primitiveId: string;
  scope: PrimitiveScope;
  ownerId: string;
  variant: string | null;
  componentKey: string;
  displayName: string;
  html?: string;
  css?: string;
  status?: 'draft' | 'published' | 'deprecated';
}

export interface SeedFamily {
  id: string;
  slug: 'ai-chat' | 'email' | 'messenger' | 'social' | 'custom';
  displayName: string;
  basePrimitive: string;
  slotCatalog: string[]; // primitive ids
}

export interface SeedProvider {
  id: string;
  slug: string;
  displayName: string;
  providerTypeId: string | null;
}

export interface SeedAccount {
  id: string;
  providerId: string;
  userId: string;
  planTier: PlanTier;
}

export interface SeedCapabilityTaxonomy {
  id: string;
  slug: string;
  displayName: string;
  minPlanTier: PlanTier;
  baseActions: Array<{ capabilityId: string; label: string; enabled: boolean }>;
}

export interface SeedCapabilityTier {
  capabilityId: string;
  planTier: PlanTier;
  maxFileSize?: number;
  maxOptions?: number;
  customConfig?: Record<string, unknown>;
}

export interface SeedBag {
  deps: RouteSyncDeps;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
  traceStore: TraceStore;
  uiComponentStore: MemoryUiComponentStore;
  providerTypeStore: MemoryProviderTypeStore;
  primitiveStore: MemoryPrimitiveStore;
  providerStore: MemoryProviderStore;
  accountStore: MemoryAccountStore;
  capabilityTierStore: MemoryCapabilityTierStore;
  userLayoutStore: MemoryUserLayoutStore;
}

/** Default slot catalog — 13 slots, all `chat.*` (bundle 01 §5.4). */
export const ALL_SLOTS = [
  'chat.entry',
  'chat.sidebar',
  'chat.thread',
  'chat.bubble',
  'chat.composer',
  'chat.send',
  'chat.attach',
  'chat.streaming',
  'chat.result',
  'chat.confirm',
  'chat.error',
  'chat.header',
  'chat.actionBar',
] as const;

export async function buildSeedBag(opts: {
  families?: SeedFamily[];
  providers?: SeedProvider[];
  accounts?: SeedAccount[];
  components?: SeedInput[];
  taxonomies?: SeedCapabilityTaxonomy[];
  tiers?: SeedCapabilityTier[];
  /** Skip seeding any components (for S100 empty-DB scenario). */
  empty?: boolean;
}): Promise<SeedBag> {
  const eventBus = CapabilityEventBus.getInstance();
  eventBus.removeAllListeners();
  eventBus.clearRecent();
  const logger = new StructuredLogger('warn'); // quiet in tests
  const traceStore = new TraceStore();
  logger.addSink((entry) => {
    if (entry.traceId && entry.spanId) {
      traceStore.append({
        id: entry.spanId,
        traceId: entry.traceId,
        spanId: entry.spanId,
        parentSpanId: entry.parentSpanId,
        engine: entry.engine ?? 'test',
        method: entry.msg,
        durationMs: entry.durationMs ?? 0,
        ok: !entry.msg.toLowerCase().includes('error'),
        createdAt: entry.ts,
      });
    }
  });

  const uiComponentStore = new MemoryUiComponentStore();
  const providerTypeStore = new MemoryProviderTypeStore();
  const primitiveStore = new MemoryPrimitiveStore();
  const providerStore = new MemoryProviderStore();
  const accountStore = new MemoryAccountStore();
  const capabilityTierStore = new MemoryCapabilityTierStore();
  const userLayoutStore = new MemoryUserLayoutStore();

  // Families.
  const families = opts.families ?? DEFAULT_FAMILIES;
  for (const fam of families) {
    await providerTypeStore.upsert({
      id: fam.id,
      slug: fam.slug,
      displayName: fam.displayName,
      description: '',
      slotCatalogJson: JSON.stringify(fam.slotCatalog),
      regionLayoutJson: '{}',
      interactionGrammarJson: JSON.stringify({ scrollModel: 'infinite' }),
      basePrimitive: fam.basePrimitive,
      version: 1,
    });
  }
  // Seed ONE slot-level primitive per slot (family-agnostic). primitiveId
  // is `slot:chat.X` so a cross-type row is truly shared across families.
  for (const slot of ALL_SLOTS) {
    const primitiveId = `slot:${slot}`;
    await primitiveStore.upsert({
      id: primitiveId,
      scope: 'cross-type',
      familyId: null,
      providerId: null,
      label: slot,
      description: null,
      defaultRegionJson: JSON.stringify({ x: 0, y: 0, z: 0, w: 320, h: 240 }),
      version: 1,
    });
  }

  // Providers.
  const providers = opts.providers ?? DEFAULT_PROVIDERS;
  for (const p of providers) {
    await providerStore.upsert({
      id: p.id,
      slug: p.slug,
      displayName: p.displayName,
      category: 'ai',
      providerType: 'llm',
      providerTypeId: p.providerTypeId,
    });
  }

  // Accounts.
  const accounts = opts.accounts ?? DEFAULT_ACCOUNTS;
  for (const a of accounts) {
    await accountStore.upsert({
      id: a.id,
      providerId: a.providerId,
      userId: a.userId,
      planTier: a.planTier,
    });
  }

  // Capability taxonomies + tiers.
  const taxonomies = opts.taxonomies ?? DEFAULT_TAXONOMIES;
  for (const t of taxonomies) {
    await capabilityTierStore.upsertTaxonomy({
      id: t.id,
      slug: t.slug,
      displayName: t.displayName,
      minPlanTier: t.minPlanTier,
      baseActionsJson: JSON.stringify(t.baseActions),
    });
  }
  const tiers = opts.tiers ?? DEFAULT_TIERS;
  for (const t of tiers) {
    await capabilityTierStore.upsertTier({
      capabilityId: t.capabilityId,
      planTier: t.planTier,
      maxFileSize: t.maxFileSize,
      maxOptions: t.maxOptions,
      customConfigJson: t.customConfig ? JSON.stringify(t.customConfig) : undefined,
    });
  }

  // UiComponents.
  if (!opts.empty) {
    const components = opts.components ?? DEFAULT_COMPONENTS;
    for (const c of components) {
      const id = `uc:${ulid()}`;
      const now = Date.now();
      const row: UiComponent = {
        id,
        primitiveId: c.primitiveId,
        scope: c.scope,
        ownerId: c.ownerId,
        variant: c.variant,
        componentKey: c.componentKey,
        displayName: c.displayName,
        html: c.html ?? '<div></div>',
        css: c.css ?? '',
        scriptUrl: null,
        sandboxJson: '{}',
        constraintsJson: '{}',
        contractJson: '{}',
        archetype: null,
        version: 1,
        status: c.status ?? 'published',
        author: 'system',
        defaultRegion: null,
        tags: [],
        createdAt: now,
        updatedAt: now,
      };
      await uiComponentStore.upsert(row);
    }
  }

  const deps = buildRouteSyncDeps({
    eventBus,
    logger,
    uiComponentStore,
    providerTypeStore,
    primitiveStore,
    providerStore,
    accountStore,
    capabilityTierStore,
  });

  return {
    deps,
    eventBus,
    logger,
    traceStore,
    uiComponentStore,
    providerTypeStore,
    primitiveStore,
    providerStore,
    accountStore,
    capabilityTierStore,
    userLayoutStore,
  };
}

// ── Defaults ────────────────────────────────────────────────────────────

export const DEFAULT_FAMILIES: SeedFamily[] = [
  {
    id: 'fam:ai-chat',
    slug: 'ai-chat',
    displayName: 'AI Chat',
    basePrimitive: 'conversations',
    slotCatalog: ALL_SLOTS.map((s) => `slot:${s}`),
  },
  {
    id: 'fam:email',
    slug: 'email',
    displayName: 'Email',
    basePrimitive: 'conversations',
    slotCatalog: ALL_SLOTS.map((s) => `slot:${s}`),
  },
  {
    id: 'fam:messenger',
    slug: 'messenger',
    displayName: 'Messenger',
    basePrimitive: 'conversations',
    slotCatalog: ALL_SLOTS.map((s) => `slot:${s}`),
  },
  {
    id: 'fam:social',
    slug: 'social',
    displayName: 'Social',
    basePrimitive: 'conversations',
    slotCatalog: ALL_SLOTS.map((s) => `slot:${s}`),
  },
  {
    id: 'fam:custom',
    slug: 'custom',
    displayName: 'Custom',
    basePrimitive: 'conversations',
    slotCatalog: ALL_SLOTS.map((s) => `slot:${s}`),
  },
];

export const DEFAULT_PROVIDERS: SeedProvider[] = [
  // ai-chat family
  { id: 'chatgpt', slug: 'chatgpt', displayName: 'ChatGPT', providerTypeId: 'fam:ai-chat' },
  { id: 'claude', slug: 'claude', displayName: 'Claude', providerTypeId: 'fam:ai-chat' },
  { id: 'gemini', slug: 'gemini', displayName: 'Gemini', providerTypeId: 'fam:ai-chat' },
  // email family
  { id: 'gmail', slug: 'gmail', displayName: 'Gmail', providerTypeId: 'fam:email' },
  { id: 'outlook', slug: 'outlook', displayName: 'Outlook', providerTypeId: 'fam:email' },
  { id: 'protonmail', slug: 'protonmail', displayName: 'ProtonMail', providerTypeId: 'fam:email' },
  // messenger family
  { id: 'whatsapp', slug: 'whatsapp', displayName: 'WhatsApp', providerTypeId: 'fam:messenger' },
  { id: 'slack', slug: 'slack', displayName: 'Slack', providerTypeId: 'fam:messenger' },
  { id: 'telegram', slug: 'telegram', displayName: 'Telegram', providerTypeId: 'fam:messenger' },
  { id: 'discord', slug: 'discord', displayName: 'Discord', providerTypeId: 'fam:messenger' },
  // social family
  { id: 'twitter', slug: 'twitter', displayName: 'Twitter', providerTypeId: 'fam:social' },
  { id: 'linkedin', slug: 'linkedin', displayName: 'LinkedIn', providerTypeId: 'fam:social' },
  { id: 'mastodon', slug: 'mastodon', displayName: 'Mastodon', providerTypeId: 'fam:social' },
  // custom family
  { id: 'notion', slug: 'notion', displayName: 'Notion', providerTypeId: 'fam:custom' },
  { id: 'linear', slug: 'linear', displayName: 'Linear', providerTypeId: 'fam:custom' },
  { id: 'airtable', slug: 'airtable', displayName: 'Airtable', providerTypeId: 'fam:custom' },
];

export const DEFAULT_ACCOUNTS: SeedAccount[] = [
  { id: 'acct:chatgpt:free', providerId: 'chatgpt', userId: 'user:1', planTier: 'free' },
  { id: 'acct:chatgpt:pro', providerId: 'chatgpt', userId: 'user:1', planTier: 'pro' },
  { id: 'acct:chatgpt:ent', providerId: 'chatgpt', userId: 'user:1', planTier: 'enterprise' },
  { id: 'acct:chatgpt:trial', providerId: 'chatgpt', userId: 'user:1', planTier: 'trial' },
  { id: 'acct:claude:free', providerId: 'claude', userId: 'user:1', planTier: 'free' },
  { id: 'acct:claude:pro', providerId: 'claude', userId: 'user:1', planTier: 'pro' },
  { id: 'acct:claude:trial', providerId: 'claude', userId: 'user:1', planTier: 'trial' },
  { id: 'acct:gemini:free', providerId: 'gemini', userId: 'user:1', planTier: 'free' },
  { id: 'acct:gmail:free', providerId: 'gmail', userId: 'user:1', planTier: 'free' },
  { id: 'acct:gmail:ent', providerId: 'gmail', userId: 'user:1', planTier: 'enterprise' },
  { id: 'acct:outlook:free', providerId: 'outlook', userId: 'user:1', planTier: 'free' },
  { id: 'acct:outlook:ent', providerId: 'outlook', userId: 'user:1', planTier: 'enterprise' },
  { id: 'acct:protonmail:free', providerId: 'protonmail', userId: 'user:1', planTier: 'free' },
  { id: 'acct:whatsapp:free', providerId: 'whatsapp', userId: 'user:1', planTier: 'free' },
  { id: 'acct:whatsapp:trial', providerId: 'whatsapp', userId: 'user:1', planTier: 'trial' },
  { id: 'acct:slack:free', providerId: 'slack', userId: 'user:1', planTier: 'free' },
  { id: 'acct:slack:ent', providerId: 'slack', userId: 'user:1', planTier: 'enterprise' },
  { id: 'acct:telegram:free', providerId: 'telegram', userId: 'user:1', planTier: 'free' },
  { id: 'acct:telegram:trial', providerId: 'telegram', userId: 'user:1', planTier: 'trial' },
  { id: 'acct:discord:ent', providerId: 'discord', userId: 'user:1', planTier: 'enterprise' },
  { id: 'acct:twitter:free', providerId: 'twitter', userId: 'user:1', planTier: 'free' },
  { id: 'acct:linkedin:free', providerId: 'linkedin', userId: 'user:1', planTier: 'free' },
  { id: 'acct:linkedin:pro', providerId: 'linkedin', userId: 'user:1', planTier: 'pro' },
  { id: 'acct:linkedin:trial', providerId: 'linkedin', userId: 'user:1', planTier: 'trial' },
  { id: 'acct:mastodon:free', providerId: 'mastodon', userId: 'user:1', planTier: 'free' },
  { id: 'acct:notion:free', providerId: 'notion', userId: 'user:1', planTier: 'free' },
  { id: 'acct:linear:free', providerId: 'linear', userId: 'user:1', planTier: 'free' },
  { id: 'acct:airtable:free', providerId: 'airtable', userId: 'user:1', planTier: 'free' },
];

export const DEFAULT_TAXONOMIES: SeedCapabilityTaxonomy[] = [
  {
    id: 'cap:canvas:send',
    slug: 'cap:message:send',
    displayName: 'Send Message',
    minPlanTier: 'free',
    baseActions: [{ capabilityId: 'cap:message:send', label: 'Send', enabled: true }],
  },
  {
    id: 'cap:canvas:composer',
    slug: 'cap:message:compose',
    displayName: 'Compose',
    minPlanTier: 'free',
    baseActions: [{ capabilityId: 'cap:message:compose', label: 'Compose', enabled: true }],
  },
  {
    id: 'cap:canvas:streaming',
    slug: 'cap:response:stream',
    displayName: 'Streaming',
    minPlanTier: 'free',
    baseActions: [
      { capabilityId: 'cap:response:stream', label: 'Stream', enabled: true },
      { capabilityId: 'cap:export:response', label: 'Export', enabled: true },
    ],
  },
  {
    id: 'cap:canvas:attach',
    slug: 'cap:attach',
    displayName: 'Attach',
    minPlanTier: 'free',
    baseActions: [
      { capabilityId: 'cap:attach', label: 'Attach', enabled: true },
      { capabilityId: 'cap:attach:large', label: 'Large Attach', enabled: true },
    ],
  },
  {
    id: 'cap:canvas:export',
    slug: 'cap:export',
    displayName: 'Export',
    minPlanTier: 'pro', // S52: export is pro-only
    baseActions: [{ capabilityId: 'cap:export', label: 'Export', enabled: true }],
  },
  {
    id: 'cap:canvas:actionBar',
    slug: 'cap:canvas:actionBar',
    displayName: 'Action Bar',
    minPlanTier: 'free',
    baseActions: [
      { capabilityId: 'cap:canvas:actionBar', label: 'Actions', enabled: true },
      { capabilityId: 'cap:admin:manage', label: 'Admin', enabled: true },
    ],
  },
];

export const DEFAULT_TIERS: SeedCapabilityTier[] = [
  // S53: enterprise attach → large files enabled
  {
    capabilityId: 'cap:canvas:attach',
    planTier: 'enterprise',
    maxFileSize: 100_000_000,
  },
  // S56: twitter free → 280 char limit (customConfig)
  {
    capabilityId: 'cap:canvas:composer',
    planTier: 'free',
    customConfig: { charLimit: 280 },
  },
  // S58: linkedin trial → max 1 file
  {
    capabilityId: 'cap:canvas:attach',
    planTier: 'trial',
    maxOptions: 1,
  },
  // S57: chatgpt enterprise → "save to workspace" action enabled
  {
    capabilityId: 'cap:canvas:result',
    planTier: 'enterprise',
    customConfig: { saveToWorkspace: true },
  },
  // S55: slack enterprise → admin action enabled (already in baseActions for ent)
  {
    capabilityId: 'cap:canvas:actionBar',
    planTier: 'enterprise',
  },
];

/**
 * Default component seed. Covers scenarios S01–S100 from bundle 02.
 * Each row maps to exactly one (primitive, scope, owner, variant) tuple.
 */
function comp(args: {
  family: string;
  slot: string; // 'chat.send' → primitiveId `slot:chat.send` (slot-level)
  scope: PrimitiveScope;
  ownerId: string; // 'global' | familyId | providerId
  variant?: string | null;
  displayName: string;
  html?: string;
  status?: 'draft' | 'published' | 'deprecated';
}): SeedInput {
  // primitiveId is slot-level (family-agnostic) — see slotToPrimitive.
  const primitiveId = `slot:${args.slot}`;
  const variantSuffix = args.variant ? `.${args.variant}` : '';
  return {
    primitiveId,
    scope: args.scope,
    ownerId: args.ownerId,
    variant: args.variant ?? null,
    componentKey: `${args.ownerId}${variantSuffix}.${args.slot}`,
    displayName: args.displayName,
    html: args.html ?? `<div data-comp="${args.displayName}"></div>`,
    status: args.status,
  };
}

export const DEFAULT_COMPONENTS: SeedInput[] = [
  // ── Cross-type components (S01-S10) ─────────────────────────────────
  // chat.send, chat.composer, chat.thread, chat.attach, chat.streaming,
  // chat.header, chat.actionBar, chat.entry — all SHARED across families.
  comp({ family: 'ai-chat', slot: 'chat.send', scope: 'cross-type', ownerId: 'global', displayName: 'cross-type:chat.send' }),
  comp({ family: 'ai-chat', slot: 'chat.composer', scope: 'cross-type', ownerId: 'global', displayName: 'cross-type:chat.composer' }),
  comp({ family: 'ai-chat', slot: 'chat.thread', scope: 'cross-type', ownerId: 'global', displayName: 'cross-type:chat.thread' }),
  comp({ family: 'ai-chat', slot: 'chat.attach', scope: 'cross-type', ownerId: 'global', displayName: 'cross-type:chat.attach' }),
  comp({ family: 'ai-chat', slot: 'chat.streaming', scope: 'cross-type', ownerId: 'global', displayName: 'cross-type:chat.streaming' }),
  comp({ family: 'ai-chat', slot: 'chat.header', scope: 'cross-type', ownerId: 'global', displayName: 'cross-type:chat.header' }),
  comp({ family: 'ai-chat', slot: 'chat.actionBar', scope: 'cross-type', ownerId: 'global', displayName: 'cross-type:chat.actionBar' }),
  comp({ family: 'ai-chat', slot: 'chat.entry', scope: 'cross-type', ownerId: 'global', displayName: 'cross-type:chat.entry' }),
  comp({ family: 'ai-chat', slot: 'chat.bubble', scope: 'cross-type', ownerId: 'global', displayName: 'cross-type:chat.bubble' }),
  comp({ family: 'ai-chat', slot: 'chat.result', scope: 'cross-type', ownerId: 'global', displayName: 'cross-type:chat.result' }),
  comp({ family: 'ai-chat', slot: 'chat.confirm', scope: 'cross-type', ownerId: 'global', displayName: 'cross-type:chat.confirm' }),
  comp({ family: 'ai-chat', slot: 'chat.sidebar', scope: 'cross-type', ownerId: 'global', displayName: 'cross-type:chat.sidebar' }),
  comp({ family: 'ai-chat', slot: 'chat.error', scope: 'cross-type', ownerId: 'global', displayName: 'cross-type:chat.error' }),

  // ── Family-level shared overrides (S11-S20) ────────────────────────
  comp({ family: 'ai-chat', slot: 'chat.bubble', scope: 'family', ownerId: 'fam:ai-chat', displayName: 'family:ai-chat:chat.bubble' }),
  comp({ family: 'email', slot: 'chat.thread', scope: 'family', ownerId: 'fam:email', displayName: 'family:email:chat.thread' }),
  comp({ family: 'messenger', slot: 'chat.sidebar', scope: 'family', ownerId: 'fam:messenger', displayName: 'family:messenger:chat.sidebar' }),
  comp({ family: 'social', slot: 'chat.composer', scope: 'family', ownerId: 'fam:social', displayName: 'family:social:chat.composer' }),
  comp({ family: 'ai-chat', slot: 'chat.streaming', scope: 'family', ownerId: 'fam:ai-chat', displayName: 'family:ai-chat:chat.streaming' }),
  comp({ family: 'email', slot: 'chat.attach', scope: 'family', ownerId: 'fam:email', displayName: 'family:email:chat.attach' }),
  comp({ family: 'messenger', slot: 'chat.bubble', scope: 'family', ownerId: 'fam:messenger', displayName: 'family:messenger:chat.bubble' }),
  comp({ family: 'custom', slot: 'chat.sidebar', scope: 'family', ownerId: 'fam:custom', displayName: 'family:custom:chat.sidebar' }),
  comp({ family: 'messenger', slot: 'chat.actionBar', scope: 'family', ownerId: 'fam:messenger', displayName: 'family:messenger:chat.actionBar' }),

  // ── Provider-specific overrides (S21-S30) ──────────────────────────
  comp({ family: 'ai-chat', slot: 'chat.composer', scope: 'provider', ownerId: 'chatgpt', displayName: 'provider:chatgpt:chat.composer' }),
  comp({ family: 'email', slot: 'chat.send', scope: 'provider', ownerId: 'gmail', displayName: 'provider:gmail:chat.send' }),
  comp({ family: 'messenger', slot: 'chat.thread', scope: 'provider', ownerId: 'slack', displayName: 'provider:slack:chat.thread' }),
  comp({ family: 'social', slot: 'chat.composer', scope: 'provider', ownerId: 'twitter', displayName: 'provider:twitter:chat.composer' }),
  comp({ family: 'ai-chat', slot: 'chat.streaming', scope: 'provider', ownerId: 'chatgpt', displayName: 'provider:chatgpt:chat.streaming' }),
  comp({ family: 'email', slot: 'chat.attach', scope: 'provider', ownerId: 'gmail', displayName: 'provider:gmail:chat.attach' }),
  comp({ family: 'messenger', slot: 'chat.bubble', scope: 'provider', ownerId: 'whatsapp', displayName: 'provider:whatsapp:chat.bubble' }),
  comp({ family: 'social', slot: 'chat.actionBar', scope: 'provider', ownerId: 'linkedin', displayName: 'provider:linkedin:chat.actionBar' }),
  comp({ family: 'custom', slot: 'chat.entry', scope: 'provider', ownerId: 'notion', displayName: 'provider:notion:chat.entry' }),
  comp({ family: 'ai-chat', slot: 'chat.bubble', scope: 'provider', ownerId: 'chatgpt', displayName: 'provider:chatgpt:chat.bubble' }),
  comp({ family: 'custom', slot: 'chat.entry', scope: 'provider', ownerId: 'linear', displayName: 'provider:linear:chat.entry' }),

  // ── Variant overrides (S31-S40) ────────────────────────────────────
  comp({ family: 'ai-chat', slot: 'chat.composer', scope: 'provider', ownerId: 'chatgpt', variant: 'gemini-model', displayName: 'provider+variant:chatgpt.gemini-model:chat.composer' }),
  comp({ family: 'ai-chat', slot: 'chat.streaming', scope: 'provider', ownerId: 'claude', variant: 'opus', displayName: 'provider+variant:claude.opus:chat.streaming' }),
  comp({ family: 'email', slot: 'chat.send', scope: 'provider', ownerId: 'gmail', variant: 'workspace', displayName: 'provider+variant:gmail.workspace:chat.send' }),
  comp({ family: 'ai-chat', slot: 'chat.composer', scope: 'family', ownerId: 'fam:ai-chat', variant: 'voice', displayName: 'family+variant:ai-chat.voice:chat.composer' }),
  comp({ family: 'email', slot: 'chat.attach', scope: 'family', ownerId: 'fam:email', variant: 'encrypted', displayName: 'family+variant:email.encrypted:chat.attach' }),
  // S39: custom provider w/ variant only, no base
  comp({ family: 'custom', slot: 'chat.entry', scope: 'provider', ownerId: 'airtable', variant: 'kanban', displayName: 'provider+variant:airtable.kanban:chat.entry' }),
  // S40: ALL levels present for chat.send (provider+variant on chatgpt+gemini-model)
  comp({ family: 'ai-chat', slot: 'chat.send', scope: 'provider', ownerId: 'chatgpt', variant: 'gemini-model', displayName: 'provider+variant:chatgpt.gemini-model:chat.send' }),
  comp({ family: 'ai-chat', slot: 'chat.send', scope: 'family', ownerId: 'fam:ai-chat', variant: 'voice', displayName: 'family+variant:ai-chat.voice:chat.send' }),

  // ── S66/S67: deprecated/draft rows (must be skipped) ────────────────
  comp({ family: 'ai-chat', slot: 'chat.bubble', scope: 'provider', ownerId: 'claude', displayName: 'provider:claude:chat.bubble:deprecated', status: 'deprecated' }),
  comp({ family: 'ai-chat', slot: 'chat.streaming', scope: 'provider', ownerId: 'gemini', displayName: 'provider:gemini:chat.streaming:draft', status: 'draft' }),
];
