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
  title: z.string().optional(),
  description: z.string().optional(),
  mediaType: z.string(),
  url: z.string(),
  thumbnailUrl: z.string().optional(),
  filename: z.string().optional(),
  size: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().optional(),
  bitrate: z.number().int().positive().optional(),
  codec: z.string().optional(),
  artist: z.string().optional(),
  album: z.string().optional(),
  exif: z.record(z.unknown()).optional(),
  transcription: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sourceUrl: z.string().optional(),
  createdAt: z.number(),
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
