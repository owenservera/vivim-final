// src/schema/media.ts
// Media node types — images, audio, video.

import { z } from 'zod'

// ── MediaNode (cap-store.media) ────────────────────────────────────────────
// Supports image, audio, video, and generic file media.

export type MediaKind = 'image' | 'audio' | 'video' | 'file' | '3d'

export interface MediaData {
  kind: MediaKind
  title?: string
  description?: string
  mediaType: string
  url: string
  thumbnailUrl?: string
  filename?: string
  size?: number
  width?: number
  height?: number
  duration?: number
  bitrate?: number
  codec?: string
  artist?: string
  album?: string
  exif?: Record<string, unknown>
  transcription?: string
  tags?: string[]
  sourceUrl?: string
  createdAt: number
}

export const MediaDataSchema = z.object({
  kind: z.enum(['image', 'audio', 'video', 'file', '3d']),
  title: z.string({ error: 'Invalid string' }).optional(),
  description: z.string({ error: 'Invalid string' }).optional(),
  mediaType: z.string({ error: 'Invalid string' }),
  url: z.string({ error: 'Invalid string' }),
  thumbnailUrl: z.string({ error: 'Invalid string' }).optional(),
  filename: z.string({ error: 'Invalid string' }).optional(),
  size: z.number({ error: 'Invalid number' }).int().positive().optional(),
  width: z.number({ error: 'Invalid number' }).int().positive().optional(),
  height: z.number({ error: 'Invalid number' }).int().positive().optional(),
  duration: z.number({ error: 'Invalid number' }).optional(),
  bitrate: z.number({ error: 'Invalid number' }).int().positive().optional(),
  codec: z.string({ error: 'Invalid string' }).optional(),
  artist: z.string({ error: 'Invalid string' }).optional(),
  album: z.string({ error: 'Invalid string' }).optional(),
  exif: z.record(z.string(), z.unknown()).optional(),
  transcription: z.string({ error: 'Invalid string' }).optional(),
  tags: z.array(z.string({ error: 'Invalid string' })).optional(),
  sourceUrl: z.string({ error: 'Invalid string' }).optional(),
  createdAt: z.number({ error: 'Invalid number' }),
})

// ── Node schema for registration ─────────────────────────────────────────

export const mediaNodeSchema = {
  type: 'cap-store.media' as const,
  version: 1,
  schema: MediaDataSchema,
  indexContent: (data: MediaData) =>
    `${data.title ?? ''} ${data.description ?? ''} ${data.transcription ?? ''} ${data.tags?.join(' ') ?? ''}`,
  embeddingText: (data: MediaData) => `${data.title ?? ''} ${data.description ?? ''}`,
}
