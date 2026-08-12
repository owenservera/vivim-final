// frontend/src/render/renderers.tsx
//
// Built-in renderers for every ContentPart type in
// @backend/schema/streaming. Each renderer receives the FULL, typed part —
// no field is dropped, no field requires an `as Record<string, unknown>`
// cast (that was the tell in the old MessageBlock.tsx that fields were being
// discarded upstream). Importing this module registers every renderer as a
// side effect; PartRenderer.tsx imports it once.

'use client'

import { useState, type CSSProperties } from 'react'
import { registerPartRenderer, registerCustomRenderer, partRegistry, type PartRendererProps } from './registry'
import { AstRenderer } from './rich-text/AstRenderer'
import type {
  TextPart,
  ReasoningPart,
  CodePart,
  FilePart,
  ToolCallPart,
  ToolResultPart,
  SourcePart,
  CustomPart,
  ErrorPart,
  MetaPart,
  StepStartPart,
} from '@backend/schema/streaming'

const cardStyle: CSSProperties = {
  marginTop: 8,
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 12,
}
const summaryStyle: CSSProperties = {
  cursor: 'pointer',
  userSelect: 'none',
  padding: '6px 10px',
  background: 'var(--bg-subtle)',
}
const preStyle: CSSProperties = {
  margin: 0,
  padding: 10,
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  overflowX: 'auto',
}

// ── text ─────────────────────────────────────────────────────────────────
function TextRenderer({ part }: PartRendererProps<TextPart>) {
  return (
    <div style={{ marginTop: part.text ? 0 : undefined }}>
      <AstRenderer text={part.text} lang={part.lang} />
    </div>
  )
}
registerPartRenderer('text', TextRenderer)

// ── reasoning ────────────────────────────────────────────────────────────
function ReasoningRenderer({ part, streaming }: PartRendererProps<ReasoningPart>) {
  return (
    <details
      open={streaming || part.state === 'streaming'}
      style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}
    >
      <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
        Thinking{part.signature ? ` (${part.signature})` : ''}
      </summary>
      <div style={{ marginTop: 4 }}>
        <AstRenderer text={part.text} />
      </div>
    </details>
  )
}
registerPartRenderer('reasoning', ReasoningRenderer)

// ── code ─────────────────────────────────────────────────────────────────
function CodeRenderer({ part, onCopy }: PartRendererProps<CodePart>) {
  return (
    <div style={{ marginTop: 8, position: 'relative' }}>
      {part.language && (
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            padding: '2px 8px',
            background: 'var(--bg-subtle)',
            borderRadius: '6px 6px 0 0',
            border: '1px solid var(--border)',
            borderBottom: 'none',
            display: 'inline-block',
          }}
        >
          {part.language}
        </div>
      )}
      <pre
        style={{
          background: 'var(--bg-subtle)',
          color: 'var(--text)',
          padding: 12,
          borderRadius: part.language ? '0 6px 6px 6px' : 6,
          overflowX: 'auto',
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.5,
          border: '1px solid var(--border)',
        }}
      >
        <code>{part.text}</code>
      </pre>
      {onCopy && (
        <button
          onClick={() => onCopy(part.text)}
          style={{ position: 'absolute', top: 4, right: 4, fontSize: 11 }}
        >
          Copy
        </button>
      )}
    </div>
  )
}
registerPartRenderer('code', CodeRenderer)

// ── file ─────────────────────────────────────────────────────────────────
function FileRenderer({ part }: PartRendererProps<FilePart>) {
  const isImage = part.mediaType.startsWith('image/')
  if (isImage) {
    return (
      <div style={{ marginTop: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={part.data ? `data:${part.mediaType};base64,${part.data}` : part.url}
          alt={part.filename ?? 'attachment'}
          style={{ maxWidth: '100%', borderRadius: 6, border: '1px solid var(--border)' }}
        />
      </div>
    )
  }
  return (
    <div
      style={{
        marginTop: 8,
        padding: '6px 10px',
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--bg-subtle)',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{part.mediaType}</span>
      <a href={part.url} target="_blank" rel="noreferrer">
        {part.filename ?? part.url}
      </a>
    </div>
  )
}
registerPartRenderer('file', FileRenderer)

// ── tool-call ────────────────────────────────────────────────────────────
function ToolCallRenderer({ part }: PartRendererProps<ToolCallPart>) {
  const pending = part.state === 'pending' || part.state === 'input-streaming'
  const needsApproval = part.state === 'approval-requested'
  return (
    <details style={cardStyle} open={needsApproval}>
      <summary style={summaryStyle}>
        Tool: {part.toolName}
        {pending && ' (running…)'}
        {needsApproval && ' — approval required'}
      </summary>
      <pre style={preStyle}>{JSON.stringify(part.input, null, 2)}</pre>
      {part.approvalId && (
        <div style={{ padding: '0 10px 10px', fontSize: 11, color: 'var(--text-muted)' }}>
          approvalId: {part.approvalId}
        </div>
      )}
    </details>
  )
}
registerPartRenderer('tool-call', ToolCallRenderer)

// ── tool-result ──────────────────────────────────────────────────────────
function ToolResultRenderer({ part }: PartRendererProps<ToolResultPart>) {
  return (
    <details style={{ ...cardStyle, borderColor: part.isError ? '#ef4444' : 'var(--border)' }}>
      <summary style={summaryStyle}>
        {part.isError ? 'Tool error' : 'Tool result'} ({part.toolCallId})
      </summary>
      <pre style={preStyle}>
        {typeof part.output === 'string' ? part.output : JSON.stringify(part.output ?? {}, null, 2)}
      </pre>
    </details>
  )
}
registerPartRenderer('tool-result', ToolResultRenderer)

// ── source ───────────────────────────────────────────────────────────────
function SourceRenderer({ part }: PartRendererProps<SourcePart>) {
  return (
    <a
      href={part.url}
      target="_blank"
      rel="noreferrer"
      style={{
        marginTop: 8,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'var(--bg-subtle)',
        fontSize: 11,
        color: 'var(--text)',
        textDecoration: 'none',
      }}
    >
      {part.title ?? part.url ?? part.sourceId}
    </a>
  )
}
registerPartRenderer('source', SourceRenderer)

// ── custom ───────────────────────────────────────────────────────────────
// Second-level dispatch by `kind` — the open extension point. Unregistered
// kinds fall back to a generic JSON viewer, same shape as the top-level
// fallback, so an unknown custom widget never breaks the render.
function CustomRenderer({ part, index }: PartRendererProps<CustomPart>) {
  const Renderer = partRegistry.getCustom(part.kind)
  if (Renderer) {
    return <Renderer data={part.data} state={part.state} index={index} />
  }
  return (
    <details style={cardStyle}>
      <summary style={summaryStyle}>Custom: {part.kind}</summary>
      <pre style={preStyle}>{JSON.stringify(part.data, null, 2)}</pre>
    </details>
  )
}
registerPartRenderer('custom', CustomRenderer)

// ── error ────────────────────────────────────────────────────────────────
function ErrorRenderer({ part }: PartRendererProps<ErrorPart>) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: '8px 12px',
        borderRadius: 6,
        border: '1px solid #ef4444',
        background: 'rgba(239,68,68,0.08)',
        color: '#ef4444',
        fontSize: 12,
      }}
    >
      {part.message}
      {part.code && <span style={{ opacity: 0.7 }}> ({part.code})</span>}
    </div>
  )
}
registerPartRenderer('error', ErrorRenderer)

// ── meta ─────────────────────────────────────────────────────────────────
function MetaRenderer({ part }: PartRendererProps<MetaPart>) {
  const [open, setOpen] = useState(false)
  return (
    <div
      onClick={() => setOpen((o) => !o)}
      style={{
        marginTop: 8,
        padding: '4px 8px',
        borderRadius: 4,
        background: 'var(--bg-subtle)',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)',
        cursor: 'pointer',
      }}
    >
      {part.key}: {open ? JSON.stringify(part.value, null, 2) : String(part.value)}
    </div>
  )
}
registerPartRenderer('meta', MetaRenderer)

// ── step-start ───────────────────────────────────────────────────────────
function StepStartRenderer() {
  return (
    <div
      style={{
        marginTop: 12,
        marginBottom: 4,
        paddingBottom: 4,
        borderBottom: '1px solid var(--border)',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      Step
    </div>
  )
}
registerPartRenderer('step-start', StepStartRenderer)

// ── example custom-kind registration (extension pattern) ──────────────────
// Real extensions live in frontend/src/render/extensions/*.tsx and are
// imported once from the app root. Shown here as documentation of the
// pattern described in the upgrade doc §3.
//
// registerCustomRenderer('poll', PollWidget)
