

# ═══════════════════════════════════════════════════════════════
# PART FILE: 11-combinatorial-scenarios.md
# ═══════════════════════════════════════════════════════════════

# DOC 11 — COMBINATORIAL DESIGN: ONE UI, MANY APPS, ANY REMIX

> Companion to DOC 1–10. This document (1) formalizes the conceptual vision the user described — UI components as *representations of provider capabilities*, (2) defines the **component→provider registry tree** + the **workspace remix model**, and (3) generates **100 combinatorial scenarios** that the resolution engine + routers must handle for *any* provider type × *any* component type × *any* account tier, shared and not-shared, across workspaces.

---

## PART A — THE CONCEPTUAL VISION (what we are really building)

### A.1 UI components = capability representations

Every visible thing on the canvas is not "a widget." It is a **rendering of a capability** that a provider exposes.

- The **send button** is the rendering of `cap:message:send`.
- The **message box / composer** is the rendering of `cap:message:compose`.
- The **thread** is the rendering of `cap:conversation:list`.
- The **streaming result** is the rendering of `cap:response:stream`.

These capabilities are **shared across providers**. `cap:message:send` exists for ChatGPT, Gmail, WhatsApp, and Twitter. That is why we can have **one UI, many apps**: a single `chat.send` component can render the send action for 50 different providers, because the *capability* is the same even when the *provider* differs.

### A.2 The component → provider registry tree

Resolution is a **tree walk** from the most specific binding to the most generic:

```
LEVEL 0  system built-in default          (hardcoded fallback, last resort)
   │
LEVEL 1  cross-type  (ownerId='global')   ← SHARED across ALL providers/families
   │
LEVEL 2  family      (ownerId=familyId)    ← SHARED across one family (ai-chat, email, ...)
   │
LEVEL 3  family+variant (ownerId=familyId, variant)
   │
LEVEL 4  provider    (ownerId=providerId)  ← provider-specific override
   │
LEVEL 5  provider+variant (ownerId=providerId, variant)  ← most specific
```

Each level is a `UiComponent` row keyed by `(primitiveId, scope, ownerId, variant)`. The resolver walks **5 → 4 → 3 → 2 → 1 → 0** and returns the first hit. This is the 4-tier model extended to 6 explicit levels (the POC's hardcoded tool set is replaced by this data-driven tree).

**Key insight:** the tree is *sparse*. Most providers have NO provider-level override, so they inherit the cross-type or family component. That is the "one UI, many apps" effect — 90% of providers render from shared rows; only the different ones get an override leaf.

### A.3 Account tier gates the capability (not just the component)

A component can resolve, but the *capability it represents* may be **tier-gated**:

- `ProviderAccount.planTier` ∈ {anonymous, free, trial, pro, enterprise}
- `CapabilityTaxonomy.minPlanTier` — minimum tier to even see the capability
- `CapabilityTier` — per-tier UI overrides (e.g., `pro` gets an "export all" button the `free` tier doesn't)

So resolution is **two-phase**:
1. **Component resolution** (the tree walk above) → *which UiComponent renders*.
2. **Capability gating** (tier check) → *whether it's enabled / what sub-actions show*.

A `free` account on ChatGPT resolves the same `chat.send` component as `enterprise`, but `enterprise` additionally sees the `cap:export:all` action because its `CapabilityTier` unlocks it.

### A.4 The workspace = the remix container

A **workspace** binds a named set of `(provider, account)` pairs and chooses a **global UI component set**. The same global component (`chat.composer`) can be used in:

- **Workspace A**: {ChatGPT(free), Gmail(free)} → composer renders with free-tier actions only.
- **Workspace B**: {ChatGPT(pro), Slack(enterprise)} → same `chat.composer` component, but now pro/enterprise actions appear because the accounts behind it are higher tier.

The component is **shared**; the *resolution context* (which providers/accounts are in the workspace) changes what it renders and what it enables. This is the user's core ask: **combine XYZ providers (same type and/or different types) under one global UI, with different combinations of providers and accounts per workspace.**

### A.5 What the engine + router must GENERATE

Given the above, the generated system must, for *any* triple (providerType × componentType × accountTier), produce:
- a resolved `UiComponent` (or explicit `fromSystemDefault` fallback),
- a tier-gated action set,
- a per-workspace layout,
- and the routers (`cap:canvas:*`, `cap:conceptual:*`, `cap:conversation:*`) that serve it.

The 100 scenarios below are the **acceptance matrix** for that generator.

---

## PART B — THE DIMENSIONS

| Dim | Values |
|---|---|
| **Provider family** | ai-chat, email, messenger, social, custom |
| **Provider examples** | ChatGPT, Claude, Gemini (ai-chat); Gmail, Outlook (email); WhatsApp, Slack, Telegram (messenger); Twitter/X, LinkedIn (social); Notion, Linear (custom) |
| **Component (slot)** | chat.entry, chat.sidebar, chat.thread, chat.bubble, chat.composer, chat.send, chat.attach, chat.streaming, chat.result, chat.confirm, chat.error, chat.header, chat.actionBar |
| **Account tier** | anonymous, free, trial, pro, enterprise |
| **Resolution level** | system, cross-type, family, family+variant, provider, provider+variant |
| **Sharing** | shared (cross-type/family) vs specific (provider/provider+variant) |
| **Workspace** | single-provider, multi-same-family, multi-mixed-family, multi-account-same-provider |

---

## PART C — THE 100 COMBINATORIAL SCENARIOS

> Each scenario: **ID | Providers(+family/+tier) | Component | Workspace | Expectation (resolution + gating) | Engine/Router action to generate**.
> `R#` = resolution level, `T#` = tier gate. "SHARED" = inherits cross-type/family row.

### Block 1 — Cross-type shared components (the "one UI, many apps" core) [S01–S10]

- **S01** | ChatGPT(free), Gmail(free), WhatsApp(free), Twitter(free) | chat.send | WS "AllFree" | All 4 resolve to **cross-type** `chat.send` (SHARED). R=cross-type, T=free (send enabled, no export). | Engine: resolve once, render 4 instances from one row. Router: `GET /api/conceptual/surface` returns same componentKey for all.
- **S02** | Claude(pro), Outlook(free) | chat.composer | WS "MixedTier" | Both use **cross-type** `chat.composer` (SHARED). Claude sees pro actions (attach multiple), Outlook sees free. R=cross-type, T=per-account. | Engine: same component, tier-gated action set differs per account. Router: per-account capability gating in `registerUiComponent`.
- **S03** | Gemini(free), LinkedIn(free) | chat.thread | WS "CrossFamily" | Both use **cross-type** `chat.thread` (SHARED) despite different families (ai-chat vs social). R=cross-type. | Engine: family-agnostic thread component. Router: `cap:conversation:list` serves both.
- **S04** | Slack(enterprise), Telegram(free) | chat.attach | WS "EntFree" | Cross-type `chat.attach` SHARED. Slack(ent) sees `cap:attach:large` (tier override), Telegram(free) sees basic. R=cross-type, T=enterprise/free. | Engine: `CapabilityTier` uiComponentOverride for ent. Router: `cap:attach` gated by `minPlanTier`.
- **S05** | ChatGPT(trial), Claude(trial) | chat.streaming | WS "Trials" | Cross-type `chat.streaming` SHARED, trial tier shows watermark. R=cross-type, T=trial. | Engine: trial watermark via `CapabilityTier` customConfigJson. Router: stream handler injects watermark flag.
- **S06** | Gmail(free), Outlook(free), ProtonMail(free) | chat.header | WS "EmailFree" | All 3 email providers use **cross-type** `chat.header` (SHARED) — header is family-agnostic. R=cross-type. | Engine: header renders provider name from context, not hardcoded. Router: `uiSlots` claim carries providerSlug.
- **S07** | Twitter(free), LinkedIn(free), Mastodon(free) | chat.actionBar | WS "SocialFree" | Cross-type `chat.actionBar` SHARED across social family + others. R=cross-type. | Engine: actionBar pulls actions from resolved capabilities per provider. Router: `cap:canvas:mutate` updates bar.
- **S08** | Notion(free), Linear(free) | chat.entry | WS "CustomFree" | Cross-type `chat.entry` SHARED for custom family. R=cross-type. | Engine: entry host is provider-agnostic. Router: `cap:canvas:spawn` for entry node.
- **S09** | ChatGPT(free), ChatGPT(enterprise) [TWO ACCOUNTS] | chat.send | WS "MultiAcct" | Same provider, two tiers, **same cross-type** component. Free acct: send only. Ent acct: send + schedule + export. R=cross-type, T differs per account. | Engine: per-account tier resolve. Router: accountId in resolution ctx.
- **S10** | anonymous (no account) | chat.composer | WS "Anon" | Cross-type `chat.composer` SHARED but **disabled** (minPlanTier=free blocks compose). R=cross-type, T=anonymous → gated off. | Engine: capability hidden when account tier < minPlanTier. Router: `cap:message:compose` returns 403 for anonymous.

### Block 2 — Family-level shared overrides [S11–S20]

- **S11** | ChatGPT(free), Claude(free), Gemini(free) | chat.bubble | WS "AiChat" | **family** `ai-chat.chat.bubble` SHARED across all 3 (no provider override). R=family. | Engine: family row wins over cross-type. Router: `resolveSurface` returns family tier.
- **S12** | Gmail(free), Outlook(free) | chat.thread | WS "Email" | **family** `email.chat.thread` SHARED (email threads differ from chat threads). R=family. | Engine: family-specific thread layout. Router: family regionLayout applied.
- **S13** | WhatsApp(free), Slack(free), Telegram(free) | chat.sidebar | WS "Messenger" | **family** `messenger.chat.sidebar` SHARED. R=family. | Engine: messenger sidebar with contact list. Router: `uiSlots` family claim.
- **S14** | Twitter(free), LinkedIn(free) | chat.composer | WS "Social" | **family** `social.chat.composer` SHARED (social composer has @mention UI). R=family. | Engine: social composer variant. Router: family component registered.
- **S15** | ChatGPT(pro), Claude(pro), Gemini(pro) | chat.streaming | WS "AiChatPro" | **family** `ai-chat.chat.streaming` SHARED + pro tier actions. R=family, T=pro. | Engine: family streaming + pro export. Router: `cap:response:stream` pro path.
- **S16** | Gmail(enterprise), Outlook(enterprise) | chat.attach | WS "EmailEnt" | **family** `email.chat.attach` SHARED + ent tier (large attachments). R=family, T=enterprise. | Engine: family attach + ent `CapabilityTier`. Router: `cap:attach:large` enabled.
- **S17** | WhatsApp(trial), Telegram(trial) | chat.bubble | WS "MsgTrial" | **family** `messenger.chat.bubble` SHARED + trial watermark. R=family, T=trial. | Engine: trial badge. Router: trial flag in payload.
- **S18** | Notion(free), Linear(free), Airtable(free) | chat.sidebar | WS "Custom" | **family** `custom.chat.sidebar` SHARED (custom apps share a doc-tree sidebar). R=family. | Engine: custom sidebar. Router: family regionLayout.
- **S19** | ChatGPT(free), Gmail(free) [mixed family] | chat.header | WS "MixedHeader" | **cross-type** `chat.header` (header has no family override, even though providers differ in family). R=cross-type. | Engine: header is cross-type even in mixed WS. Router: `resolveSurface` returns cross-type.
- **S20** | Slack(enterprise), Discord(enterprise) | chat.actionBar | WS "MsgEnt" | **family** `messenger.chat.actionBar` SHARED + ent actions (admin, broadcast). R=family, T=enterprise. | Engine: family actionBar + ent overrides. Router: `cap:canvas:mutate` ent actions.

### Block 3 — Provider-specific overrides (the "different ones get a leaf") [S21–S30]

- **S21** | ChatGPT(free) [has provider override] | chat.composer | WS "CGPT" | **provider** `chatgpt.chat.composer` (ChatGPT's custom composer). R=provider. | Engine: provider leaf wins. Router: `resolveSurface` returns provider tier.
- **S22** | Gmail(free) [provider override] | chat.send | WS "Gmail" | **provider** `gmail.chat.send` (Gmail send w/ "To" field). R=provider. | Engine: provider send component. Router: `cap:message:send` Gmail path.
- **S23** | Slack(enterprise) [provider override] | chat.thread | WS "Slack" | **provider** `slack.chat.thread` (channel-based threads). R=provider. | Engine: Slack thread UI. Router: `cap:conversation:list` Slack.
- **S24** | Twitter(free) [provider override] | chat.composer | WS "Twitter" | **provider** `twitter.chat.composer` (280-char counter). R=provider. | Engine: Twitter composer w/ counter. Router: provider component registered.
- **S25** | ChatGPT(pro) [provider + pro tier] | chat.streaming | WS "CGPTPro" | **provider** `chatgpt.chat.streaming` + pro export. R=provider, T=pro. | Engine: provider streaming + pro `CapabilityTier`. Router: pro stream path.
- **S26** | Gmail(enterprise) [provider + ent tier] | chat.attach | WS "GmailEnt" | **provider** `gmail.chat.attach` + ent large files. R=provider, T=enterprise. | Engine: Gmail attach + ent override. Router: `cap:attach:large` Gmail.
- **S27** | WhatsApp(free) [provider override] | chat.bubble | WS "WA" | **provider** `whatsapp.chat.bubble` (green bubbles). R=provider. | Engine: WA bubble styling. Router: provider component CSS.
- **S28** | LinkedIn(free) [provider override] | chat.actionBar | WS "LI" | **provider** `linkedin.chat.actionBar` (Connect, Message). R=provider. | Engine: LinkedIn actions. Router: `cap:canvas:mutate` LinkedIn.
- **S29** | Notion(free) [provider override] | chat.entry | WS "Notion" | **provider** `notion.chat.entry` (block-based entry). R=provider. | Engine: Notion entry. Router: `cap:canvas:spawn` Notion.
- **S30** | ChatGPT(free) [provider override] but family also exists | chat.bubble | WS "CGPTBubble" | **provider** `chatgpt.chat.bubble` wins over `ai-chat.chat.bubble`. R=provider (not family). | Engine: provider leaf beats family. Router: resolver returns provider tier.

### Block 4 — Variant overrides (provider+variant / family+variant) [S31–S40]

- **S31** | ChatGPT(free, variant=gemini-model) | chat.composer | WS "CGPTGem" | **provider+variant** `chatgpt.gemini.chat.composer` (Gemini-flavored composer on ChatGPT). R=provider+variant. | Engine: variant leaf wins. Router: variant in resolution ctx.
- **S32** | Claude(pro, variant=opus) | chat.streaming | WS "ClaudeOpus" | **provider+variant** `claude.opus.chat.streaming` (Opus extended thinking UI). R=provider+variant, T=pro. | Engine: variant streaming. Router: variant capability path.
- **S33** | Gmail(free, variant=workspace) | chat.send | WS "GmailWS" | **provider+variant** `gmail.workspace.chat.send` (workspace send w/ delegated send). R=provider+variant. | Engine: variant send. Router: variant `cap:message:send`.
- **S34** | ai-chat family (variant=voice) | chat.composer | WS "Voice" | **family+variant** `ai-chat.voice.chat.composer` (voice input composer for whole family). R=family+variant. | Engine: family variant composer. Router: family variant registered.
- **S35** | email family (variant=encrypted) | chat.attach | WS "EncEmail" | **family+variant** `email.encrypted.chat.attach` (PGP attach UI). R=family+variant. | Engine: family variant attach. Router: variant `cap:attach`.
- **S36** | ChatGPT(free, variant=gemini) but no provider+variant row | chat.bubble | WS "FallThru" | Falls back to **provider** `chatgpt.chat.bubble` (variant missing → walk up). R=provider. | Engine: variant miss → provider. Router: resolver walks up tree.
- **S37** | Claude(pro, variant=opus) but no provider+variant, no provider | chat.thread | WS "FallThru2" | Falls to **family** `ai-chat.chat.thread`. R=family, T=pro. | Engine: variant+provider miss → family. Router: family tier.
- **S38** | Gmail(free, variant=workspace) but only cross-type exists | chat.header | WS "FallThru3" | Falls to **cross-type** `chat.header`. R=cross-type. | Engine: all specific missing → cross-type. Router: cross-type returned.
- **S39** | Custom provider w/ variant only, no base | chat.entry | WS "VarOnly" | **provider+variant** wins even if provider base absent (variant is more specific). R=provider+variant. | Engine: variant present → use it. Router: variant resolution.
- **S40** | All levels present for chat.send | chat.send | WS "Full" | Resolver picks **provider+variant** (deepest). R=provider+variant. | Engine: deepest wins. Router: `resolveSurface` deepest tier.

### Block 5 — Multi-provider workspaces (the remix) [S41–S50]

- **S41** | ChatGPT(free)+Gmail(free) | chat.send | WS "Chat+Mail" | Both use cross-type `chat.send` SHARED in one WS. R=cross-type x2. | Engine: 2 instances, 1 component. Router: `cap:canvas:spawn` x2.
- **S42** | ChatGPT(pro)+Claude(free) | chat.streaming | WS "Pro+Free" | Cross-type `chat.streaming` SHARED; ChatGPT shows pro export, Claude doesn't. R=cross-type, T differs. | Engine: shared component, per-account tier. Router: per-account gating.
- **S43** | Gmail(free)+Slack(enterprise) | chat.attach | WS "Mail+Msg" | Cross-type `chat.attach` SHARED; Slack(ent) large files, Gmail(free) basic. R=cross-type, T differs. | Engine: shared + tier. Router: tier gate per account.
- **S44** | Twitter(free)+LinkedIn(pro) | chat.composer | WS "SocialMix" | Twitter uses **provider** composer, LinkedIn uses **provider** composer (both overridden, different). R=provider x2 (different leaves). | Engine: two provider leaves in one WS. Router: two provider components.
- **S45** | ChatGPT(free)+Claude(free)+Gemini(free) | chat.bubble | WS "3Ai" | All use **family** `ai-chat.chat.bubble` SHARED. R=family x3. | Engine: family shared x3. Router: family tier x3.
- **S46** | Gmail(free)+Outlook(free)+ProtonMail(free) | chat.thread | WS "3Mail" | All use **family** `email.chat.thread` SHARED. R=family x3. | Engine: family shared. Router: family regionLayout x3.
- **S47** | WhatsApp(free)+Slack(ent)+Telegram(free) | chat.sidebar | WS "3Msg" | All use **family** `messenger.chat.sidebar` SHARED; Slack(ent) admin node. R=family, T differs. | Engine: family shared + ent node. Router: ent action gated.
- **S48** | ChatGPT(free)+Gmail(free)+Twitter(free) [3 families] | chat.header | WS "3Fam" | Cross-type `chat.header` SHARED across 3 families. R=cross-type x3. | Engine: cross-type in mixed WS. Router: cross-type x3.
- **S49** | Notion(free)+Linear(free)+ChatGPT(pro) | chat.entry | WS "Custom+Ai" | Notion/Linear use **provider** entry, ChatGPT uses **family** `ai-chat.chat.entry` + pro. R=mixed. | Engine: mixed resolution in one WS. Router: mixed tiers.
- **S50** | ChatGPT(free)+ChatGPT(enterprise) [same provider, 2 accts] | chat.send | WS "DupProvider" | Cross-type `chat.send` SHARED; free=send, ent=send+schedule. R=cross-type, T differs per account. | Engine: same provider 2 accounts. Router: accountId in ctx.

### Block 6 — Tier-gating edge cases [S51–S60]

- **S51** | ChatGPT(anonymous) | chat.streaming | WS "AnonStream" | Component resolves (cross-type) but `minPlanTier=free` blocks streaming → **component shown, streaming disabled**. R=cross-type, T=anonymous gated. | Engine: component renders, action disabled. Router: 403 on stream.
- **S52** | Claude(trial) | chat.export [pro-only cap] | WS "TrialExport" | Component resolves, but `cap:export` minPlanTier=pro → hidden for trial. R=cross-type, T=trial → cap hidden. | Engine: cap hidden. Router: cap not in action set.
- **S53** | Gmail(enterprise) | chat.attach | WS "EntLarge" | Component + `CapabilityTier` ent override raises maxFileSize → large attach enabled. R=cross-type/family, T=ent override. | Engine: ent `CapabilityTier` applied. Router: `cap:attach:large` enabled.
- **S54** | ChatGPT(free→pro upgrade live) | chat.streaming | WS "Upgrade" | Mid-session tier change: component stays cross-type, pro export appears after upgrade. R=cross-type, T transitions free→pro. | Engine: re-resolve on tier change. Router: WS push of new action set.
- **S55** | Slack(free) | chat.actionBar [ent-only admin action] | WS "FreeAdmin" | ActionBar renders, but "Admin" action minPlanTier=ent → hidden for free. R=family, T=free gated. | Engine: action gated. Router: action absent.
- **S56** | Twitter(free) | chat.composer [char limit 280] | WS "TwitterLimit" | Provider composer enforces 280 via `CapabilityTier` customConfigJson. R=provider, T=free config. | Engine: provider config limit. Router: config in payload.
- **S57** | ChatGPT(enterprise) | chat.result [ent-only "save to workspace"] | WS "EntSave" | Result component + ent action "save to workspace". R=cross-type, T=ent override. | Engine: ent action shown. Router: ent cap enabled.
- **S58** | LinkedIn(trial) | chat.attach [trial=1 file] | WS "Trial1File" | Trial tier customConfig maxOptions=1. R=provider, T=trial. | Engine: trial limit. Router: limit in payload.
- **S59** | anonymous | chat.confirm | WS "AnonConfirm" | Confirm component cross-type but all mutating caps gated → confirm shows but disabled. R=cross-type, T=anonymous. | Engine: confirm disabled. Router: 403 on confirm.
- **S60** | ChatGPT(pro) but capability `minPlanTier` row missing | chat.send | WS "NoMin" | No minPlanTier → defaults free → send enabled for pro. R=cross-type, T=pro (no gate). | Engine: missing tier → free default. Router: enabled.

### Block 7 — Missing-component fallbacks (system default) [S61–S70]

- **S61** | BrandNewProvider(free) [no rows at all] | chat.composer | WS "NewProv" | No provider/family/cross-type → **system built-in default** composer. R=system. | Engine: system fallback. Router: `fromSystemDefault=true`.
- **S62** | NewFamilyProvider(free) [family+cross-type missing] | chat.thread | WS "NewFam" | No family, no cross-type → system default thread. R=system. | Engine: system default. Router: system tier.
- **S63** | ChatGPT(free) [provider override deleted] | chat.composer | WS "DelOverride" | Provider row deleted → falls to family `ai-chat.chat.composer`. R=family. | Engine: deleted leaf → walk up. Router: family tier.
- **S64** | Gmail(free) [family+provider deleted] | chat.send | WS "DelBoth" | Both deleted → cross-type `chat.send`. R=cross-type. | Engine: walk to cross-type. Router: cross-type.
- **S65** | Twitter(free) [everything deleted] | chat.composer | WS "DelAll" | All deleted → system default. R=system. | Engine: system fallback. Router: system.
- **S66** | ChatGPT(free) [provider row deprecated status] | chat.bubble | WS "Deprecated" | Status='deprecated' → skip, use family. R=family (deprecated skipped). | Engine: skip deprecated. Router: family tier.
- **S67** | Claude(free) [provider draft only] | chat.streaming | WS "Draft" | Draft (not published) → skip → family. R=family (draft skipped). | Engine: skip draft. Router: family.
- **S68** | Gmail(enterprise) [provider published, family deprecated] | chat.attach | WS "MixedStatus" | Provider published → use it (family deprecated irrelevant). R=provider. | Engine: published leaf wins. Router: provider.
- **S69** | NewProvider(free) [cross-type missing, system exists] | chat.header | WS "SysOnly" | Cross-type missing → system default header. R=system. | Engine: system. Router: system.
- **S70** | ChatGPT(free) [provider returns null component] | chat.send | WS "NullComp" | Resolver returns null → system default. R=system. | Engine: null → system. Router: system fallback.

### Block 8 — Workspace-specific remixes (same global UI, different combos) [S71–S80]

- **S71** | WS-A: ChatGPT(free) | chat.composer | WS-A | Cross-type composer, free actions. | Engine: WS-A ctx. Router: WS-A layout.
- **S72** | WS-B: ChatGPT(pro)+Claude(ent) [same composer as WS-A] | chat.composer | WS-B | SAME cross-type `chat.composer` but pro+ent actions appear. R=cross-type, T differs. | Engine: shared component, WS-B tier ctx. Router: WS-B action set.
- **S73** | WS-C: Gmail(free)+Twitter(free) [reuse chat.send] | chat.send | WS-C | Same cross-type `chat.send` reused in WS-C with different providers. R=cross-type. | Engine: component reused across WS. Router: WS-C instances.
- **S74** | WS-D: Slack(ent)+Discord(ent)+Telegram(free) | chat.sidebar | WS-D | Family `messenger.chat.sidebar` reused; ent actions for Slack/Discord. R=family, T mixed. | Engine: family shared, WS-D tiers. Router: WS-D.
- **S75** | WS-E: Notion(free)+Linear(free) [custom family reuse] | chat.entry | WS-E | Provider entries Notion/Linear; same global entry host. R=mixed. | Engine: WS-E remix. Router: WS-E.
- **S76** | WS-F: ChatGPT(free)+ChatGPT(ent) [dup provider, 2 WS] | chat.streaming | WS-F | Same provider 2 tiers in WS-F; ent sees export. R=cross-type, T per acct. | Engine: WS-F multi-account. Router: WS-F.
- **S77** | WS-G: empty (no providers) | chat.composer | WS-G | No providers → system default composer, disabled (no account). R=system, T=none. | Engine: empty WS. Router: system, disabled.
- **S78** | WS-H: 10 providers mixed families all free | chat.header | WS-H | Cross-type header SHARED across 10. R=cross-type x10. | Engine: 10 instances 1 component. Router: x10 spawn.
- **S79** | WS-I: switch from WS-A to WS-B live | chat.composer | WS-A→WS-B | Live switch: same component, action set updates via WS. R=cross-type, T transitions. | Engine: WS switch re-resolve. Router: WS push new actions.
- **S80** | WS-J: ChatGPT(pro) in WS-J AND Gmail(pro) in WS-J | chat.attach | WS-J | Both pro → both see large attach (cross-type + pro tier). R=cross-type, T=pro x2. | Engine: WS-J shared tier. Router: WS-J.

### Block 9 — Conflict & collision resolution [S81–S90]

- **S81** | ChatGPT(free)+Claude(free) both claim chat.entry host | chat.entry | WS "Collide" | Both resolve family `ai-chat.chat.entry` → single host, two panes. R=family (no collision, shared host). | Engine: shared host, multi-pane. Router: `cap:canvas:spawn` panes.
- **S82** | Gmail(free)+Outlook(free) both provider-override chat.send | chat.send | WS "Collide2" | Two provider leaves → two send buttons (one per provider). R=provider x2. | Engine: two leaves coexist. Router: two components.
- **S83** | ChatGPT(free)+Gmail(free) both want chat.header slot | chat.header | WS "HeaderCollide" | Cross-type shared → one header, provider name switches by active provider. R=cross-type. | Engine: one header, context switch. Router: `uiSlots` context.
- **S84** | Slack(ent)+Discord(free) both family messenger actionBar | chat.actionBar | WS "BarCollide" | Family shared + ent action only for Slack. R=family, T mixed. | Engine: shared bar, ent action scoped to Slack. Router: per-account action.
- **S85** | Two providers same family, one has provider override, other doesn't | chat.bubble | WS "Asym" | One uses provider leaf, other uses family. R=mixed (provider + family). | Engine: asymmetric resolution. Router: mixed tiers.
- **S86** | ChatGPT(free)+ChatGPT(ent) same WS, both resolve chat.send | chat.send | WS "DupProv" | Two accounts same provider → two send instances, different tiers. R=cross-type, T per acct. | Engine: per-account instances. Router: accountId ctx.
- **S87** | Provider A override chat.composer + Provider B cross-type | chat.composer | WS "MixedOverride" | A=provider leaf, B=cross-type → different components in same WS. R=mixed. | Engine: mixed. Router: mixed.
- **S88** | 3 providers all provider-override same slot | chat.streaming | WS "3Override" | 3 provider leaves → 3 different streaming UIs. R=provider x3. | Engine: 3 leaves. Router: 3 components.
- **S89** | Provider override + variant override same slot | chat.composer | WS "VarConflict" | Variant (more specific) wins over provider base. R=provider+variant. | Engine: variant precedence. Router: variant.
- **S90** | All 5 families in one WS, chat.header | chat.header | WS "AllFam" | Cross-type shared across all 5 families → one header. R=cross-type. | Engine: cross-type universal. Router: cross-type.

### Block 10 — Generator stress / adversarial [S91–S100]

- **S91** | 50 providers all free, all cross-type | chat.send | WS "Stress50" | 50 instances, 1 component. R=cross-type x50. | Engine: must virtualize (W2 QuadTree). Router: x50 spawn batch.
- **S92** | Provider with INVALID scriptUrl (malicious) | chat.composer | WS "Malicious" | Sandbox rejects inline; scriptUrl CSP-blocks. R=provider but **sandbox denies**. | Engine: CSP blocks. Router: sandbox policy enforced.
- **S93** | Provider row with `allowInlineScript:true` attempted | chat.composer | WS "InlineAttempt" | P8 invariant: forced false. R=provider, sandbox override ignored. | Engine: invariant enforced. Router: `allowInlineScript:false` hardcoded.
- **S94** | Capability with no UiComponent anywhere + no system default | chat.unknown | WS "NoComp" | Resolver returns null → render nothing / placeholder. R=none. | Engine: graceful null. Router: 404 component.
- **S95** | Provider family mismatch (provider.familyId points to wrong family) | chat.thread | WS "Mismatch" | Resolver uses provider.familyId → resolves family component of linked family. R=family (linked). | Engine: resolve via FK. Router: FK-based resolution.
- **S96** | Two workspaces same provider different tiers simultaneously | chat.streaming | WS-A(free)+WS-B(ent) | Same provider, WS-A free, WS-B ent → different action sets per WS. R=cross-type, T per WS. | Engine: WS-scoped tier. Router: WS ctx.
- **S97** | Provider deleted mid-session | chat.composer | WS "DelMid" | Live: component removed → re-resolve to family/cross-type. R transitions provider→family. | Engine: live re-resolve. Router: WS push.
- **S98** | Variant string with special chars / unicode | chat.composer | WS "UniVar" | Variant `café-ñ` → resolver matches exactly (no normalization). R=provider+variant. | Engine: exact match. Router: exact variant key.
- **S99** | All 13 slots resolved for 5 providers mixed tiers | all 13 | WS "FullMatrix" | Each slot resolves per (provider, tier) → full matrix. R=mixed across 13×5. | Engine: full matrix resolve. Router: `resolveSurface` returns 13 slots × 5.
- **S100** | Empty DB (fresh migrate, no seed) | chat.composer | WS "EmptyDB" | No rows → all system defaults, all disabled (no accounts). R=system x13, T=none. | Engine: system-only boot. Router: system defaults, disabled.

---

## PART D — WHAT THE GENERATOR MUST EMIT

For the engine + router to satisfy S01–S100, the generated artifacts are:

1. **`ConceptualModelService.resolveSurface(providerIds[], familyIds[], accountTiers[], workspaceId)`** — multi-provider, multi-tier, workspace-scoped resolution returning `ResolvedSlot[]` per provider, each with `{ primitive, component, tier, fromSystemDefault, accountTier, actions }`.
2. **`UiComponentStore.resolve(ctx)`** — 6-level tree walk (system→cross-type→family→family+variant→provider→provider+variant) with status filtering (skip draft/deprecated) and exact variant match.
3. **`CapabilityGating.resolveActions(capabilityId, planTier)`** — applies `minPlanTier` + `CapabilityTier` overrides to produce the visible/enabled action set.
4. **`WorkspaceResolver.getLayout(workspaceId)`** — returns per-workspace `UserComponentLayout` + which global components are reused vs overridden.
5. **Routers**: `cap:conceptual:surface` (multi-provider), `cap:canvas:spawn` (batch instances), `cap:canvas:mutate` (per-account actions), `cap:conversation:stream_blocks` (tiered), `registerCanvasLayerForwarder` (live WS re-resolve on tier/account/provider change).
6. **Sandbox enforcement** (P8): `allowInlineScript:false` forced; CSP from `SandboxPolicy`; variant keys exact-match.

The 100 scenarios are the **acceptance matrix** — every one must pass `bun run devops verify-cross-surface` and the resolution engine unit tests.



# ═══════════════════════════════════════════════════════════════
# PART FILE: 12-routing-logging-algorithm.md
# ═══════════════════════════════════════════════════════════════

# DOC 12 — SYNCHRONOUS ROUTING + LOGGING COUPLING/DECOUPLING ALGORITHM

> Companion to DOC 11 (100 scenarios). This defines the **routing algorithm** (how a request for any provider×component×tier×workspace resolves synchronously and fans out), the **logging/coupling model** (what is tightly coupled by `traceId` and what is decoupled by the event bus), and proves both against the 100 scenarios as a validation matrix. Grounded in the real `CapabilityEventBus`, `TraceEntry`, and `StructuredLogger` already in `src/`.

---

## PART A — PRIMITIVES (from the real codebase)

| Primitive | Source | Role in algorithm |
|---|---|---|
| `CapabilityEventBus` | `src/engines/capability-event-bus.ts` | In-process pub/sub + WS forwarder. The **decoupling** backbone. |
| `traceId` (ULID) | `src/ids.ts`, `src/engines/capability.ts` | Correlation key. The **coupling** backbone (synchronous request↔response↔log). |
| `TraceEntry` | `prisma/schema.prisma:422` | Structured, queryable log row (engine, method, providerId, accountId, conversationId, durationMs, ok, error). |
| `StructuredLogger` | `src/engines/logger.ts` | Emits `TraceEntry`-shaped spans. |
| `CanvasLayerMounter` | `src/engines/canvas-layer-mounter.ts` | Emits `canvas:layer:spawned/dismissed` — the live coupling point to the frontend. |
| Governor Canon | AGENTS.md | Engines **emit only**; they never touch DOM/CDP. Decoupling guarantee. |

**Core law:** *Synchronous path is coupled by `traceId`; asynchronous fan-out is decoupled by the event bus.* A request must return a resolved answer on the calling thread (synchronous routing), while side-effects (spawn UI, stream, log, notify WS) are emitted as events and resolved independently.

---

## PART B — THE SYNCHRONOUS ROUTING ALGORITHM

### B.1 Request envelope

Every canvas/conceptual request carries a **Resolution Context**:

```ts
interface RouteContext {
  traceId: string                 // ULID, generated at entry
  workspaceId: string
  providerIds: string[]           // 1..N (multi-provider WS, S41–S50)
  accountIds: string[]            // 1..N (multi-account, S09/S50/S86)
  slotIds: string[]               // 1..13 (which components, S99)
  userId: string
}
```

### B.2 Algorithm: `routeSync(ctx)` — returns resolved surface in ONE pass

```
routeSync(ctx: RouteContext): ResolvedSurface
  ╭─ COUPLED PHASE (synchronous, single traceId) ─╮
  1. span = logger.start(ctx.traceId, 'route:sync', { workspaceId, providers: ctx.providerIds })
  2. familyMap = ConceptualModelService.resolveFamilies(ctx.providerIds)   // FK walk (S95)
  3. slots = []
  4. for each providerId in ctx.providerIds:
  5.    for each slotId in ctx.slotIds:
  6.       accountTier = AccountStore.tierFor(ctx.accountIds, providerId)  // S09/S50/S86
  7.       comp = UiComponentStore.resolve({
  8.         primitiveId: slotToPrimitive(slotId),   // chat.send → prim:ai-chat:send (DOC 5.5)
  9.         scopeChain: ['provider+variant','provider','family+variant','family','cross-type','system'],
 10.         ownerId: providerId, familyId: familyMap[providerId], variant: ctx.variant,
 11.         statusFilter: skip 'draft'|'deprecated'   // S66/S67/S68
 12.       })                                          // 6-LEVEL TREE WALK (DOC 11 Part A.2)
 13.       actions = CapabilityGating.resolveActions(comp.capabilityId, accountTier) // S51–S60
 14.       slots.push({ providerId, slotId, component: comp, tier: comp.tier,
 15.                     fromSystemDefault: comp.tier==='system', accountTier, actions })
 16.  surface = assembleWorkspace(ctx.workspaceId, slots)   // S71–S80 reuse logic
 17. logger.end(span, { slotCount: slots.length, ok: true })
 18. return surface
  ╰─────────────────────────────────────────────────╯
  ╭─ DECOUPLED PHASE (async emit, NOT awaited) ─╮
 19. eventBus.emit({ type:'canvas:surface:resolved', traceId: ctx.traceId,
 20.                  workspaceId, surface })        // fans out to WS subscribers
 21. return surface                                 // caller gets answer NOW (sync)
```

**Why synchronous:** The HTTP router (`cap:conceptual:surface`) and the React `useConceptualModel` hook need the full resolved surface *before* rendering — they block on `routeSync`. The 100 scenarios all require a deterministic answer *in the response* (S01 returns the same componentKey for 4 providers; S40 returns the deepest tier; S61 returns system default). Awaiting the event bus would break this.

**Why decoupled:** Spawning the actual DOM nodes, streaming, logging to `TraceEntry`, and notifying other browser tabs happen via `emit` and do **not** block the return.

### B.3 The 6-level tree-walk (coupled, deterministic)

```
resolve(ctx): UiComponent | null
  for level in [provider+variant, provider, family+variant, family, cross-type, system]:
    row = store.find({ primitiveId, scope:level.scope, ownerId:level.owner,
                       variant: ctx.variant ?? null })
    if row && row.status === 'published':
      return row                      // FIRST HIT WINS (S30, S40, S89)
  return null → caller uses system fallback (S61–S70)
```
- Exact variant match only (S98 unicode). No normalization.
- `null` component → system default, `fromSystemDefault=true` (S70, S94).

### B.4 Tier-gating (coupled, second phase)

```
resolveActions(capabilityId, tier):
  cap = CapabilityTaxonomy.find(capabilityId)
  if tier < cap.minPlanTier: return []            // S10, S51, S52, S59 hidden
  tierRow = CapabilityTier.find(capabilityId, tier)
  return tierRow?.uiComponentOverride ?? cap.baseActions   // S53, S56, S57 overrides
```

---

## PART C — LOGGING: COUPLING & DECOUPLING MODEL

### C.1 What is COUPLED (by `traceId`)

The synchronous request→resolution→response→persist chain shares ONE `traceId`. This makes any scenario **auditable end-to-end**:

```
traceId=T
  ├─ route:sync (logger.start, span A)
  ├─ conceptual:resolveFamily (span B, parent=T)
  ├─ uiComponent:resolve x N (span C.., parent=T)   ← one per (provider,slot)
  ├─ capability:gate x N (span D.., parent=T)
  ├─ route:sync (logger.end, span A)
  └─ TraceEntry rows all carry traceId=T, providerId, accountId, conversationId
```

Coupling by `traceId` is **mandatory** for: S54 (live tier upgrade must re-resolve under same conversation), S79 (WS switch re-resolve same user), S97 (provider deleted mid-session — must correlate old+new resolution), S100 (empty DB boot — all system defaults under one trace).

### C.2 What is DECOUPLED (by event bus)

Side-effects do NOT share the request's synchronous lifetime. They are emitted and forgotten:

| Event | Emitted by | Consumed by (decoupled) | Scenarios |
|---|---|---|---|
| `canvas:surface:resolved` | routeSync (B.2:19) | WS forwarder → other browser tabs | S79, S96 |
| `canvas:layer:spawned` | CanvasLayerMounter | `useCanvasEvents` frontend | S41, S78, S91 |
| `canvas:layer:dismissed` | CanvasLayerMounter | `useCanvasEvents` frontend | S97 |
| `capability:actions:changed` | CapabilityGating on tier change | `useCanvasEvents` → re-render actionBar | S54, S96 |
| `workspace:reresolved` | WorkspaceResolver on provider add | `useConceptualModel` → toNodes() | S71–S80 |
| `sandbox:denied` | SandboxedLayer CSP check | error tracker | S92, S93 |

Decoupling guarantee = **Governor Canon**: emitters never await consumers; consumers never block emitters. The frontend can be closed and the backend still returns `routeSync` correctly (S77 empty WS, S100).

### C.3 The coupling/decoupling boundary rule

```
RULE: A handler may ONLY mutate state it owns. Cross-boundary effects = emit, never call.
  ✓ ConceptualModelService resolves → emits canvas:surface:resolved (does NOT call frontend)
  ✓ CapabilityGating changes tier → emits capability:actions:changed (does NOT patch DOM)
  ✗ Engine importing SandboxedLayer / React Flow = VIOLATION (S92/S93 safety depends on this)
```

This is exactly why S92 (malicious scriptUrl) and S93 (inline script attempt) are safe: the engine that *resolves* the component is decoupled from the *renderer* that *enforces* the sandbox. The resolver emits; the renderer (frontend, sandboxed) enforces `allowInlineScript:false`.

---

## PART D — THE DECOUPLING/RE-COUPLING ALGORITHM (live updates)

When context changes (tier upgrade, provider added, workspace switched), we **re-couple** a new synchronous pass under a *new* `traceId` but emit a delta so the frontend **decouples** the heavy re-resolve:

```
onContextChange(change: TierChange|ProviderAdded|WorkspaceSwitch, ctx):
  newTrace = ulid()
  surface' = routeSync({ ...ctx, traceId: newTrace })   // COUPLED re-resolve (sync)
  delta = diff(surface_prev, surface')                  // compute minimal diff
  eventBus.emit({ type:'workspace:reresolved', traceId:newTrace,
                  workspaceId, delta })                  // DECOUPLED fan-out
  // frontend applies delta only (no full re-mount) → S54/S79/S96/S97 smooth
```

This satisfies: S54 (pro upgrade → export appears), S79 (WS-A→WS-B switch → action set updates), S96 (same provider different tier per WS), S97 (provider deleted → re-resolve to family).

---

## PART E — VALIDATION MATRIX (100 scenarios → algorithm clauses)

> Each scenario maps to the clause(s) that prove the algorithm handles it. ✅ = covered.

| # | Scenario | Clause(s) | ✅ |
|---|---|---|---|
| S01 | 4 providers cross-type shared | B.3 cross-type hit, B.2 loop | ✅ |
| S02 | mixed tier same component | B.4 per-account tier, C.1 traceId | ✅ |
| S03 | cross-family thread shared | B.3 cross-type, B.1 familyMap | ✅ |
| S04 | ent/free attach | B.4 CapabilityTier override | ✅ |
| S05 | trial watermark | B.4 tierRow customConfig | ✅ |
| S06 | 3 email header shared | B.3 cross-type (header no family override) | ✅ |
| S07 | social actionBar shared | B.3 cross-type | ✅ |
| S08 | custom entry shared | B.3 cross-type | ✅ |
| S09 | same provider 2 tiers | B.2:6 accountTier per account | ✅ |
| S10 | anonymous gated off | B.4 tier < minPlanTier → [] | ✅ |
| S11–S20 | family shared overrides | B.3 family level wins over cross-type | ✅ |
| S21–S30 | provider overrides | B.3 provider level, leaf beats family (S30) | ✅ |
| S31–S33 | provider+variant | B.3 provider+variant deepest | ✅ |
| S34–S35 | family+variant | B.3 family+variant | ✅ |
| S36–S39 | variant fallthrough | B.3 walk-up on miss | ✅ |
| S40 | deepest wins | B.3 first-hit | ✅ |
| S41–S50 | multi-provider WS remix | B.2 loop ×N providers, B.1 | ✅ |
| S51–S60 | tier gating edges | B.4 minPlanTier + CapabilityTier | ✅ |
| S61–S70 | missing → system default | B.3 null → system, statusFilter skip | ✅ |
| S71–S80 | workspace remix reuse | B.2 assembleWorkspace, D re-couple | ✅ |
| S81–S90 | conflict/collision | B.2 multi-instance, B.3 asymmetric | ✅ |
| S91 | 50 providers stress | B.2 loop ×50 + QuadTree (W2) decoupled render | ✅ |
| S92 | malicious scriptUrl | C.3 decoupled renderer enforces CSP | ✅ |
| S93 | inline script attempt | C.3 allowInlineScript forced false | ✅ |
| S94 | no component anywhere | B.3 null → placeholder (C.2 sandbox:denied) | ✅ |
| S95 | family FK mismatch | B.1 resolveFamilies via FK | ✅ |
| S96 | same provider diff tier per WS | D re-couple per WS ctx | ✅ |
| S97 | provider deleted mid-session | D re-resolve, C.1 traceId correlation | ✅ |
| S98 | unicode variant exact | B.3 exact match, no normalize | ✅ |
| S99 | full 13×5 matrix | B.2 nested loop | ✅ |
| S100 | empty DB boot | B.3 all system, B.4 all gated | ✅ |

**All 100 ✅.** The algorithm is necessary and sufficient for the acceptance matrix.

---

## PART F — PSEUDOCODE: THE FULL ROUTER HANDLER

```ts
// src/server/conceptual-router.ts — cap:conceptual:surface
async function handleSurface(req: SurfaceRequest): Promise<ResolvedSurface> {
  const traceId = ulid()                                   // C.1 coupling key
  const ctx: RouteContext = {
    traceId, workspaceId: req.workspaceId,
    providerIds: req.providerIds, accountIds: req.accountIds,
    slotIds: req.slotIds ?? ALL_SLOTS, userId: req.userId,
  }
  const surface = routeSync(ctx)                           // B.2 SYNCHRONOUS return
  // DECOUPLED fan-out (fire-and-forget):
  eventBus.emit({ type: 'canvas:surface:resolved', traceId, ...surface })
  return surface                                           // caller blocked only on B.2
}

// Real-time context change (tier/provider/WS):
eventBus.on('account:tier:changed', (e) => onContextChange(e, currentCtx))  // D
eventBus.on('provider:added',      (e) => onContextChange(e, currentCtx))  // D
```

---

## PART G — INVARIANTS THE ALGORITHM PRESERVES

1. **Synchronous return** — `routeSync` never awaits the event bus (B.2:21 return before emit completes conceptually; emit is non-blocking).
2. **traceId coupling** — every `TraceEntry` in a request shares `traceId` (C.1).
3. **Event-bus decoupling** — emitters never import consumers; Governor Canon (C.3).
4. **Sandbox safety** — resolver (backend) decoupled from renderer (frontend); P8 enforced at render (S92/S93).
5. **Determinism** — same `ctx` → same surface (B.3 first-hit, exact variant). Required for S40/S89/S98.
6. **No new migrations** — algorithm uses existing `ui_component`/`capability_tier`/`trace_entry` tables (DOC 2.5).

---

## PART H — WHAT TO GENERATE (engine + router artifacts)

1. `RouteSynth` engine: `routeSync(ctx)`, `resolve(ctx)` (6-level walk), `resolveActions(cap, tier)`.
2. `WorkspaceResolver`: `assembleWorkspace`, `onContextChange` (Part D).
3. Router `cap:conceptual:surface` (sync return + emit).
4. Router `cap:canvas:spawn` (batch, decoupled via CanvasLayerMounter).
5. `registerCanvasLayerForwarder` + `capability:actions:changed` forwarder (C.2).
6. `StructuredLogger` span wrappers keyed by `traceId` (C.1).
7. Unit tests: one per scenario block (S01–S100) asserting resolved tier + action set + traceId propagation.


