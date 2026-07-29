'use client';

import { memo } from 'react';

/**
 * UI rendering type — superset of shared/stream-blocks.ts canonical ContentBlock.
 * Adds tool-result, file, step-start for progressive rendering.
 * Canonical type used by streaming pipeline; this type used by render layer.
 */
export interface ContentBlock {
  kind: string;
  content: string;
  index: number;
  [key: string]: unknown;
}

// R3-15: Memoize to prevent re-render per streaming chunk
export const MessageBlock = memo(function MessageBlock({ block }: { block: ContentBlock }) {
  const kind = block.kind ?? 'text'
  switch (kind) {
    case 'code':
      return (
        <pre
          style={{
            background: 'var(--bg-subtle)',
            color: 'var(--text)',
            padding: 12,
            borderRadius: 6,
            marginTop: 8,
            overflowX: 'auto',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            lineHeight: 1.5,
            border: '1px solid var(--border)',
          }}
        >
          <code>{block.content}</code>
        </pre>
      );
    case 'thinking':
      return (
        <details
          style={{
            marginTop: 8,
            color: 'var(--text-muted)',
            fontSize: 12,
            fontStyle: 'italic',
          }}
        >
          <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
            Thinking
          </summary>
          <p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{block.content}</p>
        </details>
      );
    case 'error':
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
          {block.content}
        </div>
      );
    case 'tool-call':
      return (
        <details
          style={{
            marginTop: 8,
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          <summary style={{ cursor: 'pointer', userSelect: 'none', padding: '6px 10px', background: 'var(--bg-subtle)' }}>
            Tool: {String((block as Record<string, unknown>).toolName ?? 'unknown')}
          </summary>
          <pre style={{ margin: 0, padding: 10, fontSize: 11, fontFamily: 'var(--font-mono)', overflowX: 'auto' }}>
            {JSON.stringify((block as Record<string, unknown>).input ?? '', null, 2)}
          </pre>
        </details>
      );
    case 'tool-result':
      return (
        <details
          style={{
            marginTop: 8,
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          <summary style={{ cursor: 'pointer', userSelect: 'none', padding: '6px 10px', background: 'var(--bg-subtle)' }}>
            Result: {String((block as Record<string, unknown>).toolName ?? 'unknown')}
          </summary>
          <pre style={{ margin: 0, padding: 10, fontSize: 11, fontFamily: 'var(--font-mono)', overflowX: 'auto' }}>
            {typeof (block as Record<string, unknown>).output === 'string'
              ? (block as Record<string, unknown>).output as string
              : JSON.stringify((block as Record<string, unknown>).output ?? {}, null, 2)}
          </pre>
        </details>
      );
    case 'file':
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
          <span style={{ color: 'var(--text-muted)' }}>File:</span>
          <span>{block.content}</span>
        </div>
      );
    case 'meta':
      return (
        <div
          style={{
            marginTop: 8,
            padding: '4px 8px',
            borderRadius: 4,
            background: 'var(--bg-subtle)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
          }}
        >
          {String((block as Record<string, unknown>).key ?? 'meta')}: {String((block as Record<string, unknown>).value ?? '')}
        </div>
      );
    case 'step-start':
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
          {block.content || 'Step'}
        </div>
      );
    default:
      return <span style={{ whiteSpace: 'pre-wrap' }}>{block.content}</span>;
  }
});

export function RenderBlocks({ blocks }: { blocks: ContentBlock[] }) {
  const merged: ContentBlock[] = [];
  for (const block of blocks) {
    const last = merged[merged.length - 1];
    if ((block.kind === 'text' || !block.kind) && last?.kind === 'text') {
      last.content += block.content;
    } else {
      merged.push({ ...block });
    }
  }

  return (
    <>
      {merged.map((block) => (
        <MessageBlock key={`${block.kind}-${block.index}`} block={block} />
      ))}
    </>
  );
}
