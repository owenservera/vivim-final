// seeds/capabilities/taxonomy-whatsapp.ts
// 10 WhatsApp taxonomy entries for ProviderCapabilityTaxonomy.

import { ulid } from 'ulidx'

export const WHATSAPP_CAPABILITY_TAXONOMY = [
  {
    platformCategory: 'social_messaging',
    interactionPattern: 'chat',
    caps: ['send_message', 'edit_message', 'delete_message', 'send_dm'],
  },
  {
    platformCategory: 'social_messaging',
    interactionPattern: 'react',
    caps: ['send_reaction', 'remove_reaction'],
  },
  {
    platformCategory: 'social_messaging',
    interactionPattern: 'send',
    caps: ['send_media', 'send_location', 'send_contact', 'send_voice'],
  },
  {
    platformCategory: 'social_feed',
    interactionPattern: 'feed',
    caps: ['read_messages', 'read_group_info', 'read_group_members'],
  },
  {
    platformCategory: 'social_messaging',
    interactionPattern: 'mixed',
    caps: [
      'create_group',
      'add_group_member',
      'remove_group_member',
      'set_group_name',
      'set_group_description',
    ],
  },
  {
    platformCategory: 'social_messaging',
    interactionPattern: 'receive',
    caps: ['read_contacts', 'read_presence', 'read_last_seen', 'read_about'],
  },
  {
    platformCategory: 'productivity',
    interactionPattern: 'mixed',
    caps: ['manage_encryption', 'backup_chats', 'export_chats'],
  },
  {
    platformCategory: 'social_messaging',
    interactionPattern: 'thread',
    caps: ['reply_message', 'forward_message', 'star_message'],
  },
  {
    platformCategory: 'social_messaging',
    interactionPattern: 'send',
    caps: ['send_sticker', 'send_gif', 'send_poll'],
  },
  {
    platformCategory: 'social_feed',
    interactionPattern: 'receive',
    caps: ['read_status', 'create_status', 'read_broadcast_list'],
  },
].map((c) => ({
  id: ulid(),
  providerId: 'whatsapp',
  platformCategory: c.platformCategory,
  interactionPattern: c.interactionPattern,
  messageTypesJson: JSON.stringify(c.caps),
  capabilitiesJson: JSON.stringify(
    c.caps.map((cap) => ({
      slug: cap,
      type: 'action',
      authScope: 'user',
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
