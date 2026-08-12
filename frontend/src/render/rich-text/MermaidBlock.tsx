// frontend/src/render/rich-text/MermaidBlock.tsx
//
// Lazy-loaded so the `mermaid` package (large) is only fetched when a
// message actually contains a mermaid block. Requires adding `mermaid` to
// frontend/package.json (not present today — see upgrade doc §2, Gap 3).

'use client'

import { useEffect, useRef, useState } from 'react'

export default function MermaidBlock({ value }: { value: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const id = useRef(`mermaid-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    let cancelled = false
    import('mermaid')
      .then(async (mod) => {
        const mermaid = mod.default
        mermaid.initialize({ startOnLoad: false, theme: 'neutral' })
        const { svg } = await mermaid.render(id.current, value)
        if (!cancelled && ref.current) ref.current.innerHTML = svg
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [value])

  if (error) {
    return (
      <pre style={{ fontSize: 11, color: '#ef4444', whiteSpace: 'pre-wrap' }}>
        Mermaid render failed: {error}
        {'\n'}
        {value}
      </pre>
    )
  }

  return <div ref={ref} style={{ margin: '0.5em 0', overflowX: 'auto' }} />
}
