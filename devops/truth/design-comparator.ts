// devops/truth/design-comparator.ts
// Design Comparator — reads design docs, extracts what they say should exist,
// compares to actual code scanner results.
//
// Three-way comparison:
//   1. Design docs (docs/merged-design-v2/*.md) — what the design says should exist
//   2. Code contracts (src/engines/*.ts exports/types) — what the code interface says
//   3. Implementations (class bodies, src/executor/*.ts) — what actually works

import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { ScanResult, FileReport } from './scanner.ts'

// ── Design Doc Extraction ─────────────────────────────────────────────────

export interface DesignClaim {
  source: string         // which design doc
  line: number           // line number in doc
  type: 'engine' | 'store' | 'schema' | 'api' | 'seed' | 'file'
  name: string           // e.g. "ChromeGovernor", "GovernorStore", "prisma/schema.prisma"
  detail: string         // the actual text from the doc
  claimedFile?: string   // if doc says "create src/engines/foo.ts"
  claimedInterface?: string // if doc specifies an interface
}

export interface DesignComparisonResult {
  timestamp: string
  totalClaims: number
  claimsByType: Record<string, number>
  verified: DesignClaim[]      // claim matches code
  violated: DesignClaim[]      // claim contradicts code
  unverifiable: DesignClaim[]  // can't determine from code alone
  missingFromDesign: string[]  // code exists but design doesn't mention it
}

// ── File path extraction ──────────────────────────────────────────────────

function extractFilePaths(content: string, docPath: string): DesignClaim[] {
  const claims: DesignClaim[] = []
  const lines = content.split('\n')

  // Pattern: ```\npath/to/file.ts\n``` (code block with just a file path)
  const filePathRe = /^```[\s]*$/
  const pathLineRe = /^(src\/[\w\-/]+\.ts|prisma\/[\w\-/]+\.\w+|seeds\/[\w\-/]+\.\w+|tests\/[\w\-/]+\.ts)$/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (filePathRe.test(line)) {
      // Check next line for file path
      const nextLine = lines[i + 1]?.trim()
      if (nextLine && pathLineRe.test(nextLine)) {
        let fileType: DesignClaim['type'] = 'file'
        if (nextLine.startsWith('src/engines/')) fileType = 'engine'
        else if (nextLine.startsWith('src/storage/')) fileType = 'store'
        else if (nextLine.startsWith('prisma/')) fileType = 'schema'
        else if (nextLine.startsWith('seeds/')) fileType = 'seed'
        else if (nextLine.startsWith('tests/')) fileType = 'api' // test files

        claims.push({
          source: docPath,
          line: i + 1,
          type: fileType,
          name: nextLine.split('/').pop()?.replace(/\.ts$/, '') ?? nextLine,
          detail: nextLine,
          claimedFile: nextLine,
        })
      }
    }
  }

  return claims
}

// ── Interface extraction from design docs ─────────────────────────────────

function extractInterfaceClaims(content: string, docPath: string): DesignClaim[] {
  const claims: DesignClaim[] = []
  const lines = content.split('\n')

  // Pattern: ```typescript\ninterface Foo {\n```
  const ifaceRe = /export\s+interface\s+(\w+)/g
  const classRe = /export\s+class\s+(\w+)/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    let m: RegExpExecArray | null
    ifaceRe.lastIndex = 0
    while ((m = ifaceRe.exec(line))) {
      claims.push({
        source: docPath,
        line: i + 1,
        type: 'engine',
        name: m[1],
        detail: line.trim().slice(0, 100),
        claimedInterface: m[1],
      })
    }

    classRe.lastIndex = 0
    while ((m = classRe.exec(line))) {
      claims.push({
        source: docPath,
        line: i + 1,
        type: 'engine',
        name: m[1],
        detail: line.trim().slice(0, 100),
        claimedInterface: m[1],
      })
    }
  }

  return claims
}

// ── Port claims extraction ────────────────────────────────────────────────

function extractPortClaims(content: string, docPath: string): DesignClaim[] {
  const claims: DesignClaim[] = []
  const lines = content.split('\n')

  // Pattern: "foo.ts → Governor.LifecycleManager" or "port foo.ts"
  const portRe = /(\w[\w\-]*\.ts)\s*→\s*(\w[\w.]+)/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    portRe.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = portRe.exec(line))) {
      claims.push({
        source: docPath,
        line: i + 1,
        type: 'engine',
        name: m[1],
        detail: line.trim().slice(0, 100),
        claimedFile: m[1],
      })
    }
  }

  return claims
}

// ── Main comparison ───────────────────────────────────────────────────────

export async function loadDesignDocs(docsDir: string): Promise<DesignClaim[]> {
  const claims: DesignClaim[] = []
  const entries = await readdir(docsDir)

  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue
    const fullPath = join(docsDir, entry)
    const content = await readFile(fullPath, 'utf8')

    claims.push(...extractFilePaths(content, entry))
    claims.push(...extractInterfaceClaims(content, entry))
    claims.push(...extractPortClaims(content, entry))
  }

  return claims
}

function findMatchingFile(claim: DesignClaim, scan: ScanResult): FileReport | undefined {
  if (!claim.claimedFile) return undefined

  // Normalize the claimed file path
  const claimed = claim.claimedFile.replace(/\\/g, '/')

  return scan.files.find((f) => {
    const rel = f.relativePath
    // Exact match
    if (rel === claimed) return true
    // File name match (design doc might say "foo.ts" but code is at "src/engines/foo.ts")
    if (rel.endsWith('/' + claimed) || rel.endsWith('/src/' + claimed)) return true
    // Base name match
    const baseName = claimed.split('/').pop()
    if (baseName && rel.endsWith('/' + baseName)) return true
    return false
  })
}

function findMatchingInterface(claim: DesignClaim, scan: ScanResult): FileReport | undefined {
  if (!claim.claimedInterface) return undefined

  return scan.files.find((f) => {
    return f.interfaces.includes(claim.claimedInterface!) ||
           f.classes.includes(claim.claimedInterface!) ||
           f.exports.some((e) => e.includes(claim.claimedInterface!))
  })
}

export function compareDesignToCode(
  claims: DesignClaim[],
  scan: ScanResult,
): DesignComparisonResult {
  const verified: DesignClaim[] = []
  const violated: DesignClaim[] = []
  const unverifiable: DesignClaim[] = []

  for (const claim of claims) {
    // Try to find matching file
    const matchingFile = findMatchingFile(claim, scan) ?? findMatchingInterface(claim, scan)

    if (!matchingFile) {
      // Can't find the file — claim is about something that doesn't exist
      unverifiable.push(claim)
      continue
    }

    // File exists — check if it's real or stub
    if (matchingFile.classification === 'REAL') {
      verified.push(claim)
    } else if (matchingFile.classification === 'STUB') {
      violated.push(claim)
    } else if (matchingFile.classification === 'MIXED') {
      // Partially real — still counts as violated for our purposes
      violated.push(claim)
    } else {
      // INTERFACE_ONLY — the interface exists but no implementation
      violated.push(claim)
    }
  }

  // Find code that exists but design doesn't mention
  const mentionedFiles = new Set(
    claims.filter((c) => c.claimedFile).map((c) => c.claimedFile),
  )
  const missingFromDesign = scan.files
    .filter((f) => {
      if (f.classification === 'INTERFACE_ONLY') return false // interfaces are expected
      return !mentionedFiles.has(f.relativePath) &&
             !mentionedFiles.has(f.relativePath.replace(/^src\//, ''))
    })
    .map((f) => f.relativePath)

  const claimsByType: Record<string, number> = {}
  for (const c of claims) {
    claimsByType[c.type] = (claimsByType[c.type] ?? 0) + 1
  }

  return {
    timestamp: new Date().toISOString(),
    totalClaims: claims.length,
    claimsByType,
    verified,
    violated,
    unverifiable,
    missingFromDesign,
  }
}
