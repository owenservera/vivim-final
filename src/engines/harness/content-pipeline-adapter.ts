// src/engines/harness/content-pipeline-adapter.ts
// Unit 23.2 - Content pipeline adapter.
// Mirrors cap-store's content pipeline: the raw captured DOM body is normalised
// into structured stream blocks the UI/kernel can render. The governor yields
// the raw body; this module turns it into one or more ContentBlocks.

export interface NormalizedBlock {
  blockKind: string
  blockData: string
}

/** Normalise a raw captured body into renderable blocks. */
export function reconstructCapture(raw: string | undefined): NormalizedBlock[] {
  if (!raw || raw.length === 0) return []
  // cap-store content pipeline: split on double newlines into paragraph blocks,
  // keep code fences as 'code' blocks. Lightweight, deterministic.
  const parts = raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  const blocks: NormalizedBlock[] = []
  for (const part of parts) {
    if (part.startsWith('```') && part.endsWith('```')) {
      blocks.push({ blockKind: 'code', blockData: part.slice(3, -3).trim() })
    } else {
      blocks.push({ blockKind: 'text', blockData: part })
    }
  }
  return blocks.length > 0 ? blocks : [{ blockKind: 'text', blockData: raw }]
}
