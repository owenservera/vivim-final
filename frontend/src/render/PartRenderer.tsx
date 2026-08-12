// frontend/src/render/PartRenderer.tsx
//
// The dispatcher. This is the ONLY place in the frontend that is allowed to
// look at ContentPart.type and branch on it — and it does so via the
// registry, not a switch. This is also the ONE place legacy {kind, content,
// index} rows (from old stored messages, or any not-yet-migrated ingestion
// path) get converted, using the backend's own migrateLegacyBlock — not a
// frontend reimplementation, so there is exactly one migration table in the
// whole system.

'use client'

import { memo } from 'react'
import type { ContentPart } from '@backend/schema/streaming'
import {
  isLegacyBlock,
  migrateLegacyBlock,
  type LegacyBlock,
} from '@backend/schema/streaming'
import { partRegistry, type PartRendererProps } from './registry'
import './renderers' // registers all built-in renderers as a side effect

export type RenderablePart = ContentPart | LegacyBlock

function normalize(part: RenderablePart): ContentPart {
  return isLegacyBlock(part) ? migrateLegacyBlock(part) : part
}

export const PartRenderer = memo(function PartRenderer({
  part: rawPart,
  index,
  streaming,
  onCopy,
  onRetry,
  onEdit,
}: {
  part: RenderablePart
  index: number
  streaming?: boolean
  onCopy?: (text: string) => void
  onRetry?: (text: string) => void
  onEdit?: (text: string) => void
}) {
  const part = normalize(rawPart)
  const Renderer = partRegistry.get(part.type)

  if (!Renderer) {
    // Registry completeness test (see upgrade doc §5) prevents this from
    // happening for known types; this only fires for a genuinely unknown
    // future type that shipped without a matching frontend release yet.
    return <UnknownPartFallback part={part} />
  }

  return (
    <Renderer
      part={part as any}
      index={index}
      streaming={streaming}
      onCopy={onCopy}
      onRetry={onRetry}
      onEdit={onEdit}
    />
  )
})

function UnknownPartFallback({ part }: { part: ContentPart }) {
  return (
    <details
      style={{
        marginTop: 8,
        border: '1px dashed var(--border)',
        borderRadius: 6,
        fontSize: 12,
        color: 'var(--text-muted)',
      }}
    >
      <summary style={{ cursor: 'pointer', padding: '6px 10px' }}>
        Unsupported content ({(part as { type: string }).type})
      </summary>
      <pre style={{ margin: 0, padding: 10, fontSize: 11, overflowX: 'auto' }}>
        {JSON.stringify(part, null, 2)}
      </pre>
    </details>
  )
}

/**
 * Renders a full message's parts. Adjacent streaming text/reasoning parts of
 * the same type are merged before render (matches prior RenderBlocks
 * behavior) so incremental token pushes don't create a new DOM node per
 * chunk.
 */
export function RenderParts({
  parts,
  streaming,
  onCopy,
  onRetry,
  onEdit,
}: {
  parts: RenderablePart[]
  streaming?: boolean
  onCopy?: (text: string) => void
  onRetry?: (text: string) => void
  onEdit?: (text: string) => void
}) {
  const merged = mergeAdjacentText(parts.map(normalize))

  return (
    <>
      {merged.map((part, i) => (
        <PartRenderer
          key={`${part.type}-${i}`}
          part={part}
          index={i}
          streaming={streaming}
          onCopy={onCopy}
          onRetry={onRetry}
          onEdit={onEdit}
        />
      ))}
    </>
  )
}

function mergeAdjacentText(parts: ContentPart[]): ContentPart[] {
  const merged: ContentPart[] = []
  for (const part of parts) {
    const last = merged[merged.length - 1]
    if (
      part.type === 'text' &&
      last?.type === 'text' &&
      typeof part.text === 'string' &&
      typeof last.text === 'string'
    ) {
      last.text = last.text + part.text
      continue
    }
    merged.push({ ...part })
  }
  return merged
}

export type { PartRendererProps }
