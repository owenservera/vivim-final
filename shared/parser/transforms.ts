// shared/parser/transforms.ts — Preprocessors and Pipeline Transformers
// Harvested from edge-pwa/shared/parser/transforms.ts

import { type Attachment, type Link } from './types.js'

// ── Preprocessors ──────────────────────────────────────────────────────

/** Safe JSON parser. Handles double-stringified JSON and malformed outer quotes. */
export function jsonParse(val: any): any {
  if (val === undefined || val === null) return null
  if (typeof val !== 'string') return val

  try {
    const res = JSON.parse(val)
    if (typeof res === 'string') {
      return jsonParse(res) // Recursively parse double-stringified JSON
    }
    return res
  } catch {
    try {
      const cleaned = val.replace(/^['"]|['"]$/g, '').replace(/\\"/g, '"')
      const res = JSON.parse(cleaned)
      if (typeof res === 'string') {
        return jsonParse(res)
      }
      return res
    } catch {
      return null
    }
  }
}

/** Clean whitespace and trim string values */
export function trim(val: any): any {
  if (typeof val === 'string') return val.trim()
  return val
}

// ── Post-processors ────────────────────────────────────────────────────

/**
 * Normalize timestamps into standard JavaScript millisecond epochs.
 * Handles ISO strings, millisecond numbers, and Unix seconds.
 */
export function toTimestamp(val: any): number {
  if (!val) return Date.now()

  if (typeof val === 'number') {
    if (val < 1e11) {
      return Math.floor(val * 1000)
    }
    return val
  }

  if (typeof val === 'string') {
    const parsed = new Date(val).getTime()
    return isNaN(parsed) ? Date.now() : parsed
  }

  return Date.now()
}

/** Strip raw HTML tags from a string */
export function stripHtml(val: any): string {
  if (typeof val !== 'string') return ''
  return val.replace(/<[^>]*>/g, '').trim()
}

/** Scan a text string and extract all active URLs, classifying their link types. */
export function extractLinks(text: string | null): Link[] {
  if (!text) return []

  const links: Link[] = []
  const urlRegex = /(https?:\/\/[^\s\n\r"']+\.[^\s\n\r"']+)/gi
  let match: RegExpExecArray | null

  const seen = new Set<string>()

  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0].replace(/[.,;:!?)]$/, '')
    if (seen.has(url)) continue
    seen.add(url)

    let type: Link['type'] = 'external'

    if (url.includes('claude.ai/chat') || url.includes('gemini.google.com/app/')) {
      type = 'conversation'
    } else if (url.includes('/artifacts/') || url.includes('/antArtifact')) {
      type = 'artifact'
    } else if (url.match(/\.(pdf|docx|txt|xlsx|zip|csv|json)$/i)) {
      type = 'file'
    }

    links.push({ url, type })
  }

  return links
}

/**
 * Scans markdown text and raw provider nodes to discover media and attachments.
 * Supports Markdown images ![alt](url), Claude artifacts, and structured provider nodes.
 */
export function extractAttachments(text: string | null, rawNode?: any): Attachment[] {
  const attachments: Attachment[] = []
  const seenUrls = new Set<string>()

  if (text) {
    // 1. Markdown images: ![Alt Text](url)
    const mdImageRegex = /!\[([^\]]*?)\]\((https?:\/\/[^\s)]+)\)/gi
    let match: RegExpExecArray | null
    while ((match = mdImageRegex.exec(text)) !== null) {
      const name = match[1] || 'Image'
      const url = match[2]
      if (seenUrls.has(url)) continue
      seenUrls.add(url)
      attachments.push({ name, url, type: 'image', mimeType: 'image/png' })
    }

    // 2. Text-based image references: [Image: DALL-E prompt]
    const textImageRegex = /\[Image:\s*([^\]]+)\]/gi
    while ((match = textImageRegex.exec(text)) !== null) {
      attachments.push({ name: match[1], type: 'image' })
    }
  }

  // 3. Structured provider nodes (OpenAI multimodal, Gemini, etc.)
  if (rawNode && typeof rawNode === 'object') {
    if (Array.isArray(rawNode.parts)) {
      for (const part of rawNode.parts) {
        if (part?.content_type === 'image_asset_pointer') {
          attachments.push({
            id: part.asset_pointer,
            name: part.metadata?.dalle?.prompt || 'User Uploaded Image',
            type: 'image',
            size: part.size,
          })
        }
      }
    }
    if (rawNode.mime_type || rawNode.mimeType) {
      const mime = rawNode.mime_type || rawNode.mimeType
      let type: Attachment['type'] = 'document'
      if (mime.startsWith('image/')) type = 'image'
      else if (mime.startsWith('audio/')) type = 'audio'
      else if (mime.startsWith('video/')) type = 'video'

      attachments.push({
        id: rawNode.id || rawNode.uniqueId,
        name: rawNode.filename || rawNode.name || 'Attachment',
        mimeType: mime,
        size: rawNode.sizeBytes || rawNode.size,
        type,
      })
    }
  }

  return attachments
}