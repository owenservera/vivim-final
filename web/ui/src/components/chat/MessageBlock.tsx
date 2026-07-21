'use client';

export interface ContentBlock {
  kind: string;
  content: string;
  index: number;
  [key: string]: unknown;
}

export function MessageBlock({ block }: { block: ContentBlock }) {
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
            fontFamily: 'ui-monospace, monospace',
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
    default:
      return <span style={{ whiteSpace: 'pre-wrap' }}>{block.content}</span>;
  }
}

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
