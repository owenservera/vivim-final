// seeds/capabilities/taxonomy-slack.ts
// 10 Slack taxonomy entries for ProviderCapabilityTaxonomy.

import { ulid } from 'ulidx'

export const SLACK_CAPABILITY_TAXONOMY = [
  { platformCategory: 'social_messaging', interactionPattern: 'chat', caps: ['send_message', 'edit_message', 'delete_message', 'send_dm'] },
  { platformCategory: 'social_messaging', interactionPattern: 'react', caps: ['add_reaction', 'remove_reaction'] },
  { platformCategory: 'social_messaging', interactionPattern: 'thread', caps: ['create_thread', 'read_threads', 'reply_thread'] },
  { platformCategory: 'social_feed', interactionPattern: 'feed', caps: ['read_channels', 'read_channel_history', 'read_pinned'] },
  { platformCategory: 'social_feed', interactionPattern: 'mixed', caps: ['read_users', 'read_user_presence', 'read_user_profile'] },
  { platformCategory: 'productivity', interactionPattern: 'mixed', caps: ['manage_channels', 'manage_members', 'manage_workspace', 'upload_file', 'search_messages'] },
  { platformCategory: 'social_messaging', interactionPattern: 'send', caps: ['slash_command', 'open_modal', 'send_blocks'] },
  { platformCategory: 'social_messaging', interactionPattern: 'receive', caps: ['read_attachments', 'read_reactions', 'read_bookmarks'] },
  { platformCategory: 'productivity', interactionPattern: 'feed', caps: ['read_scheduled_messages', 'create_scheduled_message'] },
  { platformCategory: 'social_messaging', interactionPattern: 'thread', caps: ['read_thread_replies', 'set_topic', 'set_purpose'] },
].map(c => ({
  id: ulid(),
  providerId: 'slack',
  platformCategory: c.platformCategory,
  interactionPattern: c.interactionPattern,
  messageTypesJson: JSON.stringify(c.caps),
  capabilitiesJson: JSON.stringify(c.caps.map(cap => ({ slug: cap, type: 'action', authScope: 'user', description: cap.replace(/_/g, ' ') }))),
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
