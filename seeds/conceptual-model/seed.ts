// seeds/conceptual-model/seed.ts
// Idempotent seeder for the modular conceptual surface model.
// Populates: ProviderType (families) + Primitive (vocabulary) + UiComponent (code nodes).
// Grounded in docs/vivim-canvas/implementation/10-conceptual-matrix.md.
//
// Run standalone:  bun run src/engines/... (or via server boot)
// This module is DB-driven and additive: re-running upserts without duplication.

import type { PrimitiveScope } from 'shared/conceptual-model.js'
import type { UiComponentScope } from 'shared/ui-component.js'
import { newId } from '../../src/ids.js'
import { UiComponentInputSchema } from '../../src/schema/conceptual-model.js'
import type { CapStoreDb } from '../../src/storage/db.js'
import { PrimitiveStoreImpl } from '../../src/storage/impl/primitive-store-impl.js'
import { ProviderTypeStoreImpl } from '../../src/storage/impl/provider-type-store-impl.js'
import { UiComponentStoreImpl } from '../../src/storage/impl/ui-component-store-impl.js'

const FAMILIES = [
  {
    slug: 'ai-chat',
    displayName: 'AI Chat Webapp',
    description: 'Composer + transcript thread + bubbles',
    base: 'conversations',
  },
  {
    slug: 'email',
    displayName: 'Email',
    description: 'Folder list + message list + reader + compose',
    base: 'mailbox',
  },
  {
    slug: 'messenger',
    displayName: 'Messengers',
    description: 'Conversation list + chat + bubbles',
    base: 'conversations',
  },
  {
    slug: 'social',
    displayName: 'Social',
    description: 'Feed + post cards + composer + reactions',
    base: 'feed',
  },
] as const

// Cross-type vocabulary — reused by many families (matrix §2 Level A).
const CROSS_TYPE: Array<{ id: string; label: string; desc: string }> = [
  {
    id: 'message-bubble',
    label: 'Message Bubble',
    desc: 'One message card from one sender. Shared across chat/messenger/social.',
  },
  { id: 'attach-doc', label: 'Attach Doc', desc: 'Attach file/image/doc before sending.' },
  { id: 'composer', label: 'Composer', desc: 'Text-entry surface that produces a message/post.' },
  { id: 'send-action', label: 'Send Action', desc: 'Commit composed content.' },
  { id: 'thread', label: 'Thread / Conversation List', desc: 'Scroll region of past messages.' },
  {
    id: 'sender-identity',
    label: 'Sender Identity',
    desc: 'Who is "me" (account switcher / avatar).',
  },
  { id: 'search', label: 'Search', desc: 'Find within the surface.' },
  { id: 'notification', label: 'Notification', desc: 'Toast / badge surface.' },
  { id: 'settings', label: 'Settings', desc: 'Gear / preferences entry.' },
  { id: 'error-surface', label: 'Error Surface', desc: 'Error / empty / blocked state.' },
]

// Per-family globals (matrix §2 Level B).
const FAMILY_GLOBALS: Record<string, Array<{ id: string; label: string; desc: string }>> = {
  'ai-chat': [
    { id: 'prompt-box', label: 'Prompt Box', desc: 'Composer variant for AI chat.' },
    { id: 'response-bubble', label: 'Response Bubble', desc: 'Assistant message bubble.' },
    { id: 'user-bubble', label: 'User Bubble', desc: 'User message bubble.' },
    { id: 'model-switcher', label: 'Model Switcher', desc: 'Pick the underlying model.' },
    { id: 'new-chat', label: 'New Chat', desc: 'Start a fresh conversation.' },
    {
      id: 'chat-history-sidebar',
      label: 'Chat History Sidebar',
      desc: 'List of past conversations.',
    },
    { id: 'streaming-indicator', label: 'Streaming Indicator', desc: 'Token streaming progress.' },
    { id: 'regenerate', label: 'Regenerate', desc: 'Re-run the last assistant turn.' },
    { id: 'copy-message', label: 'Copy Message', desc: 'Copy a message to clipboard.' },
    { id: 'branch', label: 'Branch', desc: 'Fork a conversation branch.' },
  ],
  email: [
    { id: 'folder-list', label: 'Folder List', desc: 'Inbox/sent/drafts.' },
    { id: 'message-list', label: 'Message List', desc: 'List of messages in a folder.' },
    { id: 'message-reader', label: 'Message Reader', desc: 'Read a single message.' },
    { id: 'compose-window', label: 'Compose Window', desc: 'Rich compose surface.' },
    { id: 'to-cc-bcc', label: 'To / Cc / Bcc', desc: 'Recipient fields.' },
    { id: 'send', label: 'Send', desc: 'Send email.' },
    { id: 'archive', label: 'Archive', desc: 'Archive a message.' },
    { id: 'label', label: 'Label', desc: 'Tag a message.' },
    { id: 'signature', label: 'Signature', desc: 'Auto signature.' },
    { id: 'draft-autosave', label: 'Draft Autosave', desc: 'Persist drafts.' },
  ],
  messenger: [
    { id: 'conversation-list', label: 'Conversation List', desc: 'List of chats.' },
    { id: 'chat-header', label: 'Chat Header', desc: 'Contact name/status.' },
    { id: 'message-bubble', label: 'Message Bubble', desc: 'One message bubble.' },
    { id: 'typing-indicator', label: 'Typing Indicator', desc: 'Peer is typing.' },
    { id: 'emoji-picker', label: 'Emoji Picker', desc: 'Insert emoji.' },
    { id: 'voice-note', label: 'Voice Note', desc: 'Send audio.' },
    { id: 'read-receipt', label: 'Read Receipt', desc: 'Seen state.' },
    { id: 'status-presence', label: 'Status / Presence', desc: 'Online/last-seen.' },
  ],
  social: [
    { id: 'feed', label: 'Feed', desc: 'Infinite scroll of posts.' },
    { id: 'post-card', label: 'Post Card', desc: 'One post in the feed.' },
    { id: 'composer', label: 'Composer', desc: 'Top-of-feed or modal composer.' },
    { id: 'like-react', label: 'Like / React', desc: 'Reaction control.' },
    { id: 'comment', label: 'Comment', desc: 'Comment on a post.' },
    { id: 'share', label: 'Share', desc: 'Share a post.' },
    { id: 'follow-button', label: 'Follow Button', desc: 'Follow/unfollow.' },
    { id: 'stories-tray', label: 'Stories Tray', desc: 'Stories rail.' },
    { id: 'profile-header', label: 'Profile Header', desc: 'User profile header.' },
  ],
}

const DEFAULT_REGION = { x: 0, y: 0, w: 320, h: 200 }

// Provider-specific primitives (plan §3: provider + variant component seeding).
const PROVIDER_PRIMITIVES: Array<{
  id: string
  label: string
  desc: string
  providerId: string
  familySlug: string
}> = [
  {
    id: 'canvas-viewer',
    label: 'Canvas Viewer',
    desc: 'ChatGPT canvas code viewer',
    providerId: 'chatgpt',
    familySlug: 'ai-chat',
  },
  {
    id: 'artifacts-viewer',
    label: 'Artifacts Viewer',
    desc: 'Claude artifacts viewer',
    providerId: 'claude',
    familySlug: 'ai-chat',
  },
  {
    id: 'inline-images',
    label: 'Inline Images',
    desc: 'Gemini inline image display',
    providerId: 'gemini',
    familySlug: 'ai-chat',
  },
  {
    id: 'model-picker',
    label: 'Model Picker',
    desc: 'Provider-specific model picker',
    providerId: 'chatgpt',
    familySlug: 'ai-chat',
  },
  {
    id: 'code-block-viewer',
    label: 'Code Block Viewer',
    desc: 'Code block with syntax highlighting',
    providerId: 'claude',
    familySlug: 'ai-chat',
  },
  {
    id: 'image-generator',
    label: 'Image Generator',
    desc: 'Gemini image generation surface',
    providerId: 'gemini',
    familySlug: 'ai-chat',
  },
]

export interface ConceptualSeedResult {
  families: number
  primitives: number
  components: number
}

export async function seedConceptualModel(db: CapStoreDb): Promise<ConceptualSeedResult> {
  const familyStore = new ProviderTypeStoreImpl(db)
  const primitiveStore = new PrimitiveStoreImpl(db)
  const componentStore = new UiComponentStoreImpl(db)

  let families = 0
  let primitives = 0
  let components = 0

  // ── 1. Families (ProviderType) ──────────────────────────────────────────
  const familyIds: Record<string, string> = {}
  const fam = (slug: string): string => {
    const id = familyIds[slug]
    if (!id) throw new Error(`Conceptual seed: family not seeded: ${slug}`)
    return id
  }
  for (const f of FAMILIES) {
    const existing = await familyStore.getBySlug(f.slug)
    const slotCatalog = (FAMILY_GLOBALS[f.slug] ?? []).map((g) => g.id)
    if (existing) {
      familyIds[f.slug] = existing.id
      continue
    }
    const row = await familyStore.create({
      id: newId(),
      slug: f.slug,
      displayName: f.displayName,
      description: f.description,
      slotCatalog,
      regionLayout: {},
      interactionGrammar: { basePrimitive: f.base, sendGesture: 'enter' },
      basePrimitive: f.base,
    })
    familyIds[f.slug] = row.id
    families++
  }

  // ── 2. Cross-type primitives ─────────────────────────────────────────────
  for (const p of CROSS_TYPE) {
    const id = `prim:cross:${p.id}`
    const existing = await primitiveStore.get(id)
    if (!existing) {
      await primitiveStore.create({
        id,
        scope: 'cross-type' as PrimitiveScope,
        label: p.label,
        description: p.desc,
        defaultRegion: DEFAULT_REGION,
      })
      primitives++
    }
  }

  // ── 3. Family-global primitives ──────────────────────────────────────────
  for (const [slug, list] of Object.entries(FAMILY_GLOBALS)) {
    const familyId = fam(slug)
    for (const p of list) {
      const id = `prim:${slug}:${p.id}`
      const existing = await primitiveStore.get(id)
      if (!existing) {
        await primitiveStore.create({
          id,
          scope: 'family' as PrimitiveScope,
          familyId,
          label: p.label,
          description: p.desc,
          defaultRegion: DEFAULT_REGION,
        })
        primitives++
      }
    }
  }

  // ── 3b. Provider-scoped primitives ───────────────────────────────────────
  for (const p of PROVIDER_PRIMITIVES) {
    const id = `prim:provider:${p.providerId}:${p.id}`
    const existing = await primitiveStore.get(id)
    if (!existing) {
      await primitiveStore.create({
        id,
        scope: 'provider' as PrimitiveScope,
        providerId: p.providerId,
        label: p.label,
        description: p.desc,
        defaultRegion: DEFAULT_REGION,
      })
      primitives++
    }
  }

  // ── 4. UiComponents (prove the 4-tier resolution) ────────────────────────
  const comp = (
    primitiveId: string,
    scope: UiComponentScope,
    ownerId: string,
    componentKey: string,
    displayName: string,
    html: string,
    variant?: string,
  ): {
    primitiveId: string
    scope: UiComponentScope
    ownerId: string
    componentKey: string
    displayName: string
    html: string
    variant?: string
  } => ({
    primitiveId,
    scope,
    ownerId,
    componentKey,
    displayName,
    html,
    variant,
  })

  const crossMessageBubble = comp(
    'prim:cross:message-bubble',
    'cross-type',
    'global',
    'message-bubble.base',
    'Base Message Bubble',
    '<div class="bubble">{{content}}</div>',
  )
  const crossComposer = comp(
    'prim:cross:composer',
    'cross-type',
    'global',
    'composer.base',
    'Base Composer',
    '<textarea class="composer"></textarea>',
  )
  // Spec 007 (FR-006): conversation-resilience error slot. Recovery strings are
  // DB-backed here; the UI slot falls back to engine/UI defaults if no tier is
  // resolved. Data attributes carry the per-kind messages for the resolver.
  const crossResilienceError = comp(
    'prim:cross:composer',
    'cross-type',
    'global',
    'resilience.error',
    'Conversation Resilience Error',
    [
      '<div class="resilience-error" role="alert"',
      ' data-chrome-crash="Chrome disconnected — your message was not sent. Click Retry to reconnect and resend."',
      ' data-cdp-down="Connection to Chrome dropped — click Retry to reconnect and resend."',
      ' data-session-expired="Your provider session expired — click to re-login."',
      ' data-circuit-open="Provider temporarily unavailable — waiting for recovery.">',
      '{{message}}</div>',
    ].join('\n'),
  )
  const aiChatComposer = comp(
    'prim:cross:composer',
    'family',
    fam('ai-chat'),
    'composer.ai-chat',
    'AI-Chat Composer',
    '<textarea class="composer ai-chat" placeholder="Send a message…"></textarea>',
  )
  const aiChatComposerGemini = comp(
    'prim:cross:composer',
    'family',
    fam('ai-chat'),
    'composer.ai-chat.gemini',
    'Gemini Composer (contenteditable)',
    '<div class="composer gemini" contenteditable="true"></div>',
    'gemini',
  )
  const aiChatPromptBox = comp(
    'prim:ai-chat:prompt-box',
    'family',
    fam('ai-chat'),
    'prompt-box.ai-chat',
    'AI-Chat Prompt Box',
    '<div class="prompt-box" contenteditable="true"></div>',
  )
  const aiChatResponseBubble = comp(
    'prim:ai-chat:response-bubble',
    'family',
    fam('ai-chat'),
    'response-bubble.ai-chat',
    'AI Response Bubble',
    '<div class="bubble assistant">{{content}}</div>',
  )

  const aiChatHeader = comp(
    'prim:ai-chat:chat-history-sidebar',
    'family',
    fam('ai-chat'),
    'chat-history-sidebar.ai-chat',
    'AI-Chat History Sidebar',
    '<div class="sidebar history">{{conversations}}</div>',
  )
  const aiChatThread = comp(
    'prim:ai-chat:response-bubble',
    'family',
    fam('ai-chat'),
    'thread.ai-chat',
    'AI-Chat Thread',
    '<div class="thread">{{messages}}</div>',
  )

  // ── email family ──────────────────────────────────────────────────────────
  const emailCompose = comp(
    'prim:cross:composer',
    'family',
    fam('email'),
    'composer.email',
    'Email Compose',
    '<div class="email-compose"><input class="to" placeholder="To" /><textarea class="body"></textarea></div>',
  )
  const emailMessageReader = comp(
    'prim:email:message-reader',
    'family',
    fam('email'),
    'message-reader.email',
    'Email Message Reader',
    '<div class="email-reader">{{body}}</div>',
  )
  const emailMessageList = comp(
    'prim:email:message-list',
    'family',
    fam('email'),
    'message-list.email',
    'Email Message List',
    '<ul class="email-list">{{messages}}</ul>',
  )
  const emailFolderList = comp(
    'prim:email:folder-list',
    'family',
    fam('email'),
    'folder-list.email',
    'Email Folder List',
    '<nav class="email-folders">{{folders}}</nav>',
  )

  // ── messenger family ────────────────────────────────────────────────────────
  const messengerComposer = comp(
    'prim:cross:composer',
    'family',
    fam('messenger'),
    'composer.messenger',
    'Messenger Composer',
    '<textarea class="messenger-composer" placeholder="Message…"></textarea>',
  )
  const messengerConversationList = comp(
    'prim:messenger:conversation-list',
    'family',
    fam('messenger'),
    'conversation-list.messenger',
    'Messenger Conversation List',
    '<ul class="conversation-list">{{chats}}</ul>',
  )
  const messengerMessageBubble = comp(
    'prim:messenger:message-bubble',
    'family',
    fam('messenger'),
    'message-bubble.messenger',
    'Messenger Message Bubble',
    '<div class="messenger-bubble">{{content}}</div>',
  )
  const messengerContactList = comp(
    'prim:messenger:conversation-list',
    'family',
    fam('messenger'),
    'contact-list.messenger',
    'Messenger Contact List',
    '<ul class="contact-list">{{contacts}}</ul>',
  )
  const messengerTypingIndicator = comp(
    'prim:messenger:typing-indicator',
    'family',
    fam('messenger'),
    'typing-indicator.messenger',
    'Messenger Typing Indicator',
    '<div class="typing-indicator"><span></span><span></span><span></span></div>',
  )

  // ── email family — additional components ─────────────────────────────────
  const emailAttachmentViewer = comp(
    'prim:email:message-reader',
    'family',
    fam('email'),
    'attachment-viewer.email',
    'Email Attachment Viewer',
    '<div class="email-attachments">{{attachments}}</div>',
  )
  const emailThreadList = comp(
    'prim:email:message-list',
    'family',
    fam('email'),
    'thread-list.email',
    'Email Thread List',
    '<ul class="email-thread-list">{{threads}}</ul>',
  )

  // ── Provider-specific components (variant: chatgpt, claude, gemini) ─────
  const chatgptCanvasViewer = comp(
    'prim:ai-chat:response-bubble',
    'provider',
    'chatgpt',
    'canvas-viewer.chatgpt',
    'ChatGPT Canvas Viewer',
    '<div class="chatgpt-canvas"><iframe class="canvas-frame"></iframe></div>',
    'chatgpt',
  )
  const chatgptModelPicker = comp(
    'prim:ai-chat:model-switcher',
    'provider',
    'chatgpt',
    'model-picker.chatgpt',
    'ChatGPT Model Picker',
    '<select class="model-picker chatgpt">{{models}}</select>',
    'chatgpt',
  )
  const claudeArtifactsViewer = comp(
    'prim:ai-chat:response-bubble',
    'provider',
    'claude',
    'artifacts-viewer.claude',
    'Claude Artifacts Viewer',
    '<div class="claude-artifacts"><pre><code>{{content}}</code></pre></div>',
    'claude',
  )
  const claudeCodeViewer = comp(
    'prim:ai-chat:response-bubble',
    'provider',
    'claude',
    'code-block-viewer.claude',
    'Claude Code Block Viewer',
    '<div class="claude-code-block"><pre class="language-{{lang}}"><code>{{code}}</code></pre></div>',
    'claude',
  )
  const geminiInlineImages = comp(
    'prim:ai-chat:response-bubble',
    'provider',
    'gemini',
    'inline-images.gemini',
    'Gemini Inline Images',
    '<div class="gemini-inline-images"><img src="{{url}}" alt="{{alt}}" /></div>',
    'gemini',
  )
  const geminiImageGenerator = comp(
    'prim:ai-chat:response-bubble',
    'provider',
    'gemini',
    'image-generator.gemini',
    'Gemini Image Generator',
    '<div class="gemini-image-gen"><img src="{{url}}" /><p>{{prompt}}</p></div>',
    'gemini',
  )

  // ── social family ─────────────────────────────────────────────────────────
  const socialComposer = comp(
    'prim:social:composer',
    'family',
    fam('social'),
    'composer.social',
    'Social Composer',
    '<div class="social-composer" contenteditable="true" placeholder="What’s happening?"></div>',
  )
  const socialFeed = comp(
    'prim:social:feed',
    'family',
    fam('social'),
    'feed.social',
    'Social Feed',
    '<div class="social-feed">{{posts}}</div>',
  )
  const socialPostCard = comp(
    'prim:social:post-card',
    'family',
    fam('social'),
    'post-card.social',
    'Social Post Card',
    '<article class="post-card">{{content}}</article>',
  )

  const allComponents = [
    crossMessageBubble,
    crossComposer,
    crossResilienceError,
    aiChatComposer,
    aiChatComposerGemini,
    aiChatPromptBox,
    aiChatResponseBubble,
    aiChatHeader,
    aiChatThread,
    emailCompose,
    emailMessageReader,
    emailMessageList,
    emailFolderList,
    emailAttachmentViewer,
    emailThreadList,
    messengerComposer,
    messengerConversationList,
    messengerMessageBubble,
    messengerContactList,
    messengerTypingIndicator,
    socialComposer,
    socialFeed,
    socialPostCard,
    // Provider-specific (variant-scoped)
    chatgptCanvasViewer,
    chatgptModelPicker,
    claudeArtifactsViewer,
    claudeCodeViewer,
    geminiInlineImages,
    geminiImageGenerator,
  ]

  for (const c of allComponents) {
    const id = `uc:${c.scope}:${c.ownerId}:${c.primitiveId}${c.variant ? `:${c.variant}` : ''}`
    const existing = await componentStore.get(id)
    if (!existing) {
      // Validate through Zod before persisting (contract enforcement)
      const input = UiComponentInputSchema.parse({
        id,
        primitiveId: c.primitiveId,
        scope: c.scope,
        ownerId: c.ownerId,
        variant: c.variant ?? null,
        componentKey: c.componentKey,
        displayName: c.displayName,
        html: c.html,
      })
      await componentStore.create({
        id,
        primitiveId: input.primitiveId,
        scope: input.scope,
        ownerId: input.ownerId,
        variant: input.variant,
        componentKey: input.componentKey,
        displayName: input.displayName,
        html: input.html,
        css: input.css,
        scriptUrl: input.scriptUrl,
        sandboxJson: JSON.stringify(input.sandbox),
        constraintsJson: JSON.stringify(input.constraints),
        contractJson: JSON.stringify(input.contract),
        archetype: input.archetype ?? null,
        version: input.version,
        status: input.status,
        author: input.author,
        defaultRegion: input.defaultRegion,
        tags: input.tags,
      })
      components++
    }
  }

  return { families, primitives, components }
}
