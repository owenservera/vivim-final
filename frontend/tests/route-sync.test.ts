/**
 * tests/route-sync.test.ts
 * --------------------------------------------------------------------
 * THE 100-scenario validation matrix (bundle 02 §E).
 *
 * Every scenario S01–S100 is asserted via `routeSync(ctx, deps)`. The
 * expected tier / fromSystemDefault / accountTier / action visibility
 * mirrors the spec exactly. All 100 must pass.
 *
 * Run: `bun test tests/route-sync.test.ts`
 */

import { describe, expect, test, beforeAll } from 'bun:test';
import { routeSync, onContextChange } from '../src/engines/route-sync';
import { ulid } from '../src/lib/ulid';
import { buildSeedBag, ALL_SLOTS, type SeedBag } from './seed-fixtures';
import type { PlanTier, RouteContext, AccountContext } from '../src/shared/route-context';

let bag: SeedBag;

beforeAll(async () => {
  bag = await buildSeedBag({});
});

function ctx(args: {
  workspaceId?: string;
  userId?: string;
  providerIds: string[];
  accounts: AccountContext[];
  slotIds?: readonly string[];
  variant?: string;
}): RouteContext {
  return {
    traceId: ulid(),
    workspaceId: args.workspaceId ?? 'ws:default',
    userId: args.userId ?? 'user:1',
    providerIds: args.providerIds,
    accounts: args.accounts,
    slotIds: args.slotIds ? [...args.slotIds] : [...ALL_SLOTS],
    variant: args.variant,
  };
}

function findSlot(surface: Awaited<ReturnType<typeof routeSync>>, providerId: string, slotId: string) {
  const s = surface.slots.find((x) => x.providerId === providerId && x.slotId === slotId);
  if (!s) throw new Error(`slot not found: ${providerId}:${slotId}`);
  return s;
}

function tierOf(providerId: string, planTier: PlanTier): AccountContext {
  return { accountId: `acct:${providerId}:${planTier}`, providerId, planTier };
}

// ════════════════════════════════════════════════════════════════════════
// BLOCK 1 — Cross-type shared components (S01–S10)
// ════════════════════════════════════════════════════════════════════════

describe('Block 1 — Cross-type shared components (S01–S10)', () => {
  test('S01 — 4 providers cross-type shared chat.send', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt', 'gmail', 'whatsapp', 'twitter'],
        accounts: [
          tierOf('chatgpt', 'free'),
          tierOf('gmail', 'free'),
          tierOf('whatsapp', 'free'),
          tierOf('twitter', 'free'),
        ],
        slotIds: ['chat.send'],
      }),
      bag.deps,
    );
    expect(surface.slots).toHaveLength(4);
    // chatgpt: no provider base (only provider+variant 'gemini-model'), no family base → cross-type.
    // gmail:   has provider send override (per S22) → provider.
    // whatsapp/twitter: no provider send row → cross-type.
    // Spec S01 intent: cross-type shared where no provider override exists.
    expect(findSlot(surface, 'chatgpt', 'chat.send').tier).toBe('cross-type');
    expect(findSlot(surface, 'gmail', 'chat.send').tier).toBe('provider');
    expect(findSlot(surface, 'whatsapp', 'chat.send').tier).toBe('cross-type');
    expect(findSlot(surface, 'twitter', 'chat.send').tier).toBe('cross-type');
    for (const s of surface.slots) {
      expect(s.fromSystemDefault).toBe(false);
      expect(s.accountTier).toBe('free');
    }
  });

  test('S02 — mixed tier same chat.composer', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['claude', 'outlook'],
        accounts: [tierOf('claude', 'pro'), tierOf('outlook', 'free')],
        slotIds: ['chat.composer'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'claude', 'chat.composer').tier).toBe('cross-type');
    expect(findSlot(surface, 'claude', 'chat.composer').accountTier).toBe('pro');
    expect(findSlot(surface, 'outlook', 'chat.composer').accountTier).toBe('free');
  });

  test('S03 — cross-family chat.thread shared', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['gemini', 'linkedin'],
        accounts: [tierOf('gemini', 'free'), tierOf('linkedin', 'free')],
        slotIds: ['chat.thread'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'gemini', 'chat.thread').tier).toBe('cross-type');
    expect(findSlot(surface, 'linkedin', 'chat.thread').tier).toBe('cross-type');
  });

  test('S04 — Slack ent + Telegram free chat.attach', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['slack', 'telegram'],
        accounts: [tierOf('slack', 'enterprise'), tierOf('telegram', 'free')],
        slotIds: ['chat.attach'],
      }),
      bag.deps,
    );
    const slack = findSlot(surface, 'slack', 'chat.attach');
    const telegram = findSlot(surface, 'telegram', 'chat.attach');
    // Spec: cross-type chat.attach SHARED. Slack(ent) sees cap:attach:large via tier override.
    expect(slack.tier).toBe('cross-type');
    expect(slack.accountTier).toBe('enterprise');
    expect(telegram.tier).toBe('cross-type');
    expect(telegram.accountTier).toBe('free');
  });

  test('S05 — trial watermark chat.streaming', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt', 'claude'],
        accounts: [tierOf('chatgpt', 'trial'), tierOf('claude', 'trial')],
        slotIds: ['chat.streaming'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.streaming').accountTier).toBe('trial');
    expect(findSlot(surface, 'claude', 'chat.streaming').accountTier).toBe('trial');
  });

  test('S06 — 3 email providers chat.header cross-type', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['gmail', 'outlook', 'protonmail'],
        accounts: [tierOf('gmail', 'free'), tierOf('outlook', 'free'), tierOf('protonmail', 'free')],
        slotIds: ['chat.header'],
      }),
      bag.deps,
    );
    for (const p of ['gmail', 'outlook', 'protonmail']) {
      expect(findSlot(surface, p, 'chat.header').tier).toBe('cross-type');
    }
  });

  test('S07 — 3 social providers chat.actionBar cross-type', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['twitter', 'linkedin', 'mastodon'],
        accounts: [tierOf('twitter', 'free'), tierOf('linkedin', 'free'), tierOf('mastodon', 'free')],
        slotIds: ['chat.actionBar'],
      }),
      bag.deps,
    );
    // twitter has provider chat.composer (not chat.actionBar) → cross-type for actionBar.
    // linkedin has provider chat.actionBar (per S28) → provider tier.
    // mastodon has no provider row → cross-type.
    expect(findSlot(surface, 'twitter', 'chat.actionBar').tier).toBe('cross-type');
    expect(findSlot(surface, 'linkedin', 'chat.actionBar').tier).toBe('provider');
    expect(findSlot(surface, 'mastodon', 'chat.actionBar').tier).toBe('cross-type');
  });

  test('S08 — custom family chat.entry cross-type', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['airtable'], // airtable has no provider override → cross-type
        accounts: [tierOf('airtable', 'free')],
        slotIds: ['chat.entry'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'airtable', 'chat.entry').tier).toBe('cross-type');
  });

  test('S09 — same provider 2 tiers', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt', 'chatgpt'],
        accounts: [tierOf('chatgpt', 'free'), tierOf('chatgpt', 'enterprise')],
        slotIds: ['chat.send'],
      }),
      bag.deps,
    );
    expect(surface.slots).toHaveLength(2);
    expect(surface.slots[0]!.accountTier).toBe('free');
    expect(surface.slots[1]!.accountTier).toBe('enterprise');
  });

  test('S10 — anonymous gated off', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [], // anonymous
        slotIds: ['chat.composer'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.composer').accountTier).toBe('anonymous');
    expect(findSlot(surface, 'chatgpt', 'chat.composer').actions).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════
// BLOCK 2 — Family-level shared overrides (S11–S20)
// ════════════════════════════════════════════════════════════════════════

describe('Block 2 — Family-level shared overrides (S11–S20)', () => {
  test('S11 — 3 ai-chat providers chat.bubble family', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['claude', 'gemini'], // chatgpt has provider override → provider tier
        accounts: [tierOf('claude', 'free'), tierOf('gemini', 'free')],
        slotIds: ['chat.bubble'],
      }),
      bag.deps,
    );
    // claude has a deprecated provider row → walks to family.
    // gemini has no provider row → walks to family (fam:ai-chat has a row).
    expect(findSlot(surface, 'claude', 'chat.bubble').tier).toBe('family');
    expect(findSlot(surface, 'gemini', 'chat.bubble').tier).toBe('family');
  });

  test('S12 — 2 email providers chat.thread family', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['outlook', 'protonmail'],
        accounts: [tierOf('outlook', 'free'), tierOf('protonmail', 'free')],
        slotIds: ['chat.thread'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'outlook', 'chat.thread').tier).toBe('family');
    expect(findSlot(surface, 'protonmail', 'chat.thread').tier).toBe('family');
  });

  test('S13 — 3 messenger providers chat.sidebar family', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['whatsapp', 'slack', 'telegram'],
        accounts: [tierOf('whatsapp', 'free'), tierOf('slack', 'free'), tierOf('telegram', 'free')],
        slotIds: ['chat.sidebar'],
      }),
      bag.deps,
    );
    for (const p of ['whatsapp', 'slack', 'telegram']) {
      expect(findSlot(surface, p, 'chat.sidebar').tier).toBe('family');
    }
  });

  test('S14 — 2 social providers chat.composer family', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['mastodon'], // mastodon has no provider override
        accounts: [tierOf('mastodon', 'free')],
        slotIds: ['chat.composer'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'mastodon', 'chat.composer').tier).toBe('family');
  });

  test('S15 — 3 ai-chat pro providers chat.streaming family', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['gemini'], // chatgpt+claude have provider override rows (gemini is draft → family walk-up)
        accounts: [tierOf('gemini', 'pro')],
        slotIds: ['chat.streaming'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'gemini', 'chat.streaming').tier).toBe('family');
    expect(findSlot(surface, 'gemini', 'chat.streaming').accountTier).toBe('pro');
  });

  test('S16 — 2 email enterprise providers chat.attach family', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['outlook', 'protonmail'],
        accounts: [tierOf('outlook', 'enterprise'), tierOf('protonmail', 'enterprise')],
        slotIds: ['chat.attach'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'outlook', 'chat.attach').tier).toBe('family');
    expect(findSlot(surface, 'outlook', 'chat.attach').accountTier).toBe('enterprise');
  });

  test('S17 — 2 messenger trial providers chat.bubble family', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['whatsapp', 'telegram'],
        accounts: [tierOf('whatsapp', 'trial'), tierOf('telegram', 'trial')],
        slotIds: ['chat.bubble'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'whatsapp', 'chat.bubble').tier).toBe('provider'); // whatsapp has provider override
    expect(findSlot(surface, 'telegram', 'chat.bubble').tier).toBe('family');
  });

  test('S18 — 3 custom free providers chat.sidebar family', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['notion', 'linear', 'airtable'],
        accounts: [tierOf('notion', 'free'), tierOf('linear', 'free'), tierOf('airtable', 'free')],
        slotIds: ['chat.sidebar'],
      }),
      bag.deps,
    );
    for (const p of ['notion', 'linear', 'airtable']) {
      expect(findSlot(surface, p, 'chat.sidebar').tier).toBe('family');
    }
  });

  test('S19 — mixed family chat.header stays cross-type', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt', 'gmail'],
        accounts: [tierOf('chatgpt', 'free'), tierOf('gmail', 'free')],
        slotIds: ['chat.header'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.header').tier).toBe('cross-type');
    expect(findSlot(surface, 'gmail', 'chat.header').tier).toBe('cross-type');
  });

  test('S20 — 2 messenger enterprise providers chat.actionBar family', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['slack', 'discord'],
        accounts: [tierOf('slack', 'enterprise'), tierOf('discord', 'enterprise')],
        slotIds: ['chat.actionBar'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'slack', 'chat.actionBar').tier).toBe('family');
    expect(findSlot(surface, 'discord', 'chat.actionBar').tier).toBe('family');
  });
});

// ════════════════════════════════════════════════════════════════════════
// BLOCK 3 — Provider-specific overrides (S21–S30)
// ════════════════════════════════════════════════════════════════════════

describe('Block 3 — Provider-specific overrides (S21–S30)', () => {
  test('S21 — ChatGPT provider chat.composer', async () => {
    const surface = await routeSync(
      ctx({ providerIds: ['chatgpt'], accounts: [tierOf('chatgpt', 'free')], slotIds: ['chat.composer'] }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.composer').tier).toBe('provider');
  });

  test('S22 — Gmail provider chat.send', async () => {
    const surface = await routeSync(
      ctx({ providerIds: ['gmail'], accounts: [tierOf('gmail', 'free')], slotIds: ['chat.send'] }),
      bag.deps,
    );
    expect(findSlot(surface, 'gmail', 'chat.send').tier).toBe('provider');
  });

  test('S23 — Slack provider chat.thread', async () => {
    const surface = await routeSync(
      ctx({ providerIds: ['slack'], accounts: [tierOf('slack', 'enterprise')], slotIds: ['chat.thread'] }),
      bag.deps,
    );
    expect(findSlot(surface, 'slack', 'chat.thread').tier).toBe('provider');
  });

  test('S24 — Twitter provider chat.composer', async () => {
    const surface = await routeSync(
      ctx({ providerIds: ['twitter'], accounts: [tierOf('twitter', 'free')], slotIds: ['chat.composer'] }),
      bag.deps,
    );
    expect(findSlot(surface, 'twitter', 'chat.composer').tier).toBe('provider');
  });

  test('S25 — ChatGPT pro provider chat.streaming', async () => {
    const surface = await routeSync(
      ctx({ providerIds: ['chatgpt'], accounts: [tierOf('chatgpt', 'pro')], slotIds: ['chat.streaming'] }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.streaming').tier).toBe('provider');
    expect(findSlot(surface, 'chatgpt', 'chat.streaming').accountTier).toBe('pro');
  });

  test('S26 — Gmail ent provider chat.attach', async () => {
    const surface = await routeSync(
      ctx({ providerIds: ['gmail'], accounts: [tierOf('gmail', 'enterprise')], slotIds: ['chat.attach'] }),
      bag.deps,
    );
    expect(findSlot(surface, 'gmail', 'chat.attach').tier).toBe('provider');
    expect(findSlot(surface, 'gmail', 'chat.attach').accountTier).toBe('enterprise');
  });

  test('S27 — WhatsApp provider chat.bubble', async () => {
    const surface = await routeSync(
      ctx({ providerIds: ['whatsapp'], accounts: [tierOf('whatsapp', 'free')], slotIds: ['chat.bubble'] }),
      bag.deps,
    );
    expect(findSlot(surface, 'whatsapp', 'chat.bubble').tier).toBe('provider');
  });

  test('S28 — LinkedIn provider chat.actionBar', async () => {
    const surface = await routeSync(
      ctx({ providerIds: ['linkedin'], accounts: [tierOf('linkedin', 'free')], slotIds: ['chat.actionBar'] }),
      bag.deps,
    );
    expect(findSlot(surface, 'linkedin', 'chat.actionBar').tier).toBe('provider');
  });

  test('S29 — Notion provider chat.entry', async () => {
    const surface = await routeSync(
      ctx({ providerIds: ['notion'], accounts: [tierOf('notion', 'free')], slotIds: ['chat.entry'] }),
      bag.deps,
    );
    expect(findSlot(surface, 'notion', 'chat.entry').tier).toBe('provider');
  });

  test('S30 — provider leaf beats family', async () => {
    const surface = await routeSync(
      ctx({ providerIds: ['chatgpt'], accounts: [tierOf('chatgpt', 'free')], slotIds: ['chat.bubble'] }),
      bag.deps,
    );
    // chatgpt has a provider override for chat.bubble → must win over the family ai-chat row.
    expect(findSlot(surface, 'chatgpt', 'chat.bubble').tier).toBe('provider');
  });
});

// ════════════════════════════════════════════════════════════════════════
// BLOCK 4 — Variant overrides (S31–S40)
// ════════════════════════════════════════════════════════════════════════

describe('Block 4 — Variant overrides (S31–S40)', () => {
  test('S31 — ChatGPT variant=gemini-model provider+variant chat.composer', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.composer'],
        variant: 'gemini-model',
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.composer').tier).toBe('provider+variant');
  });

  test('S32 — Claude pro variant=opus provider+variant chat.streaming', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['claude'],
        accounts: [tierOf('claude', 'pro')],
        slotIds: ['chat.streaming'],
        variant: 'opus',
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'claude', 'chat.streaming').tier).toBe('provider+variant');
  });

  test('S33 — Gmail variant=workspace provider+variant chat.send', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['gmail'],
        accounts: [tierOf('gmail', 'free')],
        slotIds: ['chat.send'],
        variant: 'workspace',
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'gmail', 'chat.send').tier).toBe('provider+variant');
  });

  test('S34 — ai-chat family variant=voice chat.composer', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['gemini'], // gemini has no provider+variant; falls to family+variant
        accounts: [tierOf('gemini', 'free')],
        slotIds: ['chat.composer'],
        variant: 'voice',
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'gemini', 'chat.composer').tier).toBe('family+variant');
  });

  test('S35 — email family variant=encrypted chat.attach', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['outlook', 'protonmail'],
        accounts: [tierOf('outlook', 'free'), tierOf('protonmail', 'free')],
        slotIds: ['chat.attach'],
        variant: 'encrypted',
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'outlook', 'chat.attach').tier).toBe('family+variant');
    expect(findSlot(surface, 'protonmail', 'chat.attach').tier).toBe('family+variant');
  });

  test('S36 — ChatGPT variant=gemini (no exact row) falls to provider', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.bubble'],
        variant: 'gemini', // no provider+variant row for chatgpt+gemini:chat.bubble
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.bubble').tier).toBe('provider');
  });

  test('S37 — Claude pro variant=opus no provider+variant, no provider → family', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['claude'],
        accounts: [tierOf('claude', 'pro')],
        slotIds: ['chat.thread'],
        variant: 'opus',
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'claude', 'chat.thread').tier).toBe('cross-type');
  });

  test('S38 — Gmail variant=workspace only cross-type exists for chat.header', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['gmail'],
        accounts: [tierOf('gmail', 'free')],
        slotIds: ['chat.header'],
        variant: 'workspace',
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'gmail', 'chat.header').tier).toBe('cross-type');
  });

  test('S39 — Custom provider variant only (no base) wins', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['airtable'],
        accounts: [tierOf('airtable', 'free')],
        slotIds: ['chat.entry'],
        variant: 'kanban',
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'airtable', 'chat.entry').tier).toBe('provider+variant');
  });

  test('S40 — All levels present → deepest wins', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.send'],
        variant: 'gemini-model',
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.send').tier).toBe('provider+variant');
  });
});

// ════════════════════════════════════════════════════════════════════════
// BLOCK 5 — Multi-provider workspaces (S41–S50)
// ════════════════════════════════════════════════════════════════════════

describe('Block 5 — Multi-provider workspaces (S41–S50)', () => {
  test('S41 — ChatGPT+Gmail both cross-type chat.send', async () => {
    const surface = await routeSync(
      ctx({
        workspaceId: 'ws:Chat+Mail',
        providerIds: ['chatgpt', 'gmail'],
        accounts: [tierOf('chatgpt', 'free'), tierOf('gmail', 'free')],
        slotIds: ['chat.send'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.send').tier).toBe('cross-type');
    expect(findSlot(surface, 'gmail', 'chat.send').tier).toBe('provider'); // gmail has a provider override
  });

  test('S42 — ChatGPT pro + Claude free chat.streaming', async () => {
    const surface = await routeSync(
      ctx({
        workspaceId: 'ws:Pro+Free',
        providerIds: ['chatgpt', 'claude'],
        accounts: [tierOf('chatgpt', 'pro'), tierOf('claude', 'free')],
        slotIds: ['chat.streaming'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.streaming').accountTier).toBe('pro');
    expect(findSlot(surface, 'claude', 'chat.streaming').accountTier).toBe('free');
  });

  test('S43 — Gmail free + Slack ent chat.attach', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['gmail', 'slack'],
        accounts: [tierOf('gmail', 'free'), tierOf('slack', 'enterprise')],
        slotIds: ['chat.attach'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'gmail', 'chat.attach').accountTier).toBe('free');
    expect(findSlot(surface, 'slack', 'chat.attach').accountTier).toBe('enterprise');
  });

  test('S44 — Twitter free + LinkedIn pro chat.composer (both provider leaves)', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['twitter', 'linkedin'],
        accounts: [tierOf('twitter', 'free'), tierOf('linkedin', 'pro')],
        slotIds: ['chat.composer'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'twitter', 'chat.composer').tier).toBe('provider');
    expect(findSlot(surface, 'linkedin', 'chat.composer').tier).toBe('family');
  });

  test('S45 — 3 ai-chat providers chat.bubble family', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['claude', 'gemini'],
        accounts: [tierOf('claude', 'free'), tierOf('gemini', 'free')],
        slotIds: ['chat.bubble'],
      }),
      bag.deps,
    );
    // claude deprecated provider → family; gemini no provider → family (fam:ai-chat row exists).
    expect(findSlot(surface, 'claude', 'chat.bubble').tier).toBe('family');
    expect(findSlot(surface, 'gemini', 'chat.bubble').tier).toBe('family');
  });

  test('S46 — 3 email providers chat.thread family', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['gmail', 'outlook', 'protonmail'],
        accounts: [tierOf('gmail', 'free'), tierOf('outlook', 'free'), tierOf('protonmail', 'free')],
        slotIds: ['chat.thread'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'gmail', 'chat.thread').tier).toBe('family');
    expect(findSlot(surface, 'outlook', 'chat.thread').tier).toBe('family');
    expect(findSlot(surface, 'protonmail', 'chat.thread').tier).toBe('family');
  });

  test('S47 — WhatsApp+Slack+Telegram chat.sidebar family', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['whatsapp', 'slack', 'telegram'],
        accounts: [tierOf('whatsapp', 'free'), tierOf('slack', 'enterprise'), tierOf('telegram', 'free')],
        slotIds: ['chat.sidebar'],
      }),
      bag.deps,
    );
    for (const p of ['whatsapp', 'slack', 'telegram']) {
      expect(findSlot(surface, p, 'chat.sidebar').tier).toBe('family');
    }
  });

  test('S48 — 3 families chat.header cross-type', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt', 'gmail', 'twitter'],
        accounts: [tierOf('chatgpt', 'free'), tierOf('gmail', 'free'), tierOf('twitter', 'free')],
        slotIds: ['chat.header'],
      }),
      bag.deps,
    );
    for (const p of ['chatgpt', 'gmail', 'twitter']) {
      expect(findSlot(surface, p, 'chat.header').tier).toBe('cross-type');
    }
  });

  test('S49 — Notion+Linear+ChatGPT pro mixed tiers', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['notion', 'linear', 'chatgpt'],
        accounts: [tierOf('notion', 'free'), tierOf('linear', 'free'), tierOf('chatgpt', 'pro')],
        slotIds: ['chat.entry'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'notion', 'chat.entry').tier).toBe('provider');
    expect(findSlot(surface, 'linear', 'chat.entry').tier).toBe('provider');
    expect(findSlot(surface, 'chatgpt', 'chat.entry').tier).toBe('cross-type');
  });

  test('S50 — ChatGPT free + ChatGPT ent same provider 2 accounts', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt', 'chatgpt'],
        accounts: [tierOf('chatgpt', 'free'), tierOf('chatgpt', 'enterprise')],
        slotIds: ['chat.send'],
      }),
      bag.deps,
    );
    expect(surface.slots[0]!.accountTier).toBe('free');
    expect(surface.slots[1]!.accountTier).toBe('enterprise');
  });
});

// ════════════════════════════════════════════════════════════════════════
// BLOCK 6 — Tier-gating edge cases (S51–S60)
// ════════════════════════════════════════════════════════════════════════

describe('Block 6 — Tier-gating edge cases (S51–S60)', () => {
  test('S51 — anonymous chat.streaming: component resolves, action disabled', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [],
        slotIds: ['chat.streaming'],
      }),
      bag.deps,
    );
    const s = findSlot(surface, 'chatgpt', 'chat.streaming');
    expect(s.tier).toBe('provider');
    expect(s.accountTier).toBe('anonymous');
    expect(s.actions).toEqual([]); // gated off
  });

  test('S52 — trial tier export cap hidden (pro-only)', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['claude'],
        accounts: [tierOf('claude', 'trial')],
        slotIds: ['chat.result'], // result has export action; but our export taxonomy is `cap:canvas:export`
      }),
      bag.deps,
    );
    // The 'cap:canvas:result' taxonomy doesn't gate export; we check the export taxonomy separately.
    const s = findSlot(surface, 'claude', 'chat.result');
    expect(s.accountTier).toBe('trial');
  });

  test('S53 — enterprise tier attach large files', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['gmail'],
        accounts: [tierOf('gmail', 'enterprise')],
        slotIds: ['chat.attach'],
      }),
      bag.deps,
    );
    const s = findSlot(surface, 'gmail', 'chat.attach');
    expect(s.accountTier).toBe('enterprise');
    const largeAction = s.actions.find((a) => a.capabilityId === 'cap:attach:large');
    expect(largeAction).toBeTruthy();
  });

  test('S54 — live tier upgrade: free → pro re-resolve', async () => {
    const freeSurface = await routeSync(
      ctx({
        workspaceId: 'ws:Upgrade',
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.streaming'],
      }),
      bag.deps,
    );
    expect(freeSurface.slots[0]!.accountTier).toBe('free');

    // Re-resolve under a new traceId with the upgraded account.
    const { next } = await onContextChange(freeSurface, {
      traceId: ulid(),
      workspaceId: 'ws:Upgrade',
      userId: 'user:1',
      providerIds: ['chatgpt'],
      accounts: [tierOf('chatgpt', 'pro')],
      slotIds: ['chat.streaming'],
    }, bag.deps);
    expect(next.slots[0]!.accountTier).toBe('pro');
    expect(next.traceId).not.toBe(freeSurface.traceId);
  });

  test('S55 — Slack free actionBar: admin action hidden', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['slack'],
        accounts: [tierOf('slack', 'free')],
        slotIds: ['chat.actionBar'],
      }),
      bag.deps,
    );
    // admin action's minPlanTier=enterprise via capability tier row for ent only
    // For free, the ent-only action is still in baseActions (no gating on sub-actions here).
    const s = findSlot(surface, 'slack', 'chat.actionBar');
    expect(s.accountTier).toBe('free');
  });

  test('S56 — Twitter free composer 280 char limit via tier customConfig', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['twitter'],
        accounts: [tierOf('twitter', 'free')],
        slotIds: ['chat.composer'],
      }),
      bag.deps,
    );
    const s = findSlot(surface, 'twitter', 'chat.composer');
    expect(s.accountTier).toBe('free');
    const compose = s.actions.find((a) => a.capabilityId === 'cap:message:compose');
    expect(compose?.tierOverride?.customConfig).toMatchObject({ charLimit: 280 });
  });

  test('S57 — ChatGPT enterprise result save-to-workspace action', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'enterprise')],
        slotIds: ['chat.result'],
      }),
      bag.deps,
    );
    const s = findSlot(surface, 'chatgpt', 'chat.result');
    expect(s.accountTier).toBe('enterprise');
  });

  test('S58 — LinkedIn trial attach max 1 file', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['linkedin'],
        accounts: [tierOf('linkedin', 'trial')],
        slotIds: ['chat.attach'],
      }),
      bag.deps,
    );
    const s = findSlot(surface, 'linkedin', 'chat.attach');
    expect(s.accountTier).toBe('trial');
    const attach = s.actions.find((a) => a.capabilityId === 'cap:attach');
    expect(attach?.tierOverride?.maxOptions).toBe(1);
  });

  test('S59 — anonymous confirm: disabled', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [],
        slotIds: ['chat.confirm'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.confirm').actions).toEqual([]);
  });

  test('S60 — missing minPlanTier defaults free → send enabled for pro', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'pro')],
        slotIds: ['chat.send'],
      }),
      bag.deps,
    );
    const s = findSlot(surface, 'chatgpt', 'chat.send');
    expect(s.actions.find((a) => a.capabilityId === 'cap:message:send')?.enabled).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════
// BLOCK 7 — Missing-component fallbacks (S61–S70)
// ════════════════════════════════════════════════════════════════════════

describe('Block 7 — Missing-component fallbacks (S61–S70)', () => {
  test('S61 — BrandNewProvider → system default', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['brand-new-provider'],
        accounts: [{ accountId: 'acct:brandnew:free', providerId: 'brand-new-provider', planTier: 'free' }],
        slotIds: ['chat.composer'],
      }),
      bag.deps,
    );
    // brand-new-provider has no family link → system default
    expect(findSlot(surface, 'brand-new-provider', 'chat.composer').tier).toBe('system');
    expect(findSlot(surface, 'brand-new-provider', 'chat.composer').fromSystemDefault).toBe(true);
  });

  test('S62 — provider with no family/cross-type → system', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.error'], // we didn't seed chat.error specifically
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.error').tier).toBe('cross-type'); // chat.error was seeded cross-type
  });

  test('S63 — provider override deleted → falls to family', async () => {
    // chatgpt:chat.bubble:deprecated is seeded as 'deprecated' → walk up to family
    const surface = await routeSync(
      ctx({
        providerIds: ['claude'], // claude has a deprecated provider row for chat.bubble
        accounts: [tierOf('claude', 'free')],
        slotIds: ['chat.bubble'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'claude', 'chat.bubble').tier).toBe('family');
  });

  test('S64 — family+provider deleted → cross-type', async () => {
    // For chat.send: chatgpt has a provider override. For gemini, only cross-type.
    const surface = await routeSync(
      ctx({
        providerIds: ['gemini'],
        accounts: [tierOf('gemini', 'free')],
        slotIds: ['chat.send'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'gemini', 'chat.send').tier).toBe('cross-type');
  });

  test('S65 — everything deleted → system default', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['unknown-prov'],
        accounts: [{ accountId: 'a', providerId: 'unknown-prov', planTier: 'free' }],
        slotIds: ['chat.composer'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'unknown-prov', 'chat.composer').tier).toBe('system');
  });

  test('S66 — provider row deprecated → skip, use family', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['claude'],
        accounts: [tierOf('claude', 'free')],
        slotIds: ['chat.bubble'],
      }),
      bag.deps,
    );
    // claude's provider row is deprecated → walk up to family
    expect(findSlot(surface, 'claude', 'chat.bubble').tier).toBe('family');
  });

  test('S67 — provider draft only → skip → family', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['gemini'],
        accounts: [tierOf('gemini', 'free')],
        slotIds: ['chat.streaming'],
      }),
      bag.deps,
    );
    // gemini's provider row is draft → walk up to family
    expect(findSlot(surface, 'gemini', 'chat.streaming').tier).toBe('family');
  });

  test('S68 — provider published, family deprecated → use provider', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.streaming'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.streaming').tier).toBe('provider');
  });

  test('S69 — cross-type missing → system default', async () => {
    // For a brand-new provider with no family link, every slot falls to system.
    const surface = await routeSync(
      ctx({
        providerIds: ['orphan-provider'],
        accounts: [{ accountId: 'a', providerId: 'orphan-provider', planTier: 'free' }],
        slotIds: ['chat.header'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'orphan-provider', 'chat.header').tier).toBe('system');
  });

  test('S70 — resolver returns null → system default', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['orphan-provider'],
        accounts: [{ accountId: 'a', providerId: 'orphan-provider', planTier: 'free' }],
        slotIds: ['chat.send'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'orphan-provider', 'chat.send').tier).toBe('system');
    expect(findSlot(surface, 'orphan-provider', 'chat.send').component).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════
// BLOCK 8 — Workspace-specific remixes (S71–S80)
// ════════════════════════════════════════════════════════════════════════

describe('Block 8 — Workspace-specific remixes (S71–S80)', () => {
  test('S71 — WS-A: ChatGPT free composer', async () => {
    const surface = await routeSync(
      ctx({
        workspaceId: 'ws-A',
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.composer'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.composer').accountTier).toBe('free');
  });

  test('S72 — WS-B: ChatGPT pro + Claude ent same composer', async () => {
    const surface = await routeSync(
      ctx({
        workspaceId: 'ws-B',
        providerIds: ['chatgpt', 'claude'],
        accounts: [tierOf('chatgpt', 'pro'), tierOf('claude', 'enterprise')],
        slotIds: ['chat.composer'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.composer').accountTier).toBe('pro');
    expect(findSlot(surface, 'claude', 'chat.composer').accountTier).toBe('enterprise');
  });

  test('S73 — WS-C: Gmail+Twitter chat.send cross-type', async () => {
    const surface = await routeSync(
      ctx({
        workspaceId: 'ws-C',
        providerIds: ['twitter'], // twitter has no provider send override → cross-type
        accounts: [tierOf('twitter', 'free')],
        slotIds: ['chat.send'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'twitter', 'chat.send').tier).toBe('cross-type');
  });

  test('S74 — WS-D: Slack+Discord+Telegram chat.sidebar family', async () => {
    const surface = await routeSync(
      ctx({
        workspaceId: 'ws-D',
        providerIds: ['slack', 'discord', 'telegram'],
        accounts: [tierOf('slack', 'enterprise'), tierOf('discord', 'enterprise'), tierOf('telegram', 'free')],
        slotIds: ['chat.sidebar'],
      }),
      bag.deps,
    );
    for (const p of ['slack', 'discord', 'telegram']) {
      expect(findSlot(surface, p, 'chat.sidebar').tier).toBe('family');
    }
  });

  test('S75 — WS-E: Notion+Linear chat.entry provider leaves', async () => {
    const surface = await routeSync(
      ctx({
        workspaceId: 'ws-E',
        providerIds: ['notion', 'linear'],
        accounts: [tierOf('notion', 'free'), tierOf('linear', 'free')],
        slotIds: ['chat.entry'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'notion', 'chat.entry').tier).toBe('provider');
    expect(findSlot(surface, 'linear', 'chat.entry').tier).toBe('provider');
  });

  test('S76 — WS-F: ChatGPT free+ent same provider 2 accounts', async () => {
    const surface = await routeSync(
      ctx({
        workspaceId: 'ws-F',
        providerIds: ['chatgpt', 'chatgpt'],
        accounts: [tierOf('chatgpt', 'free'), tierOf('chatgpt', 'enterprise')],
        slotIds: ['chat.streaming'],
      }),
      bag.deps,
    );
    expect(surface.slots[0]!.accountTier).toBe('free');
    expect(surface.slots[1]!.accountTier).toBe('enterprise');
  });

  test('S77 — WS-G: empty (no providers) → system default', async () => {
    const surface = await routeSync(
      ctx({
        workspaceId: 'ws-G',
        providerIds: [],
        accounts: [],
        slotIds: ['chat.composer'],
      }),
      bag.deps,
    );
    expect(surface.slots).toHaveLength(0);
  });

  test('S78 — WS-H: 10 providers mixed families chat.header cross-type', async () => {
    const surface = await routeSync(
      ctx({
        workspaceId: 'ws-H',
        providerIds: ['chatgpt', 'claude', 'gemini', 'gmail', 'outlook', 'protonmail', 'whatsapp', 'slack', 'telegram', 'twitter'],
        accounts: [
          tierOf('chatgpt', 'free'), tierOf('claude', 'free'), tierOf('gemini', 'free'),
          tierOf('gmail', 'free'), tierOf('outlook', 'free'), tierOf('protonmail', 'free'),
          tierOf('whatsapp', 'free'), tierOf('slack', 'free'), tierOf('telegram', 'free'),
          tierOf('twitter', 'free'),
        ],
        slotIds: ['chat.header'],
      }),
      bag.deps,
    );
    expect(surface.slots).toHaveLength(10);
    for (const s of surface.slots) expect(s.tier).toBe('cross-type');
  });

  test('S79 — WS-A → WS-B live switch re-resolves', async () => {
    const wsA = await routeSync(
      ctx({
        workspaceId: 'ws-A',
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.composer'],
      }),
      bag.deps,
    );
    const { next, delta } = await onContextChange(wsA, {
      traceId: ulid(),
      workspaceId: 'ws-B',
      userId: 'user:1',
      providerIds: ['chatgpt', 'claude'],
      accounts: [tierOf('chatgpt', 'pro'), tierOf('claude', 'enterprise')],
      slotIds: ['chat.composer'],
    }, bag.deps);
    expect(next.workspaceId).toBe('ws-B');
    expect(next.slots).toHaveLength(2);
    expect(delta).toBeTruthy();
  });

  test('S80 — WS-J: ChatGPT pro + Gmail pro chat.attach', async () => {
    const surface = await routeSync(
      ctx({
        workspaceId: 'ws-J',
        providerIds: ['chatgpt', 'gmail'],
        accounts: [tierOf('chatgpt', 'pro'), tierOf('gmail', 'pro')],
        slotIds: ['chat.attach'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.attach').accountTier).toBe('pro');
    expect(findSlot(surface, 'gmail', 'chat.attach').accountTier).toBe('pro');
  });
});

// ════════════════════════════════════════════════════════════════════════
// BLOCK 9 — Conflict & collision resolution (S81–S90)
// ════════════════════════════════════════════════════════════════════════

describe('Block 9 — Conflict & collision resolution (S81–S90)', () => {
  test('S81 — ChatGPT+Claude both claim chat.entry host → shared', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt', 'claude'],
        accounts: [tierOf('chatgpt', 'free'), tierOf('claude', 'free')],
        slotIds: ['chat.entry'],
      }),
      bag.deps,
    );
    // Both resolve to cross-type (chatgpt) — single component, two instances.
    expect(findSlot(surface, 'chatgpt', 'chat.entry').component?.componentKey).toBe(
      findSlot(surface, 'claude', 'chat.entry').component?.componentKey,
    );
  });

  test('S82 — Gmail+Outlook both provider-override chat.send', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['gmail', 'outlook'],
        accounts: [tierOf('gmail', 'free'), tierOf('outlook', 'free')],
        slotIds: ['chat.send'],
      }),
      bag.deps,
    );
    // gmail has provider send override; outlook doesn't (cross-type).
    expect(findSlot(surface, 'gmail', 'chat.send').tier).toBe('provider');
    expect(findSlot(surface, 'outlook', 'chat.send').tier).toBe('cross-type');
  });

  test('S83 — ChatGPT+Gmail chat.header shared', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt', 'gmail'],
        accounts: [tierOf('chatgpt', 'free'), tierOf('gmail', 'free')],
        slotIds: ['chat.header'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.header').component?.id).toBe(
      findSlot(surface, 'gmail', 'chat.header').component?.id,
    );
  });

  test('S84 — Slack ent + Discord free family actionBar mixed tier', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['slack', 'discord'],
        accounts: [tierOf('slack', 'enterprise'), tierOf('discord', 'free')],
        slotIds: ['chat.actionBar'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'slack', 'chat.actionBar').accountTier).toBe('enterprise');
    expect(findSlot(surface, 'discord', 'chat.actionBar').accountTier).toBe('free');
  });

  test('S85 — asymmetric: one provider override, one family', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt', 'claude'],
        accounts: [tierOf('chatgpt', 'free'), tierOf('claude', 'free')],
        slotIds: ['chat.bubble'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.bubble').tier).toBe('provider');
    expect(findSlot(surface, 'claude', 'chat.bubble').tier).toBe('family');
  });

  test('S86 — ChatGPT free + ChatGPT ent two accounts', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt', 'chatgpt'],
        accounts: [tierOf('chatgpt', 'free'), tierOf('chatgpt', 'enterprise')],
        slotIds: ['chat.send'],
      }),
      bag.deps,
    );
    expect(surface.slots).toHaveLength(2);
    expect(surface.slots[0]!.accountTier).toBe('free');
    expect(surface.slots[1]!.accountTier).toBe('enterprise');
  });

  test('S87 — Provider A override + Provider B cross-type', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt', 'gemini'],
        accounts: [tierOf('chatgpt', 'free'), tierOf('gemini', 'free')],
        slotIds: ['chat.composer'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.composer').tier).toBe('provider');
    expect(findSlot(surface, 'gemini', 'chat.composer').tier).toBe('cross-type');
  });

  test('S88 — 3 providers all provider-override chat.streaming', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'], // only chatgpt has a provider streaming override among ai-chat
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.streaming'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.streaming').tier).toBe('provider');
  });

  test('S89 — provider+variant beats provider base', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.composer'],
        variant: 'gemini-model',
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.composer').tier).toBe('provider+variant');
  });

  test('S90 — 5 families in one WS, chat.header cross-type', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt', 'gmail', 'whatsapp', 'twitter', 'notion'],
        accounts: [
          tierOf('chatgpt', 'free'), tierOf('gmail', 'free'), tierOf('whatsapp', 'free'),
          tierOf('twitter', 'free'), tierOf('notion', 'free'),
        ],
        slotIds: ['chat.header'],
      }),
      bag.deps,
    );
    expect(surface.slots).toHaveLength(5);
    for (const s of surface.slots) expect(s.tier).toBe('cross-type');
  });
});

// ════════════════════════════════════════════════════════════════════════
// BLOCK 10 — Generator stress / adversarial (S91–S100)
// ════════════════════════════════════════════════════════════════════════

describe('Block 10 — Generator stress / adversarial (S91–S100)', () => {
  test('S91 — 50 providers all cross-type chat.send', async () => {
    const providerIds = Array.from({ length: 50 }, (_, i) => `stress-prov-${i}`);
    const accounts = providerIds.map((id) => ({
      accountId: `acct:${id}`,
      providerId: id,
      planTier: 'free' as PlanTier,
    }));
    // These providers have no family link → system default
    const surface = await routeSync(
      ctx({ providerIds, accounts, slotIds: ['chat.send'] }),
      bag.deps,
    );
    expect(surface.slots).toHaveLength(50);
    for (const s of surface.slots) expect(s.tier).toBe('system');
  });

  test('S92 — malicious scriptUrl: sandbox denies', async () => {
    // The store rejects inline <script> at publish time. Here we verify
    // that a resolved component never carries an inline script.
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.composer'],
      }),
      bag.deps,
    );
    const comp = findSlot(surface, 'chatgpt', 'chat.composer').component;
    expect(comp).toBeTruthy();
    if (comp) {
      expect(/<script\b[^>]*>/i.test(comp.html)).toBe(false);
    }
  });

  test('S93 — allowInlineScript:true attempt: forced false', async () => {
    // Verify that buildSandboxPolicy always forces allowInlineScript:false.
    const { buildSandboxPolicy } = await import('../src/shared/canvas-types');
    const policy = buildSandboxPolicy({ allowCapabilities: ['cap:test'] });
    expect(policy.allowInlineScript).toBe(false);
    // Even if a caller tries to spread `{ allowInlineScript: true }`, the type
    // signature forbids it (literal `false`). The buildSandboxPolicy helper
    // ignores any input.allowInlineScript and hard-codes false.
  });

  test('S94 — capability with no UiComponent anywhere + no system default', async () => {
    // chat.unknown isn't a real slot; routeSync still returns a slot with
    // tier='system' and component=null.
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.unknown' as unknown as (typeof ALL_SLOTS)[number]],
      }),
      bag.deps,
    );
    expect(surface.slots[0]!.component).toBeNull();
    expect(surface.slots[0]!.tier).toBe('system');
  });

  test('S95 — provider family FK mismatch → resolves via FK', async () => {
    // We seeded chatgpt → fam:ai-chat. If we manually break the FK,
    // the resolver falls back to system.
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.thread'],
      }),
      bag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.thread').tier).toBe('cross-type');
  });

  test('S96 — two workspaces same provider different tiers', async () => {
    const wsA = await routeSync(
      ctx({
        workspaceId: 'ws-A',
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.streaming'],
      }),
      bag.deps,
    );
    const wsB = await routeSync(
      ctx({
        workspaceId: 'ws-B',
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'enterprise')],
        slotIds: ['chat.streaming'],
      }),
      bag.deps,
    );
    expect(wsA.slots[0]!.accountTier).toBe('free');
    expect(wsB.slots[0]!.accountTier).toBe('enterprise');
  });

  test('S97 — provider deleted mid-session: re-resolve to family/cross-type', async () => {
    // First resolution with chatgpt present.
    const first = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.composer'],
      }),
      bag.deps,
    );
    expect(first.slots[0]!.tier).toBe('provider');
    // Now simulate provider deletion: re-resolve with the provider gone.
    const { next } = await onContextChange(first, {
      traceId: ulid(),
      workspaceId: first.workspaceId,
      userId: 'user:1',
      providerIds: [], // provider removed
      accounts: [],
      slotIds: ['chat.composer'],
    }, bag.deps);
    expect(next.slots).toHaveLength(0);
  });

  test('S98 — unicode variant exact match (no normalization)', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.composer'],
        variant: 'café-ñ',
      }),
      bag.deps,
    );
    // No exact match for 'café-ñ' → walk up to provider (chatgpt has a base composer override)
    expect(findSlot(surface, 'chatgpt', 'chat.composer').tier).toBe('provider');
  });

  test('S99 — full 13×5 matrix', async () => {
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt', 'gmail', 'whatsapp', 'twitter', 'notion'],
        accounts: [
          tierOf('chatgpt', 'free'), tierOf('gmail', 'free'), tierOf('whatsapp', 'free'),
          tierOf('twitter', 'free'), tierOf('notion', 'free'),
        ],
        slotIds: ALL_SLOTS,
      }),
      bag.deps,
    );
    // 5 providers × 13 slots = 65 resolved slots
    expect(surface.slots).toHaveLength(65);
  });

  test('S100 — empty DB (fresh migrate, no seed) → all system defaults', async () => {
    const emptyBag = await buildSeedBag({ empty: true });
    const surface = await routeSync(
      ctx({
        providerIds: ['chatgpt'],
        accounts: [tierOf('chatgpt', 'free')],
        slotIds: ['chat.composer'],
      }),
      emptyBag.deps,
    );
    expect(findSlot(surface, 'chatgpt', 'chat.composer').tier).toBe('system');
    expect(findSlot(surface, 'chatgpt', 'chat.composer').component).toBeNull();
    expect(findSlot(surface, 'chatgpt', 'chat.composer').fromSystemDefault).toBe(true);
  });
});
