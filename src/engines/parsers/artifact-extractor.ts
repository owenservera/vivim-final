/**
 * @module engines/parsers/artifact-extractor
 *
 * Provider-agnostic artifact extraction from markdown/LLM output.
 * Extracts code fences, antArtifact tags, and thinking blocks.
 *
 * @example
 * ```ts
 * const events = extractAll('Here is some code:\n```js\nconsole.log(1)\n```');
 * // → [{ kind: 'artifact', artifactType: 'code', payload: { language: 'js', code: 'console.log(1)' } }]
 * ```
 */

// ── Types ────────────────────────────────────────────────────────

export interface CodeFence {
  language?: string;
  code: string;
}

export interface AntArtifact {
  type: string;
  content: string;
  attrs: Record<string, string>;
}

export interface ArtifactEvent {
  kind: 'artifact';
  artifactType: 'code' | 'antartifact' | 'thinking';
  payload: CodeFence | AntArtifact | { text: string };
}

// ── Code-fence extraction ────────────────────────────────────────

/**
 * Extract all fenced code blocks from markdown text.
 */
export function extractCodeFences(text: string): CodeFence[] {
  const results: CodeFence[] = [];
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const lang = m[1] || undefined;
    const code = m[2];
    if (code) results.push({ language: lang, code: code.trim() });
  }
  return results;
}

// ── antArtifact extraction ───────────────────────────────────────

/**
 * Extract antArtifact tags from Claude-style output.
 */
export function extractAntArtifacts(text: string): AntArtifact[] {
  const results: AntArtifact[] = [];
  const re = /<antArtifact\s+([^>]+)>([\s\S]*?)<\/antArtifact>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const attrStr = m[1] as string;
    const content = m[2];
    const attrs = parseTagAttrs(attrStr);
    results.push({ type: attrs.type ?? 'unknown', content: content ? content.trim() : '', attrs });
  }
  return results;
}

function parseTagAttrs(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr)) !== null) {
    const name = m[1] as string;
    const value = m[2] as string;
    if (name && value) attrs[name] = value;
  }
  return attrs;
}

// ── Thinking-block extraction ────────────────────────────────────

/**
 * Extract thinking/reasoning blocks from LLM output.
 * Handles `<think>...</think>` and `<thinking>...</thinking>`.
 */
export function extractThinkingBlocks(text: string): string[] {
  const results: string[] = [];
  const re = /<think([\s\S]*?)<\/think>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const block = m[1];
    if (block) results.push(block.trim());
  }
  return results;
}

// ── Bulk extraction ──────────────────────────────────────────────

/**
 * Extract all artifact types from text in a single pass.
 */
export function extractAll(text: string): ArtifactEvent[] {
  const events: ArtifactEvent[] = [];
  for (const f of extractCodeFences(text)) {
    events.push({ kind: 'artifact', artifactType: 'code', payload: f });
  }
  for (const a of extractAntArtifacts(text)) {
    events.push({ kind: 'artifact', artifactType: 'antartifact', payload: a });
  }
  for (const t of extractThinkingBlocks(text)) {
    events.push({ kind: 'artifact', artifactType: 'thinking', payload: { text: t } });
  }
  return events;
}
