// seeds/capabilities/taxonomy-reddit.ts
// 10 Reddit taxonomy entries for ProviderCapabilityTaxonomy.

import { ulid } from 'ulidx'

export const REDDIT_CAPABILITY_TAXONOMY = [
  { platformCategory: 'social_feed', interactionPattern: 'feed', caps: ['create_post', 'edit_post', 'delete_post', 'pin_post', 'crosspost'] },
  { platformCategory: 'social_feed', interactionPattern: 'send', caps: ['create_comment', 'edit_comment', 'delete_comment'] },
  { platformCategory: 'social_feed', interactionPattern: 'react', caps: ['upvote', 'downvote', 'save', 'unsave', 'hide', 'unhide'] },
  { platformCategory: 'social_feed', interactionPattern: 'receive', caps: ['read_posts', 'read_comments', 'read_subreddits', 'read_user_profile'] },
  { platformCategory: 'social_messaging', interactionPattern: 'chat', caps: ['send_dm', 'read_inbox', 'read_unread'] },
  { platformCategory: 'productivity', interactionPattern: 'mixed', caps: ['subscribe_subreddit', 'unsubscribe_subreddit', 'join_chat', 'leave_chat'] },
  { platformCategory: 'social_feed', interactionPattern: 'thread', caps: ['read_thread', 'read_more_children', 'collapse_thread'] },
  { platformCategory: 'social_feed', interactionPattern: 'receive', caps: ['search_posts', 'search_comments', 'search_subreddits'] },
  { platformCategory: 'social_messaging', interactionPattern: 'send', caps: ['report_post', 'report_comment', 'block_user'] },
  { platformCategory: 'social_feed', interactionPattern: 'mixed', caps: ['read_awards', 'give_award', 'read_karma'] },
].map(c => ({
  id: ulid(),
  providerId: 'reddit',
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
