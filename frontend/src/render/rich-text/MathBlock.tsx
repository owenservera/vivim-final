// frontend/src/render/rich-text/MathBlock.tsx
//
// Lazy-loaded so `katex` (large) is only fetched when a message actually
// contains math. Requires adding `katex` to frontend/package.json (not
// present today — see upgrade doc §2, Gap 3).

'use client'

import { useEffect, useState } from 'react'

export default function MathBlock({ value, display }: { value: string; display: boolean }) {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    import('katex')
      .then((katex) => {
        if (cancelled) return
        try {
          setHtml(katex.default.renderToString(value, { displayMode: display, throwOnError: false }))
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [value, display])

  if (error) return <code>{value}</code>
  if (!html) return <code>{value}</code>

  const Tag = display ? 'div' : 'span'
  // KaTeX's own output; not user-controlled beyond the source LaTeX string,
  // which is already scoped to a code-like context.
  // eslint-disable-next-line react/no-danger
  return <Tag dangerouslySetInnerHTML={{ __html: html }} />
}
