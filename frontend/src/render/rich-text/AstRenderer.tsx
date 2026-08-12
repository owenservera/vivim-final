// frontend/src/render/rich-text/AstRenderer.tsx
//
// Closes Gap 3 from the upgrade doc: the frontend previously had NO renderer
// for RichText at all (not even a markdown library was installed). RichText
// is `string | { ast: RichNode[] }` (@backend/schema/rich-text). Both arms
// are handled here so `TextPart.text` / `ReasoningPart.text` render
// identically regardless of which arm the parser produced.
//
// The `{ast}` arm is a direct, dependency-light walk of the mdast-style tree
// already defined in the backend. The `string` arm is treated as GFM
// markdown; add `react-markdown` + `remark-gfm` (both pure JS, no native
// deps) for that path — recommended in the upgrade doc §2, Gap 3. Until that
// dependency lands, the string arm falls back to preformatted text so
// nothing crashes and nothing silently drops content.

'use client'

import { lazy, Suspense, type ReactNode } from 'react'
import type React from 'react'
import DOMPurify from 'dompurify'
import type {
  RichText,
  RichNode,
  FlowContent,
  PhrasingContent,
  Mark,
} from '@backend/schema/rich-text'
import { partRegistry } from '../registry'

// Heavy, rarely-used renderers are lazy-loaded so the common text/code path
// never pays for mermaid/katex bundle weight.
const MermaidBlock = lazy(() => import('./MermaidBlock'))
const MathBlock = lazy(() => import('./MathBlock'))
const MarkdownString = lazy(() => import('./MarkdownString'))

export function AstRenderer({ text, lang }: { text: RichText; lang?: string }) {
  if (typeof text === 'string') {
    return (
      <Suspense fallback={<PlainText value={text} />}>
        <MarkdownString value={text} lang={lang} />
      </Suspense>
    )
  }
  return (
    <>
      {text.ast.map((node, i) => (
        <FlowNodeRenderer key={i} node={node as FlowContent} />
      ))}
    </>
  )
}

function PlainText({ value }: { value: string }) {
  return <span style={{ whiteSpace: 'pre-wrap' }}>{value}</span>
}

// ── Flow (block-level) nodes ────────────────────────────────────────────
function FlowNodeRenderer({ node }: { node: FlowContent }) {
  switch (node.type) {
    case 'paragraph':
      return (
        <p style={{ margin: '0.5em 0' }}>
          <PhrasingChildren nodes={node.children} />
        </p>
      )
    case 'heading': {
      const inner = <PhrasingChildren nodes={node.children} />
      if (node.depth === 1) return <h1>{inner}</h1>
      if (node.depth === 2) return <h2>{inner}</h2>
      if (node.depth === 3) return <h3>{inner}</h3>
      if (node.depth === 4) return <h4>{inner}</h4>
      if (node.depth === 5) return <h5>{inner}</h5>
      return <h6>{inner}</h6>
    }
    case 'blockquote':
      return (
        <blockquote
          style={{ borderLeft: '3px solid var(--border)', margin: '0.5em 0', paddingLeft: 12, color: 'var(--text-muted)' }}
        >
          {node.children.map((c, i) => (
            <FlowNodeRenderer key={i} node={c} />
          ))}
        </blockquote>
      )
    case 'list': {
      const Tag = node.ordered ? 'ol' : 'ul'
      return (
        <Tag start={node.start}>
          {node.children.map((item, i) => (
            <li key={i} style={{ listStyleType: item.checked !== undefined ? 'none' : undefined }}>
              {item.checked !== undefined && (
                <input type="checkbox" checked={item.checked} readOnly style={{ marginRight: 6 }} />
              )}
              {item.children.map((c, j) => (
                <FlowNodeRenderer key={j} node={c} />
              ))}
            </li>
          ))}
        </Tag>
      )
    }
    case 'code':
      return (
        <pre
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 12,
            overflowX: 'auto',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <code>{node.value}</code>
        </pre>
      )
    case 'table':
      return (
        <table style={{ borderCollapse: 'collapse', width: '100%', margin: '0.5em 0' }}>
          <tbody>
            {node.children.map((row, i) => (
              <tr key={i}>
                {row.children.map((cell, j) => {
                  const Tag = i === 0 ? 'th' : 'td'
                  return (
                    <Tag
                      key={j}
                      style={{
                        border: '1px solid var(--border)',
                        padding: '4px 8px',
                        textAlign: node.align?.[j] ?? 'left',
                      }}
                    >
                      <PhrasingChildren nodes={cell.children} />
                    </Tag>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'thematicBreak':
      return <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '1em 0' }} />
    case 'html': {
      const clean = DOMPurify.sanitize(node.value)
      // eslint-disable-next-line react/no-danger
      return <div dangerouslySetInnerHTML={{ __html: clean }} />
    }
    case 'mathBlock':
      return (
        <Suspense fallback={<PlainText value={node.value} />}>
          <MathBlock value={node.value} display />
        </Suspense>
      )
    case 'mermaid':
      return (
        <Suspense fallback={<pre style={{ fontSize: 11 }}>{node.value}</pre>}>
          <MermaidBlock value={node.value} />
        </Suspense>
      )
    default:
      return null
  }
}

// ── Phrasing (inline) nodes ─────────────────────────────────────────────
function PhrasingChildren({ nodes }: { nodes: PhrasingContent[] }) {
  return (
    <>
      {nodes.map((n, i) => (
        <PhrasingNodeRenderer key={i} node={n} />
      ))}
    </>
  )
}

function applyMarks(children: ReactNode, marks: Mark[] | undefined): ReactNode {
  if (!marks || marks.length === 0) return children
  return marks.reduceRight((acc, mark) => {
    switch (mark.type) {
      case 'bold':
        return <strong>{acc}</strong>
      case 'italic':
        return <em>{acc}</em>
      case 'underline':
        return <u>{acc}</u>
      case 'strike':
        return <s>{acc}</s>
      case 'code':
        return <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9em' }}>{acc}</code>
      case 'highlight':
        return <mark>{acc}</mark>
      case 'subscript':
        return <sub>{acc}</sub>
      case 'superscript':
        return <sup>{acc}</sup>
      case 'link':
        return (
          <a href={mark.url} title={mark.title} target="_blank" rel="noreferrer">
            {acc}
          </a>
        )
      default:
        return acc
    }
  }, children)
}

function PhrasingNodeRenderer({ node }: { node: PhrasingContent }) {
  switch (node.type) {
    case 'text':
      return <>{applyMarks(node.value, node.marks)}</>
    case 'emphasis':
      return (
        <em>
          <PhrasingChildren nodes={node.children} />
        </em>
      )
    case 'strong':
      return (
        <strong>
          <PhrasingChildren nodes={node.children} />
        </strong>
      )
    case 'delete':
      return (
        <s>
          <PhrasingChildren nodes={node.children} />
        </s>
      )
    case 'inlineCode':
      return <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9em' }}>{node.value}</code>
    case 'link':
      return (
        <a href={node.url} title={node.title} target="_blank" rel="noreferrer">
          <PhrasingChildren nodes={node.children} />
        </a>
      )
    case 'image':
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={node.url} alt={node.alt ?? ''} title={node.title} style={{ maxWidth: '100%' }} />
      )
    case 'break':
      return <br />
    case 'math':
      return (
        <Suspense fallback={<code>{node.value}</code>}>
          <MathBlock value={node.value} display={false} />
        </Suspense>
      )
    case 'widget': {
      // Inline widgets route through the SAME custom-kind registry used by
      // top-level CustomPart — one extensibility mechanism, not two.
      const Renderer = partRegistry.getCustom(node.kind)
      if (!Renderer) return <code>[widget:{node.kind}]</code>
      return <Renderer data={node.props} index={0} />
    }
    case 'mention':
      return <span style={{ color: 'var(--accent)', fontWeight: 500 }}>@{node.id}</span>
    default:
      return null
  }
}
