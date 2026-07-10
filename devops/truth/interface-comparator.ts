// devops/truth/interface-comparator.ts
// Interface Comparator — compares exported interfaces/types to actual class implementations
//
// For each exported interface, finds the implementing class and checks if every
// declared method has a real (non-stub) implementation.

import { readFile } from 'node:fs/promises'
import type { FileReport, ScanResult } from './scanner.ts'

export interface MethodStatus {
  name: string
  declared: boolean    // exists in interface
  implemented: boolean // exists in class
  stub: boolean        // implementation is a stub
  line?: number        // line number in implementation
}

export interface InterfaceComparison {
  interfaceName: string
  interfaceFile: string
  implementingClass: string
  implementingFile: string
  methods: MethodStatus[]
  score: number        // implemented / declared (0-1)
  status: 'COMPLETE' | 'PARTIAL' | 'STUB' | 'MISSING'
}

export interface InterfaceComparisonResult {
  timestamp: string
  totalInterfaces: number
  complete: InterfaceComparison[]
  partial: InterfaceComparison[]
  stub: InterfaceComparison[]
  missing: InterfaceComparison[]
  summary: string
}

// ── Extract method names from interface ────────────────────────────────────

function extractInterfaceMethods(content: string, interfaceName: string): string[] {
  const methods: string[] = []
  // Find the interface block
  const ifaceRe = new RegExp(`export\\s+interface\\s+${interfaceName}\\s*\\{`, 'g')
  const match = ifaceRe.exec(content)
  if (!match) return methods

  let depth = 0
  let inBlock = false
  const lines = content.split('\n')
  const startLine = content.slice(0, match.index).split('\n').length

  for (let i = startLine - 1; i < lines.length; i++) {
    const line = lines[i]!
    for (const ch of line) {
      if (ch === '{') { depth++; inBlock = true }
      if (ch === '}') { depth--; if (depth === 0) break }
    }
    if (depth === 0 && inBlock) break

    // Match method signatures: name(...): or name(...): 
    const methodMatch = line.match(/^\s*(?:readonly\s+)?(\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)\s*:/)
    if (methodMatch) {
      methods.push(methodMatch[1]!)
    }
  }

  return methods
}

// ── Extract method implementations from class ──────────────────────────────

function extractClassMethods(content: string, className: string): Map<string, { line: number; stub: boolean }> {
  const methods = new Map<string, { line: number; stub: boolean }>()

  const classRe = new RegExp(`export\\s+class\\s+${className}`, 'g')
  const match = classRe.exec(content)
  if (!match) return methods

  let depth = 0
  let inBlock = false
  const lines = content.split('\n')
  const startLine = content.slice(0, match.index).split('\n').length

  for (let i = startLine - 1; i < lines.length; i++) {
    const line = lines[i]!
    for (const ch of line) {
      if (ch === '{') { depth++; inBlock = true }
      if (ch === '}') { depth--; if (depth === 0) break }
    }
    if (depth === 0 && inBlock) break

    // Match async/sync method definitions
    const methodMatch = line.match(/^\s*(?:async\s+)?(\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)\s*[:{]/)
    if (methodMatch && methodMatch[1] !== 'constructor') {
      // Check if method body is a stub
      const isStub = /\/\/\s*(v\d+\s+)?stub/i.test(line) ||
                     /\{\s*\}/.test(line) ||
                     /\{\s*return\s+(?:\{\}|\[\])/.test(line)
      methods.set(methodMatch[1]!, { line: i + 1, stub: isStub })
    }
  }

  return methods
}

// ── Match interfaces to implementing classes ───────────────────────────────

function findImplementingClass(
  interfaceName: string,
  files: FileReport[],
): { className: string; file: FileReport } | undefined {
  // Strategy 1: Look for class that implements the interface
  // Strategy 2: Look for class with same name prefix (e.g. ChromeGovernor implements Governor)
  // Strategy 3: Look in same file as interface

  for (const file of files) {
    // Check exports for implementing class
    for (const exp of file.exports) {
      if (exp.startsWith('class:')) {
        const className = exp.slice(6)
        // Name match: GovernorInterface -> Governor, GovernorStore -> Governor
        const baseName = interfaceName.replace(/Interface$/, '').replace(/Store$/, '').replace(/Contract$/, '')
        if (className.includes(baseName) || baseName.includes(className)) {
          return { className, file }
        }
      }
    }
  }

  // Fallback: check same file
  for (const file of files) {
    if (file.interfaces.includes(interfaceName)) {
      for (const exp of file.exports) {
        if (exp.startsWith('class:')) {
          return { className: exp.slice(6), file }
        }
      }
    }
  }

  return undefined
}

// ── Main comparison ───────────────────────────────────────────────────────

export async function compareInterfaces(scan: ScanResult): Promise<InterfaceComparisonResult> {
  const complete: InterfaceComparison[] = []
  const partial: InterfaceComparison[] = []
  const stub: InterfaceComparison[] = []
  const missing: InterfaceComparison[] = []

  // Collect all exported interfaces
  const allInterfaces: { name: string; file: FileReport }[] = []
  for (const file of scan.files) {
    for (const iface of file.interfaces) {
      allInterfaces.push({ name: iface, file })
    }
  }

  for (const { name: ifaceName, file: ifaceFile } of allInterfaces) {
    const impl = findImplementingClass(ifaceName, scan.files)

    if (!impl) {
      missing.push({
        interfaceName: ifaceName,
        interfaceFile: ifaceFile.relativePath,
        implementingClass: '(none)',
        implementingFile: '(none)',
        methods: [],
        score: 0,
        status: 'MISSING',
      })
      continue
    }

    // Read both files to compare methods
    const [ifaceContent, implContent] = await Promise.all([
      readFile(ifaceFile.path, 'utf8'),
      readFile(impl.file.path, 'utf8'),
    ])

    const declaredMethods = extractInterfaceMethods(ifaceContent, ifaceName)
    const implementedMethods = extractClassMethods(implContent, impl.className)

    const methods: MethodStatus[] = declaredMethods.map((m) => {
      const impl = implementedMethods.get(m)
      return {
        name: m,
        declared: true,
        implemented: !!impl,
        stub: impl?.stub ?? false,
        line: impl?.line,
      }
    })

    const implementedCount = methods.filter((m) => m.implemented && !m.stub).length
    const score = declaredMethods.length > 0 ? implementedCount / declaredMethods.length : 0

    let status: InterfaceComparison['status']
    if (score === 1) status = 'COMPLETE'
    else if (score > 0) status = 'PARTIAL'
    else if (methods.some((m) => m.implemented && m.stub)) status = 'STUB'
    else status = 'MISSING'

    const comparison: InterfaceComparison = {
      interfaceName: ifaceName,
      interfaceFile: ifaceFile.relativePath,
      implementingClass: impl.className,
      implementingFile: impl.file.relativePath,
      methods,
      score,
      status,
    }

    if (status === 'COMPLETE') complete.push(comparison)
    else if (status === 'PARTIAL') partial.push(comparison)
    else if (status === 'STUB') stub.push(comparison)
    else missing.push(comparison)
  }

  const totalInterfaces = allInterfaces.length
  const summary = [
    `Interfaces: ${totalInterfaces}`,
    `COMPLETE: ${complete.length} | PARTIAL: ${partial.length} | STUB: ${stub.length} | MISSING: ${missing.length}`,
  ].join('\n')

  return {
    timestamp: new Date().toISOString(),
    totalInterfaces,
    complete,
    partial,
    stub,
    missing,
    summary,
  }
}
