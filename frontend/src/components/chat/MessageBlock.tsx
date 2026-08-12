// frontend/src/components/chat/MessageBlock.tsx
//
// REPLACES the old file. Keeps the same exported names (`ContentBlock`,
// `MessageBlock`, `RenderBlocks`) so `frontend/src/ui/defaults/index.tsx`
// and any other caller needs ZERO changes — but every one of those names
// now points at the canonical, registry-backed implementation instead of a
// local switch statement over a locally-invented type.
//
// `ContentBlock` is re-exported as an alias of the canonical `ContentPart`
// (via shared/stream-blocks.ts) purely for import-path compatibility with
// existing call sites; new code should import `ContentPart` directly from
// `@backend/schema/streaming` and `RenderParts`/`PartRenderer` from
// `@/render/PartRenderer`.

'use client'

import { memo } from 'react'
// Imported directly via the @backend/* alias, which already resolves at
// runtime today (see e.g. frontend/src/schema/api-types.ts's existing
// `from '@backend/schema/api-types'`). shared/stream-blocks.ts re-exports
// the same type but is not currently reachable from the frontend build (no
// `@shared/*`/root-relative alias declared in frontend/tsconfig.json) — see
// upgrade doc §0 for the corrected finding and backend-patches.md §4 for the
// one-line tsconfig fix if the indirection through shared/ is preferred.
export type { ContentBlock } from '@backend/schema/streaming'
import { RenderParts, PartRenderer, type RenderablePart } from '@/render/PartRenderer'

// Old call sites (frontend/src/ui/defaults/index.tsx:62, and anything
// registered through ml-boot.ts's component catalog) invoke this as
// `<MessageBlock block={block} />` — singular `block` prop, no `index`.
// Preserve that exact signature; adapt internally to PartRenderer's
// `part`/`index` props so both the legacy call site and new code
// (RenderParts, which passes `part`/`index` directly) share one
// implementation.
export const MessageBlock = memo(function MessageBlock({
  block,
  onCopy,
  onRetry,
  onEdit,
}: {
  block: RenderablePart
  onCopy?: (text: string) => void
  onRetry?: (text: string) => void
  onEdit?: (text: string) => void
}) {
  return <PartRenderer part={block} index={0} onCopy={onCopy} onRetry={onRetry} onEdit={onEdit} />
})

export function RenderBlocks({
  blocks,
  onCopy,
  onRetry,
  onEdit,
}: {
  blocks: RenderablePart[]
  onCopy?: (text: string) => void
  onRetry?: (text: string) => void
  onEdit?: (text: string) => void
}) {
  return <RenderParts parts={blocks} onCopy={onCopy} onRetry={onRetry} onEdit={onEdit} />
}
