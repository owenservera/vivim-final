// seeds/capabilities/taxonomy-discord.ts
// 10 Discord taxonomy entries for ProviderCapabilityTaxonomy.
// Unique on (providerId, platformCategory, interactionPattern).

import { ulid } from 'ulidx'

export const DISCORD_CAPABILITY_TAXONOMY = [
  {
    platformCategory: 'social_messaging',
    interactionPattern: 'chat',
    caps: ['send_message', 'edit_message', 'delete_message', 'send_dm', 'read_dm'],
  },
  {
    platformCategory: 'social_messaging',
    interactionPattern: 'react',
    caps: ['send_reaction', 'remove_reaction'],
  },
  {
    platformCategory: 'social_messaging',
    interactionPattern: 'thread',
    caps: ['create_thread', 'read_threads', 'archive_thread'],
  },
  {
    platformCategory: 'social_feed',
    interactionPattern: 'feed',
    caps: ['read_messages', 'read_announcements', 'read_pinned'],
  },
  {
    platformCategory: 'social_feed',
    interactionPattern: 'mixed',
    caps: ['voice_connect', 'voice_disconnect', 'screen_share'],
  },
  {
    platformCategory: 'productivity',
    interactionPattern: 'mixed',
    caps: ['manage_roles', 'manage_channels', 'manage_server', 'kick_member', 'ban_member'],
  },
  {
    platformCategory: 'social_feed',
    interactionPattern: 'feed',
    caps: ['read_members', 'read_member_count', 'read_presence'],
  },
  {
    platformCategory: 'social_messaging',
    interactionPattern: 'send',
    caps: ['slash_command', 'context_menu_command'],
  },
  {
    platformCategory: 'social_messaging',
    interactionPattern: 'receive',
    caps: ['read_attachments', 'read_embeds', 'read_polls'],
  },
  {
    platformCategory: 'social_feed',
    interactionPattern: 'thread',
    caps: ['read_forum_posts', 'create_forum_post', 'tag_forum_post'],
  },
].map((c) => ({
  id: ulid(),
  providerId: 'discord',
  platformCategory: c.platformCategory,
  interactionPattern: c.interactionPattern,
  messageTypesJson: JSON.stringify(c.caps),
  capabilitiesJson: JSON.stringify(
    c.caps.map((cap) => ({
      slug: cap,
      type: 'action',
      authScope: 'bot',
      description: cap.replace(/_/g, ' '),
    })),
  ),
  constraintsJson: '{}',
  authRequirementsJson: '[]',
  discoveryHintsJson: '{}',
  nlpEntityTypesJson: '[]',
  nlpIntentPatternsJson: '[]',
  entityHierarchyJson: '[]',
  syncCapabilitiesJson: '{}',
  seedDataVersion: 1,
  isActive: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}))
