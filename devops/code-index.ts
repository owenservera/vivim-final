// devops/code-index.ts
//
// Local-first, offline source-code indexing for LLM / vibe coding.
//
//   bun run devops code-index index [path] [--db=.runtime/code-index.sqlite]
//   bun run devops code-index search <query> [--k=8] [--token-budget=4000] [--json]
//   bun run devops code-index stats
//   bun run devops code-index watch [path]
//   bun run devops code-index mcp            # stdio Model Context Protocol server
//
// SOTA architecture (see docs/research/.../local-code-indexing-llm-*.md):
//   repo -> ignore-aware walk -> structural/AST chunk (def boundaries)
//       -> optional embed (pluggable) -> Bun.sqlite FTS5 (+vector if embed)
//   query -> FTS5 MATCH (bm25) [+ vector cosine] -> RRF(k=60)
//         -> token-budgeted path:line packets
//   surfaces: CLI (required, sub-agents can't call MCP) + stdio MCP.
//
// Zero runtime dependencies: Bun.sqlite (FTS5) + structural chunking.
// Tree-sitter WASM is an optional upgrade; embeddings are an opt-in flag.

import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import {
  join,
  relative,
  resolve,
  basename,
} from 'node:path'
import {
  readFileSync,
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
  rmSync,
  watch as fsWatch,
  type Stats,
} from 'node:fs'

const DEFAULT_DB = '.runtime/code-index.sqlite'
const MAX_FILE_BYTES = 512 * 1024
// Largest single chunk we emit into FTS5. Oversized chunks (e.g. a 500KB
// markdown file with no declarations) are split so no FTS5 row blows memory.
const MAX_CHUNK_BYTES = 16 * 1024
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.runtime',
  'dist',
  'build',
  'out',
  'coverage',
  'chrome-profiles',
  '.turbo',
  'target',
  'vendor',
  '.next',
  '.svelte-kit',
  // Harvested browser-capture dumps (not source code; can be multi-MB HTML).
  'harvest',
])
const SUPPORTED_EXT = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mts', 'cts', 'cjs',
  'json', 'md', 'mdx',
  'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'cc',
  'cs', 'rb', 'php', 'kt', 'swift', 'lua', 'sh', 'zsh',
  'yaml', 'yml', 'toml', 'sql', 'css', 'scss',
  'zig', 'scala', 'vue', 'svelte', 'dart', 'ex', 'exs',
])

// Default code-only index scope (answer to interview Q1). Whole repo via `--all`.
const CODE_ROOTS = ['src', 'devops', 'web', 'scripts', 'seeds', 'prisma']

export interface Chunk {
  path: string
  symbol: string
  kind: string
  start: number
  end: number
  content: string
  hash: string
}

export interface SearchHit {
  path: string
  symbol: string
  kind: string
  lines: [number, number]
  snippet: string
}

/** Pluggable embedder for the optional semantic path (v2 upgrade). */
export interface Embedder {
  dims: number
  embed(texts: string[]): Promise<number[][]>
}

// ---------------------------------------------------------------------------
// Embedder: pluggable semantic backend. Default = local OpenAI-compatible
// server (Ollama `nomic-embed-text` at localhost:11434). Lexical fallback when
// no embedder is reachable, so the tool always works offline.
// ---------------------------------------------------------------------------

/** OpenAI-compatible embeddings endpoint (Ollama, LM Studio, etc.). */
class HttpEmbedder implements Embedder {
  dims = 0
  constructor(
    private baseUrl: string,
    private model: string,
  ) {}
  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: texts }),
    })
    if (!res.ok) throw new Error(`embed http ${res.status}`)
    const j = (await res.json()) as { data: { embedding: number[] }[] }
    const out = j.data.map((d) => d.embedding)
    if (this.dims === 0 && out[0]) this.dims = out[0].length
    return out
  }
}

let embedderWarningShown = false

/**
 * Resolve the default embedder. Returns null (and warns once) when no local
 * embedding server is reachable, so the caller falls back to lexical search.
 */
export async function resolveDefaultEmbedder(): Promise<Embedder | null> {
  const url = process.env.CODE_INDEX_EMBEDDER_URL ?? 'http://localhost:11434/v1'
  const model = process.env.CODE_INDEX_EMBEDDER_MODEL ?? 'nomic-embed-text'
  const emb = new HttpEmbedder(url, model)
  try {
    // Probe with a tiny input to learn dims + confirm reachability.
    await emb.embed(['probe'])
    return emb
  } catch {
    if (!embedderWarningShown) {
      embedderWarningShown = true
      console.error(
        `[code-index] no local embedder at ${url} (model ${model}); using lexical search only. ` +
          `Set CODE_INDEX_EMBEDDER_URL / CODE_INDEX_EMBEDDER_MODEL to enable semantic.`,
      )
    }
    return null
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  const d = Math.sqrt(na) * Math.sqrt(nb)
  return d === 0 ? 0 : dot / d
}

// ---------------------------------------------------------------------------
// Chunking: structural (brace-matched) with an optional tree-sitter fast path.
// ---------------------------------------------------------------------------

// Declaration heads that open a definition we want as a retrieval unit.
const DECL_RE =
  /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum|struct|impl|const|let|var)\b|^\s*(?:export\s+)?(?:async\s+)?function\s*\*?\s*[A-Za-z_$][\w$]*|^\s*[A-Za-z_$][\w$]*(?:\s*<[^>]*>)?\s*[=:]\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>)/gm

function lineOf(text: string, idx: number): number {
  let line = 1
  for (let i = 0; i < idx && i < text.length; i++) {
    if (text[i] === '\n') line++
  }
  return line
}

/** Brace-match from the first `{` at/after `from`. String/comment/template aware. */
function matchBrace(text: string, from: number): number {
  let depth = 0
  let i = from
  let inStr: string | null = null
  let inTmpl = false
  let inLine = false
  let inBlock = false
  while (i < text.length) {
    const c = text[i]!
    const n = text[i + 1]
    if (inLine) {
      if (c === '\n') inLine = false
      i++
      continue
    }
    if (inBlock) {
      if (c === '*' && n === '/') {
        inBlock = false
        i += 2
        continue
      }
      i++
      continue
    }
    if (inStr) {
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === inStr) inStr = null
      i++
      continue
    }
    if (inTmpl) {
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === '`') inTmpl = false
      i++
      continue
    }
    if (c === '/' && n === '/') {
      inLine = true
      i += 2
      continue
    }
    if (c === '/' && n === '/') {
      // handled above; safety
    }
    if (c === '/' && n === '*') {
      inBlock = true
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      if (c === '`') inTmpl = true
      else inStr = c
      i++
      continue
    }
    if (c === '{') {
      depth++
      i++
      continue
    }
    if (c === '}') {
      depth--
      if (depth === 0) return i
      i++
      continue
    }
    i++
  }
  return -1
}

function extractSymbol(head: string): string {
  const m =
    head.match(/(?:function|class|interface|type|enum|struct|impl|const|let|var)\s+([A-Za-z_$][\w$]*)/) ??
    head.match(/([A-Za-z_$][\w$]*)\s*[=:]/)
  return m ? m[1]!.slice(0, 80) : '(anonymous)'
}

/** Structural chunker: split a file into definition-boundary chunks. */
export function chunkFile(relPath: string, text: string): Chunk[] {
  const chunks: Chunk[] = []
  const lines = text.split('\n')
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 16)

  let m: RegExpExecArray | null
  DECL_RE.lastIndex = 0
  const heads: { idx: number; symbol: string }[] = []
  while (true) {
    m = DECL_RE.exec(text)
    if (m === null) break
    heads.push({ idx: m.index, symbol: extractSymbol(m[0]) })
  }
  if (heads.length === 0) {
    // No declarations found: emit the whole file as one chunk so it is still searchable.
    chunks.push({ path: relPath, symbol: basename(relPath), kind: 'file', start: 1, end: lines.length, content: text, hash })
    return chunks.flatMap((c) => enforceChunkSize(c))
  }

  for (let h = 0; h < heads.length; h++) {
    const startLine = lineOf(text, heads[h]!.idx)
    const nextIdx = h + 1 < heads.length ? heads[h + 1]!.idx : text.length
    const open = text.indexOf('{', heads[h]!.idx)
    let endLine: number
    let body: string
    if (open >= 0 && open < nextIdx) {
      const close = matchBrace(text, open)
      const end = close >= 0 && close < nextIdx ? close : nextIdx - 1
      body = text.slice(heads[h]!.idx, end + 1)
      endLine = lineOf(text, end)
    } else {
      // No brace block (e.g. `export const X = 5`): take up to next head.
      const sliceEnd = nextIdx
      body = text.slice(heads[h]!.idx, sliceEnd).trimEnd()
      endLine = lineOf(text, Math.max(heads[h]!.idx, sliceEnd - 1))
    }
    if (body.trim()) {
      chunks.push({
        path: relPath,
        symbol: heads[h]!.symbol,
        kind: 'def',
        start: startLine,
        end: Math.max(endLine, startLine),
        content: body,
        hash,
      })
    }
  }
  return chunks.flatMap((c) => enforceChunkSize(c))
}

/** Split a chunk that exceeds MAX_CHUNK_BYTES into sequential sub-chunks. */
function enforceChunkSize(c: Chunk): Chunk[] {
  if (c.content.length <= MAX_CHUNK_BYTES) return [c]
  const lines = c.content.split('\n')
  const out: Chunk[] = []
  let acc: string[] = []
  let accBytes = 0
  let startLine = c.start
  for (const ln of lines) {
    if (accBytes + ln.length + 1 > MAX_CHUNK_BYTES && acc.length) {
      const content = acc.join('\n')
      out.push({
        ...c,
        start: startLine,
        end: startLine + acc.length - 1,
        content,
      })
      startLine += acc.length
      acc = []
      accBytes = 0
    }
    acc.push(ln)
    accBytes += ln.length + 1
  }
  if (acc.length) {
    out.push({
      ...c,
      start: startLine,
      end: startLine + acc.length - 1,
      content: acc.join('\n'),
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Walking
// ---------------------------------------------------------------------------

function loadIgnore(root: string): (rel: string) => boolean {
  const file = join(root, '.codeindexignore')
  if (!existsSync(file)) return () => false
  const pats = readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  if (pats.length === 0) return () => false
  return (rel: string) => {
    const norm = rel.split('\\').join('/')
    return pats.some((p) => {
      const pp = p.replace(/[/\\]/g, '/')
      if (pp.endsWith('/')) return norm.startsWith(pp) || norm === pp.slice(0, -1)
      if (pp.includes('*')) return new RegExp('^' + pp.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(norm)
      return norm === pp || norm.endsWith('/' + pp)
    })
  }
}

export function walk(root: string): string[] {
  const out: string[] = []
  const isIgnored = loadIgnore(root)
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()!
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const e of entries) {
      const full = join(dir, e)
      let st: Stats
      try {
        st = statSync(full)
      } catch {
        continue
      }
      const rel = relative(root, full)
      if (isIgnored(rel)) continue
      if (st.isDirectory()) {
        if (IGNORE_DIRS.has(e)) continue
        stack.push(full)
      } else if (st.isFile()) {
        const ext = e.includes('.') ? e.split('.').pop()!.toLowerCase() : ''
        if (!SUPPORTED_EXT.has(ext)) continue
        if (st.size > MAX_FILE_BYTES) continue
        out.push(full)
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Index storage (Bun.sqlite FTS5, external-content)
// ---------------------------------------------------------------------------

export function openDb(dbPath: string): Database {
  const dir = dirnameSafe(dbPath)
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })
  const db = new Database(dbPath, { create: true })
  db.run('PRAGMA journal_mode = WAL')
  db.run(`CREATE TABLE IF NOT EXISTS files(
    path TEXT PRIMARY KEY, hash TEXT)`)
  db.run(`CREATE TABLE IF NOT EXISTS chunks(
    rowid INTEGER PRIMARY KEY, path TEXT, symbol TEXT, kind TEXT,
    start INT, end INT, content TEXT, hash TEXT, embedding TEXT)`)
  db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    path, symbol, kind, start, end, hash, content,
    content='chunks', content_rowid='rowid')`)
  db.run(`CREATE TABLE IF NOT EXISTS meta(
    k TEXT PRIMARY KEY, v TEXT)`)
  // Safe migration: add embedding column if an older DB lacks it.
  const cols = db.query('PRAGMA table_info(chunks)').all() as { name: string }[]
  if (!cols.some((c) => c.name === 'embedding')) {
    db.run('ALTER TABLE chunks ADD COLUMN embedding TEXT')
  }
  return db
}

function dirnameSafe(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i < 0 ? '' : p.slice(0, i)
}

function setMeta(db: Database, k: string, v: string) {
  db.run('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', [k, v])
}

function deleteChunk(db: Database, rowid: number) {
  db.run('DELETE FROM chunks_fts WHERE rowid=?', [rowid])
  db.run('DELETE FROM chunks WHERE rowid=?', [rowid])
}

function insertChunk(db: Database, c: Chunk, embedding: string | null): number {
  const info = db.run(
    'INSERT INTO chunks(path,symbol,kind,start,end,content,hash,embedding) VALUES(?,?,?,?,?,?,?,?)',
    [c.path, c.symbol, c.kind, c.start, c.end, c.content, c.hash, embedding],
  )
  const rowid = Number(info.lastInsertRowid)
  db.run(
    'INSERT INTO chunks_fts(rowid,path,symbol,kind,start,end,hash,content) VALUES(?,?,?,?,?,?,?,?)',
    [rowid, c.path, c.symbol, c.kind, c.start, c.end, c.hash, c.content],
  )
  return rowid
}

/** Build/update the index. Incremental: only re-chunk files whose hash changed. */
export async function buildIndex(
  roots: string | string[],
  db: Database,
  base = process.cwd(),
  embedder: Embedder | null = null,
): Promise<{ indexed: number; skipped: number; chunks: number }> {
  const rootList = Array.isArray(roots) ? roots : [roots]
  const baseAbs = resolve(base)
  let files: string[] = []
  for (const r of rootList) {
    const absRoot = resolve(baseAbs, r)
    if (existsSync(absRoot)) files = files.concat(walk(absRoot))
  }
  let indexed = 0
  let skipped = 0
  let chunkCount = 0
  const known = new Set<string>()
  db.run('BEGIN')
  for (const full of files) {
    const rel = relative(baseAbs, full).split('\\').join('/')
    known.add(rel)
    let text: string
    try {
      text = readFileSync(full, 'utf8')
    } catch {
      continue
    }
    const hash = createHash('sha256').update(text).digest('hex').slice(0, 16)
    const prev = db.query('SELECT hash FROM files WHERE path=?').get(rel) as { hash: string } | null
    if (prev && prev.hash === hash) {
      skipped++
      continue
    }
    const oldRows = db.query('SELECT rowid FROM chunks WHERE path=?').all(rel) as { rowid: number }[]
    for (const r of oldRows) deleteChunk(db, r.rowid)
    const chunks = chunkFile(rel, text)
    const rowids: number[] = []
    for (const c of chunks) {
      rowids.push(insertChunk(db, c, null))
      chunkCount++
    }
    if (embedder && rowids.length) {
      try {
        const vecs = await embedder.embed(chunks.map((c) => c.content))
        for (let i = 0; i < rowids.length; i++) {
          db.run('UPDATE chunks SET embedding=? WHERE rowid=?', [JSON.stringify(vecs[i]), rowids[i]!])
        }
      } catch (e) {
        console.error(`[code-index] embedding failed for ${rel}: ${String(e)}`)
      }
    }
    db.run('INSERT INTO files(path,hash) VALUES(?,?) ON CONFLICT(path) DO UPDATE SET hash=excluded.hash', [rel, hash])
    indexed++
  }
  // Drop files no longer present.
  const allFiles = db.query('SELECT path FROM files').all() as { path: string }[]
  for (const f of allFiles) {
    if (!known.has(f.path)) {
      const oldRows = db.query('SELECT rowid FROM chunks WHERE path=?').all(f.path) as { rowid: number }[]
      for (const r of oldRows) {
        db.run('DELETE FROM chunks_fts WHERE rowid=?', [r.rowid])
        db.run('DELETE FROM chunks WHERE rowid=?', [r.rowid])
      }
      db.run('DELETE FROM files WHERE path=?', [f.path])
    }
  }
  db.run('COMMIT')
  setMeta(db, 'root', baseAbs)
  setMeta(db, 'updated', new Date().toISOString())
  return { indexed, skipped, chunks: chunkCount }
}

// ---------------------------------------------------------------------------
// Search: FTS5 (bm25) lexical; RRF fusion when embeddings present.
// ---------------------------------------------------------------------------

function rrfScore(rankLists: number[][], k = 60): Map<number, number> {
  const scores = new Map<number, number>()
  for (const list of rankLists) {
    list.forEach((id, i) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1))
    })
  }
  return scores
}

export async function searchIndex(
  db: Database,
  query: string,
  opts: { k?: number; tokenBudget?: number; embedder?: Embedder | null } = {},
): Promise<SearchHit[]> {
  const k = opts.k ?? 8
  const tokenBudget = opts.tokenBudget ?? 4000

  // Lexical list (rowids ranked by bm25).
  const lexRows = db
    .query(
      `SELECT rowid, path, symbol, kind, start, end, content, bm25(chunks_fts) AS rank
       FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY rank LIMIT ?`,
      [query, k * 3],
    )
    .all(query, k * 3) as any[]

  const rankLists: number[][] = [lexRows.map((r) => r.rowid)]

  // Semantic list (cosine over stored embeddings) fused via RRF when available.
  if (opts.embedder) {
    try {
      const [qv] = await opts.embedder.embed([query])
      if (qv && qv.length) {
        const rows = db
          .query('SELECT rowid, embedding FROM chunks WHERE embedding IS NOT NULL')
          .all() as { rowid: number; embedding: string }[]
        const scored = rows
          .map((r) => ({ rowid: r.rowid, s: cosine(qv, JSON.parse(r.embedding) as number[]) }))
          .sort((a, b) => b.s - a.s)
          .slice(0, k * 3)
          .map((r) => r.rowid)
        rankLists.push(scored)
      }
    } catch {
      /* fall back to lexical only */
    }
  }

  const fused = rrfScore(rankLists)
  const ordered = [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([rowid]) => lexRows.find((r) => r.rowid === rowid)!)
    .filter(Boolean)
    .slice(0, k)

  let used = 0
  const out: SearchHit[] = []
  for (const r of ordered) {
    const cost = r.content.length
    if (used + cost > tokenBudget && out.length) break
    out.push({
      path: r.path,
      symbol: r.symbol,
      kind: r.kind,
      lines: [r.start, r.end],
      snippet: r.content,
    })
    used += cost
  }
  return out
}

export function statsIndex(db: Database): { files: number; chunks: number; root: string; updated: string } {
  const files = (db.query('SELECT COUNT(*) AS n FROM files').get() as any).n
  const chunks = (db.query('SELECT COUNT(*) AS n FROM chunks').get() as any).n
  const root = ((db.query("SELECT v FROM meta WHERE k='root'").get() as any) ?? { v: '' }).v
  const updated = ((db.query("SELECT v FROM meta WHERE k='updated'").get() as any) ?? { v: '' }).v
  return { files, chunks, root, updated }
}

// ---------------------------------------------------------------------------
// Watch mode
// ---------------------------------------------------------------------------

export function startWatch(roots: string | string[], db: Database, base = process.cwd(), embedder: Embedder | null = null): () => void {
  const rootList = Array.isArray(roots) ? roots : [roots]
  const baseAbs = resolve(base)
  const ac = new AbortController()
  const watcher = fsWatch(baseAbs, { recursive: true, signal: ac.signal }, (event, filename) => {
    if (!filename) return
    const full = join(baseAbs, filename.toString())
    if (!existsSync(full) || !statSync(full).isFile()) return
    const rel = relative(baseAbs, full).split('\\').join('/')
    if (IGNORE_DIRS.has(rel.split('/')[0] ?? '')) return
    const ext = rel.includes('.') ? rel.split('.').pop()!.toLowerCase() : ''
    if (!SUPPORTED_EXT.has(ext)) return
    if (!rootList.some((r) => rel === r || rel.startsWith(r + '/'))) return
    void reindexFile(db, rel, full, embedder)
  })
  return () => {
    ac.abort()
    watcher.close()
  }
}

async function reindexFile(db: Database, rel: string, full: string, embedder: Embedder | null) {
  try {
    const text = readFileSync(full, 'utf8')
    const hash = createHash('sha256').update(text).digest('hex').slice(0, 16)
    const prev = db.query('SELECT hash FROM files WHERE path=?').get(rel) as { hash: string } | null
    if (prev && prev.hash === hash) return
    const oldRows = db.query('SELECT rowid FROM chunks WHERE path=?').all(rel) as { rowid: number }[]
    for (const r of oldRows) deleteChunk(db, r.rowid)
    const chunks = chunkFile(rel, text)
    const rowids: number[] = []
    for (const c of chunks) rowids.push(insertChunk(db, c, null))
    if (embedder && rowids.length) {
      try {
        const vecs = await embedder.embed(chunks.map((c) => c.content))
        for (let i = 0; i < rowids.length; i++) {
          db.run('UPDATE chunks SET embedding=? WHERE rowid=?', [JSON.stringify(vecs[i]), rowids[i]!])
        }
      } catch {
        /* ignore embedding failure on live update */
      }
    }
    db.run('INSERT INTO files(path,hash) VALUES(?,?) ON CONFLICT(path) DO UPDATE SET hash=excluded.hash', [rel, hash])
  } catch {
    /* ignore transient read errors */
  }
}

// ---------------------------------------------------------------------------
// MCP server (stdio, JSON-RPC 2.0) — top-level agent surface.
// ---------------------------------------------------------------------------

const MCP_TOOLS = [
  {
    name: 'code_index_search',
    description:
      'Hybrid lexical search over the locally-indexed codebase. Returns ranked path:line chunks within a token budget. Use instead of grep/read for code discovery.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language or identifier query' },
        k: { type: 'number', description: 'Max hits (default 8)' },
        tokenBudget: { type: 'number', description: 'Max chars of snippet returned (default 4000)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'code_index_stats',
    description: 'Index statistics: file count, chunk count, root, last update.',
    inputSchema: { type: 'object', properties: {} },
  },
]

function mcpRespond(id: unknown, result: unknown) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
}
function mcpError(id: unknown, code: number, message: string) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n')
}

export function runMcp(dbPath: string) {
  const db = openDb(dbPath)
  let buf = ''
  process.stdin.on('data', (d: Buffer) => {
    buf += d.toString()
    let nl: number
    while (true) {
      nl = buf.indexOf('\n')
      if (nl < 0) break
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      let msg: any
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      void handle(msg)
    }
  })
  async function handle(msg: any) {
    if (msg.method === 'initialize') {
      mcpRespond(msg.id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'devops-code-index', version: '1.0.0' },
      })
    } else if (msg.method === 'tools/list') {
      mcpRespond(msg.id, { tools: MCP_TOOLS })
    } else if (msg.method === 'tools/call') {
      const name: string = msg.params?.name
      const a = msg.params?.arguments ?? {}
      try {
        if (name === 'code_index_search') {
          const hits = await searchIndex(db, String(a.query), { k: a.k ?? 8, tokenBudget: a.tokenBudget ?? 4000 })
          mcpRespond(msg.id, {
            content: [{ type: 'text', text: JSON.stringify(hits, null, 2) }],
            isError: false,
          })
        } else if (name === 'code_index_stats') {
          mcpRespond(msg.id, {
            content: [{ type: 'text', text: JSON.stringify(statsIndex(db), null, 2) }],
            isError: false,
          })
        } else {
          mcpError(msg.id, -32601, `unknown tool: ${name}`)
        }
      } catch (e: any) {
        mcpError(msg.id, -32603, String(e?.message ?? e))
      }
    } else if (msg.method === 'ping') {
      mcpRespond(msg.id, {})
    }
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq >= 0) flags[a.slice(2, eq)] = a.slice(eq + 1)
      else flags[a.slice(2)] = true
    } else if (a.startsWith('-') && a.length > 1) {
      flags[a.slice(1)] = true
    } else positional.push(a)
  }
  return { positional, flags }
}

export async function mainCli(argv: string[]) {
  const { positional, flags } = parseArgs(argv)
  const dbPath: string = typeof flags.db === 'string' ? flags.db : DEFAULT_DB
  const sub = positional[0] ?? 'index'
  const explicitPath = positional[1]

  // Scope (interview Q1): default to code-only roots; --all for whole repo.
  const roots: string[] = explicitPath
    ? [explicitPath]
    : flags.all
      ? ['.']
      : CODE_ROOTS

  switch (sub) {
    case 'index': {
      const db = openDb(dbPath)
      const embedder = flags['no-embed'] ? null : await resolveDefaultEmbedder()
      const r = await buildIndex(roots, db, process.cwd(), embedder)
      console.log(JSON.stringify({ ok: true, embedder: embedder ? 'semantic' : 'lexical', ...r }))
      // Watch mode is the default during coding sessions (interview Q2).
      if (!flags['no-watch']) {
        const stop = startWatch(roots, db, process.cwd(), embedder)
        console.log(`watching ${roots.join(', ')} (ctrl-c to stop)`)
        process.on('SIGINT', () => {
          stop()
          process.exit(0)
        })
      }
      break
    }
    case 'search': {
      const query = positional.slice(1).join(' ') || flags.query
      if (!query) {
        console.error('usage: devops code-index search <query> [--k=N] [--token-budget=N] [--json] [--no-embed]')
        process.exit(1)
      }
      const db = openDb(dbPath)
      const embedder = flags['no-embed'] ? null : await resolveDefaultEmbedder()
      const hits = await searchIndex(db, query, {
        k: typeof flags.k === 'string' ? Number(flags.k) : 8,
        tokenBudget: typeof flags['token-budget'] === 'string' ? Number(flags['token-budget']) : 4000,
        embedder,
      })
      if (flags.json) {
        console.log(JSON.stringify(hits, null, 2))
      } else {
        for (const h of hits) {
          console.log(`\n${h.path}:${h.lines[0]}-${h.lines[1]}  [${h.kind}] ${h.symbol}`)
          console.log(h.snippet.split('\n').slice(0, 12).join('\n'))
        }
      }
      break
    }
    case 'stats': {
      const db = openDb(dbPath)
      console.log(JSON.stringify(statsIndex(db), null, 2))
      break
    }
    case 'watch': {
      const db = openDb(dbPath)
      const embedder = flags['no-embed'] ? null : await resolveDefaultEmbedder()
      await buildIndex(roots, db, process.cwd(), embedder)
      const stop = startWatch(roots, db, process.cwd(), embedder)
      console.log(`watching ${roots.join(', ')} (ctrl-c to stop)`)
      process.on('SIGINT', () => {
        stop()
        process.exit(0)
      })
      break
    }
    case 'mcp': {
      runMcp(dbPath)
      break
    }
    case 'clear': {
      if (existsSync(dbPath)) rmSync(dbPath)
      console.log(`cleared ${dbPath}`)
      break
    }
    default: {
      console.error(
        'usage: devops code-index <index|search|stats|watch|mcp|clear> [path] [--all] [--no-embed] [--no-watch] [--db=...] [--k=N] [--token-budget=N] [--json]',
      )
      process.exit(1)
    }
  }
}

// Allow direct `bun devops/code-index.ts` execution during dev.
if (import.meta.main) {
  mainCli(process.argv.slice(2)).catch((e) => {
    console.error(String(e))
    process.exit(1)
  })
}
