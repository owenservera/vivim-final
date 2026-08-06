// devops/deep-scan/passes/cross-surface.ts
// P08 static cross-surface parity check. Complements the audit-arch `commands`
// pass (capability <-> NL catalog <-> frontend actions) with a static surface
// check: every capability declaring a surface should bind a cliCommand / ui /
// mcpToolName / apiEndpoint consistently.
//
// Security excluded by design. Deterministic, local-only (no web, no server).

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { buildFinding, type Finding } from '../../audit-code/findings.ts'
import { PROJECT_ROOT } from '../../audit-code/scan.ts'

interface CapBinding {
  id: string
  file: string
  surfaces: string[]
  cliCommand?: string
  ui?: string
  mcpToolName?: string
  apiEndpoint?: string
}

// Statically extract capability surface declarations from the capability
// definition modules (makeCapability / registerSessionCaps patterns).
const CAP_FILE_GLOBS = [
  'src/engines/*caps.ts',
  'src/engines/capability-bootstrap.ts',
]

async function loadCapBindings(): Promise<CapBinding[]> {
  const out: CapBinding[] = []
  for (const glob of CAP_FILE_GLOBS) {
    const base = join(PROJECT_ROOT, glob.split('*')[0]!)
    let files: string[]
    try {
      files = (await readdir(base)).filter((f) => f.endsWith('caps.ts'))
    } catch {
      continue
    }
    for (const f of files) {
      const abs = join(base, f)
      let text: string
      try {
        text = await readFile(abs, 'utf8')
      } catch {
        continue
      }
      // Find makeCapability({ ... }) blocks and extract id + surfaces.
      const blocks = text.match(/makeCapability\s*\(\s*\{[^}]*?\}/gs) ?? []
      for (const b of blocks) {
        const id = b.match(/\bid\s*:\s*['"]([^'"]+)['"]/)?.[1]
        if (!id) continue
        const surfaces = b.match(/surfaces\s*:\s*\[([^\]]*)\]/)?.[1] ?? ''
        const surfList = [...surfaces.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]!)
        const cliCommand = b.match(/cliCommand\s*:\s*['"]([^'"]+)['"]/)?.[1]
        const ui = b.match(/\bui\s*:\s*['"]([^'"]+)['"]/)?.[1]
        const mcpToolName = b.match(/mcpToolName\s*:\s*['"]([^'"]+)['"]/)?.[1]
        const apiEndpoint = b.match(/apiEndpoint\s*:\s*['"]([^'"]+)['"]/)?.[1]
        out.push({ id, file: join('src', 'engines', f), surfaces: surfList, cliCommand, ui, mcpToolName, apiEndpoint })
      }
    }
  }
  return out
}

export async function checkCrossSurfaceStatic(): Promise<Finding[]> {
  const out: Finding[] = []
  const caps = await loadCapBindings()
  if (caps.length === 0) return out

  for (const c of caps) {
    const wantsCli = c.surfaces.includes('cli')
    const wantsUi = c.surfaces.includes('ui')
    const wantsMcp = c.surfaces.includes('mcp')
    const wantsApi = c.surfaces.includes('api')

    // Surface declared but binding missing (P2, mirrors audit-arch priority).
    if (wantsCli && !c.cliCommand && !c.apiEndpoint) {
      out.push(
        buildFinding({
          priority: 'P2',
          dimension: 'commands',
          title: `cli surface declared without cliCommand: ${c.id}`,
          description: `Capability ${c.id} declares the 'cli' surface but has no cliCommand or apiEndpoint binding.`,
          file: c.file,
          line: 0,
          evidence: c.id,
          impact: 'The capability is not reachable from the CLI surface.',
          fixSummary: 'Add cliCommand (and a catalog pattern) for the capability.',
          fixSteps: [
            'Add cliCommand to the makeCapability block.',
            'Bind an NL pattern in src/engines/nlcl/catalog.ts.',
          ],
          effort: 'S',
          autoFixable: false,
        }),
      )
    }
    if (wantsUi && !c.ui) {
      out.push(
        buildFinding({
          priority: 'P2',
          dimension: 'commands',
          title: `ui surface declared without ui binding: ${c.id}`,
          description: `Capability ${c.id} declares the 'ui' surface but has no ui component binding.`,
          file: c.file,
          line: 0,
          evidence: c.id,
          impact: 'The capability cannot be surfaced in the UI.',
          fixSummary: 'Provide a ui component reference or a generic fallback renderer.',
          fixSteps: ['Add ui to the makeCapability block.', 'Register a renderer in the frontend registry.'],
          effort: 'M',
          autoFixable: false,
        }),
      )
    }
    if (wantsMcp && !c.mcpToolName) {
      out.push(
        buildFinding({
          priority: 'P2',
          dimension: 'commands',
          title: `mcp surface declared without mcpToolName: ${c.id}`,
          description: `Capability ${c.id} declares the 'mcp' surface but has no mcpToolName binding.`,
          file: c.file,
          line: 0,
          evidence: c.id,
          impact: 'The capability is not exposed as an MCP tool.',
          fixSummary: 'Add mcpToolName to the makeCapability block.',
          fixSteps: ['Add mcpToolName.', 'Confirm the MCP surface picks it up at boot.'],
          effort: 'S',
          autoFixable: false,
        }),
      )
    }
  }
  return out
}

