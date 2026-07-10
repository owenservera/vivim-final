// devops/truth/scanner.ts
// Code Scanner — reads src/ and classifies each file as REAL, STUB, or INTERFACE-ONLY
//
// Detection heuristics:
//   STUB: "v1 stub" comments, empty methods, throw Error('not implemented'), hardcoded returns
//   REAL: has if/else, loops, try/catch, DB calls, CDP calls, actual data transforms
//   INTERFACE-ONLY: only exports interfaces/types, no class or function implementations

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, extname } from 'node:path'

export type FileClassification = 'REAL' | 'STUB' | 'INTERFACE_ONLY' | 'MIXED'

export interface FileReport {
  path: string
  relativePath: string
  lines: number
  classification: FileClassification
  stubCount: number
  realCount: number
  exports: string[]
  imports: string[]
  stubMarkers: string[]   // line snippets that indicate stubs
  realMarkers: string[]   // line snippets that indicate real logic
  classes: string[]
  interfaces: string[]
  functions: string[]
}

export interface ScanResult {
  root: string
  timestamp: string
  totalFiles: number
  byClassification: Record<FileClassification, number>
  files: FileReport[]
  summary: string
}

// ── Stub detection ────────────────────────────────────────────────────────

const STUB_PATTERNS = [
  /\/\/\s*(v\d+\s+)?stub/i,
  /\/\/\s*TODO/,
  /\/\/\s*FIXME/,
  /throw new Error\(['"]not implemented/i,
  /throw new Error\(['"]stub/i,
  /return\s*\{\s*\}\s*;?\s*$/,           // return {};
  /return\s*\[\s*\]\s*;?\s*$/,           // return [];
  /return\s*\[\]\s*as\s+any/,            // return [] as any
  /return\s*\{\s*\}\s*as\s+any/,         // return {} as any
  /return\s*\{\s*id,\s*result:\s*\{\}\s*\}/, // return { id, result: {} }
  /void\s+\w+\s*;?\s*$/,                 // void variable; (no-op)
]

// ── Real logic detection ──────────────────────────────────────────────────

const REAL_PATTERNS = [
  /\bif\s*\(/,
  /\belse\s*\{/,
  /\bfor\s*\(/,
  /\bwhile\s*\(/,
  /\btry\s*\{/,
  /\bcatch\s*\(/,
  /\bawait\s+/,
  /\bthis\.\w+\(/,
  /\bnew\s+Map\b/,
  /\bnew\s+Set\b/,
  /\.then\(/,
  /\.catch\(/,
  /\.map\(/,
  /\.filter\(/,
  /\.reduce\(/,
  /console\.(log|error|warn)/,
  /process\./,
  /Bun\.(spawn|serve)/,
  /WebSocket/,
  /prisma\./,
]

// ── Classification logic ──────────────────────────────────────────────────

function classifyLine(line: string, trimmed: string): 'stub' | 'real' | 'neutral' {
  // Skip empty lines and pure comments
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
    return 'neutral'
  }

  for (const pattern of STUB_PATTERNS) {
    if (pattern.test(line)) return 'stub'
  }

  for (const pattern of REAL_PATTERNS) {
    if (pattern.test(line)) return 'real'
  }

  return 'neutral'
}

function extractExports(content: string): string[] {
  const exports: string[] = []
  const exportClassRe = /export\s+class\s+(\w+)/g
  const exportInterfaceRe = /export\s+interface\s+(\w+)/g
  const exportTypeRe = /export\s+type\s+(\w+)/g
  const exportFuncRe = /export\s+(?:async\s+)?function\s+(\w+)/g
  const exportConstRe = /export\s+const\s+(\w+)/g

  let m: RegExpExecArray | null
  while ((m = exportClassRe.exec(content))) exports.push(`class:${m[1]}`)
  while ((m = exportInterfaceRe.exec(content))) exports.push(`interface:${m[1]}`)
  while ((m = exportTypeRe.exec(content))) exports.push(`type:${m[1]}`)
  while ((m = exportFuncRe.exec(content))) exports.push(`function:${m[1]}`)
  while ((m = exportConstRe.exec(content))) exports.push(`const:${m[1]}`)

  return exports
}

function extractImports(content: string): string[] {
  const imports: string[] = []
  const importRe = /import\s+(?:type\s+)?(?:{[^}]+}|[\w*]+)\s+from\s+['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = importRe.exec(content))) {
    imports.push(m[1])
  }
  return imports
}

function extractClasses(content: string): string[] {
  const classes: string[] = []
  const re = /export\s+class\s+(\w+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) classes.push(m[1])
  return classes
}

function extractInterfaces(content: string): string[] {
  const interfaces: string[] = []
  const re = /export\s+interface\s+(\w+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) interfaces.push(m[1])
  return interfaces
}

function extractFunctions(content: string): string[] {
  const functions: string[] = []
  const re = /export\s+(?:async\s+)?function\s+(\w+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) functions.push(m[1])
  return functions
}

// ── Main scanner ──────────────────────────────────────────────────────────

export async function scanFile(filePath: string, root: string): Promise<FileReport> {
  const content = await readFile(filePath, 'utf8')
  const lines = content.split('\n')
  const relativePath = relative(root, filePath).replace(/\\/g, '/')

  let stubCount = 0
  let realCount = 0
  const stubMarkers: string[] = []
  const realMarkers: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trim()
    const result = classifyLine(line, trimmed)

    if (result === 'stub') {
      stubCount++
      if (stubMarkers.length < 5) {
        stubMarkers.push(`L${i + 1}: ${trimmed.slice(0, 80)}`)
      }
    } else if (result === 'real') {
      realCount++
      if (realMarkers.length < 5) {
        realMarkers.push(`L${i + 1}: ${trimmed.slice(0, 80)}`)
      }
    }
  }

  const exports = extractExports(content)
  const imports = extractImports(content)
  const classes = extractClasses(content)
  const interfaces = extractInterfaces(content)
  const functions = extractFunctions(content)

  // Classification logic
  let classification: FileClassification
  const hasOnlyInterfaces = classes.length === 0 && functions.length === 0 && interfaces.length > 0

  if (hasOnlyInterfaces && realCount === 0) {
    classification = 'INTERFACE_ONLY'
  } else if (stubCount > 0 && realCount === 0) {
    classification = 'STUB'
  } else if (stubCount > 0 && realCount > 0) {
    classification = 'MIXED'
  } else if (realCount > 0) {
    classification = 'REAL'
  } else {
    // No stub or real markers — check if it has logic
    const hasLogic = lines.some((l) => /\bif\s*\(|\bfor\s*\(|\btry\s*\{|await\s+/.test(l))
    classification = hasLogic ? 'REAL' : 'INTERFACE_ONLY'
  }

  return {
    path: filePath,
    relativePath,
    lines: lines.length,
    classification,
    stubCount,
    realCount,
    exports,
    imports,
    stubMarkers,
    realMarkers,
    classes,
    interfaces,
    functions,
  }
}

export async function scanDirectory(dir: string, root: string): Promise<FileReport[]> {
  const reports: FileReport[] = []
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip node_modules, .git, tmp
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'tmp') continue
      const subReports = await scanDirectory(fullPath, root)
      reports.push(...subReports)
    } else if (entry.isFile() && extname(entry.name) === '.ts') {
      const report = await scanFile(fullPath, root)
      reports.push(report)
    }
  }

  return reports
}

export async function scanRoot(root: string): Promise<ScanResult> {
  const srcDir = join(root, 'src')
  const files = await scanDirectory(srcDir, root)

  const byClassification: Record<FileClassification, number> = {
    REAL: 0,
    STUB: 0,
    INTERFACE_ONLY: 0,
    MIXED: 0,
  }

  for (const f of files) {
    byClassification[f.classification]++
  }

  const summary = [
    `Scanned ${files.length} files in ${srcDir}`,
    `REAL: ${byClassification.REAL} | STUB: ${byClassification.STUB} | INTERFACE_ONLY: ${byClassification.INTERFACE_ONLY} | MIXED: ${byClassification.MIXED}`,
  ].join('\n')

  return {
    root,
    timestamp: new Date().toISOString(),
    totalFiles: files.length,
    byClassification,
    files,
    summary,
  }
}
