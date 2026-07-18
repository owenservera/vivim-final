// src/schema/social.ts
// Social post node types — tweets, LinkedIn, Reddit, etc.

import { z } from 'zod'

// ── SocialPostNode (cap-store.social-post) ─────────────────────────────────

export interface SocialPostData {
  platform: 'twitter' | 'linkedin' | 'reddit' | 'bluesky' | 'mastodon' | 'threads' | 'other'
  postId: string
  url?: string
  author: {
    id?: string
    displayName: string
    username: string
    avatarUrl?: string
  }
  body: string
  bodyType?: 'plain' | 'markdown'
  publishedAt: number
  archivedAt: number
  editedAt?: number
  metrics?: {
    likes?: number
    replies?: number
    reposts?: number
    views?: number
  }
  attachments?: Array<{
    type: 'image' | 'video' | 'link'
    url: string
    mediaType?: string
  }>
  inReplyToPostId?: string
  inReplyToAuthor?: string
  threadId?: string
  tags?: string[]
  language?: string
  sentiment?: 'positive' | 'negative' | 'neutral'
}

export const SocialAuthorSchema = z.object({
  id: z.string().optional(),
  displayName: z.string(),
  username: z.string(),
  avatarUrl: z.string().optional(),
})

export const SocialMetricsSchema = z.object({
  likes: z.number().int().positive().optional(),
  replies: z.number().int().positive().optional(),
  reposts: z.number().int().positive().optional(),
  views: z.number().int().positive().optional(),
})

export const SocialAttachmentSchema = z.object({
  type: z.enum(['image', 'video', 'link']),
  url: z.string(),
  mediaType: z.string().optional(),
})

export const SocialPostDataSchema = z.object({
  platform: z.enum(['twitter', 'linkedin', 'reddit', 'bluesky', 'mastodon', 'threads', 'other']),
  postId: z.string(),
  url: z.string().optional(),
  author: SocialAuthorSchema,
  body: z.string(),
  bodyType: z.enum(['plain', 'markdown']).optional(),
  publishedAt: z.number(),
  archivedAt: z.number(),
  editedAt: z.number().optional(),
  metrics: SocialMetricsSchema.optional(),
  attachments: z.array(SocialAttachmentSchema).optional(),
  inReplyToPostId: z.string().optional(),
  inReplyToAuthor: z.string().optional(),
  threadId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  language: z.string().optional(),
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
})

// ── Node schema for registration ─────────────────────────────────────────

export const socialPostNodeSchema = {
  type: 'cap-store.social-post' as const,
  version: 1,
  schema: SocialPostDataSchema,
  indexContent: (data: SocialPostData) => `${data.author.displayName}: ${data.body} ${data.tags?.join(' ') ?? ''}`,
  embeddingText: (data: SocialPostData) => data.body,
}
