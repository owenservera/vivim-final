// frontend/src/render/rich-text/MarkdownString.tsx
//
// Handles the `RichText = string` arm (plain GFM markdown, not yet parsed to
// an AST — the common case for provider streaming output, since parsing to
// an AST happens opportunistically, see src/schema/rich-text.ts
// parseRichText). Requires `react-markdown` + `remark-gfm` in
// frontend/package.json (not present today — see upgrade doc §2, Gap 3).
//
// Deliberately does NOT reimplement markdown parsing on the frontend: the
// backend already owns a full GFM parser (`parseRichText`,
// mdast-util-from-markdown + mdast-util-gfm). This component exists only
// because provider streaming output is frequently still a raw string when
// it reaches the client mid-stream (before the backend's post-stream AST
// pass runs) — so the frontend needs *a* renderer for the string arm, kept
// intentionally minimal and swappable.

'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownString({ value, lang }: { value: string; lang?: string }) {
  return (
    <div className="rich-text-markdown" data-lang={lang}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  )
}
