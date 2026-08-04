// seeds/capabilities/taxonomy-notion.ts
// 10 Notion taxonomy entries for ProviderCapabilityTaxonomy.

import { ulid } from 'ulidx'

export const NOTION_CAPABILITY_TAXONOMY = [
  { platformCategory: 'productivity', interactionPattern: 'document', caps: ['create_page', 'edit_page', 'delete_page', 'move_page', 'archive_page'] },
  { platformCategory: 'productivity', interactionPattern: 'send', caps: ['create_database', 'edit_database', 'delete_database', 'add_property', 'remove_property'] },
  { platformCategory: 'productivity', interactionPattern: 'receive', caps: ['read_page', 'read_database', 'read_page_content', 'read_database_rows'] },
  { platformCategory: 'productivity', interactionPattern: 'mixed', caps: ['create_block', 'edit_block', 'delete_block', 'append_block', 'insert_block'] },
  { platformCategory: 'social_messaging', interactionPattern: 'chat', caps: ['create_comment', 'read_comments', 'resolve_comment'] },
  { platformCategory: 'productivity', interactionPattern: 'feed', caps: ['search_pages', 'search_databases', 'search_blocks'] },
  { platformCategory: 'social_feed', interactionPattern: 'receive', caps: ['read_users', 'read_teams', 'read_spaces'] },
  { platformCategory: 'productivity', interactionPattern: 'mixed', caps: ['create_template', 'apply_template', 'read_templates'] },
  { platformCategory: 'social_messaging', interactionPattern: 'send', caps: ['invite_user', 'remove_user', 'update_permissions'] },
  { platformCategory: 'productivity', interactionPattern: 'thread', caps: ['read_page_tree', 'read_breadcrumbs', 'read_linked_pages'] },
].map(c => ({
  id: ulid(),
  providerId: 'notion',
  platformCategory: c.platformCategory,
  interactionPattern: c.interactionPattern,
  messageTypesJson: JSON.stringify(c.caps),
  capabilitiesJson: JSON.stringify(c.caps.map(cap => ({ slug: cap, type: 'action', authScope: 'workspace', description: cap.replace(/_/g, ' ') }))),
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
