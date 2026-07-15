// devops/audit-arch/graph.ts
// Builds a module-level import graph for `src` by parsing import / export-from
// / dynamic import() / require() specifiers and resolving them to in-repo
// modules. This is the shared substrate every architecture pass runs over.
//
// A "module" is a coarse grouping so the graph stays legible and the layering
// policy is tractable:
//   - a file directly under src/  -> module = its basename without extension
//     (e.g. src/ids.ts            -> "ids")
//   - anything deeper              -> first two path segments
//     (e.g. src/engines/stealth/x -> "engines/stealth")

import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { PROJECT_ROOT, readLines, walkTs } from '../audit-code/scan.ts'

export const SRC_ROOT = join(PROJECT_ROOT, 'src')

const SPEC_RE =
  /(?:from\s+['"]([^'"]+)['"])|(?:import\s*\(\s*['"]([^'"]+)['"]\s*\))|(?:require\s*\(\s*['"]([^'"]+)['"]\s*\))/g

export interface ImportEdge {
  from: string // module key
  to: string // module key
  raw: string // specifier as written (rel path of source file)
}

export interface ModuleGraph {
  modules: Set<string>
  files: Map<string, string> // abs file -> module key
  moduleFiles: Map<string, string[]> // module key -> abs files
  fileImports: Map<string, string[]> // abs file -> resolved abs target files (in-repo)
  edges: ImportEdge[] // deduplicated module-level edges
  moduleDeps: Map<string, Set<string>> // module -> modules it imports (module level)
  moduleRdeps: Map<string, Set<string>> // module -> modules that import it
}

export function moduleOf(relPath: string): string {
  const norm = relPath.split('\\').join('/').replace(/^src\//, '')
  const segs = norm.split('/').filter(Boolean)
  if (segs.length <= 1) return segs[0]?.replace(/\.ts$/, '') ?? norm
  return segs.slice(0, 2).join('/').replace(/\.ts$/, '')
}

function resolveSpecifier(spec: string, fromFile: string): string | null {
  // External / node builtins / bare package imports are not part of the graph.
  if (spec.startsWith('node:')) return null
  if (!spec.startsWith('.') && !spec.startsWith('@/')) return null

  let base: string
  if (spec.startsWith('@/')) {
    base = join(SRC_ROOT, spec.slice(2))
  } else {
    base = resolve(dirname(fromFile), spec)
  }

  // Bun ESM source imports use the `.js` extension for sibling `.ts` files;
  // map that back to the real `.ts` file. Also try bare `.ts` + index.ts.
  const candidates: string[] = [base]
  if (base.endsWith('.js')) candidates.push(base.slice(0, -3) + '.ts')
  if (!base.endsWith('.ts')) candidates.push(`${base}.ts`)
  candidates.push(join(base, 'index.ts'))
  for (const c of candidates) {
    if (existsSync(c) && c.endsWith('.ts')) {
      const rel = relative(PROJECT_ROOT, c)
      // Only include files that live under src/.
      if (rel.split(/[\\/]/)[0] === 'src') return c
    }
  }
  return null
}

export async function buildGraph(): Promise<ModuleGraph> {
  const files = await walkTs(SRC_ROOT, PROJECT_ROOT)
  const graph: ModuleGraph = {
    modules: new Set(),
    files: new Map(),
    moduleFiles: new Map(),
    fileImports: new Map(),
    edges: [],
    moduleDeps: new Map(),
    moduleRdeps: new Map(),
  }

  for (const f of files) {
    const rel = relative(PROJECT_ROOT, f)
    const mod = moduleOf(rel)
    graph.modules.add(mod)
    graph.files.set(f, mod)
    const arr = graph.moduleFiles.get(mod) ?? []
    arr.push(f)
    graph.moduleFiles.set(mod, arr)
  }

  const seenEdge = new Set<string>()

  for (const f of files) {
    let lines: string[]
    try {
      lines = await readLines(f)
    } catch {
      continue
    }
    const targets: string[] = []
    for (const line of lines) {
      SPEC_RE.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = SPEC_RE.exec(line)) !== null) {
        const spec = (m[1] ?? m[2] ?? m[3]) as string
        const resolved = resolveSpecifier(spec, f)
        if (resolved) targets.push(resolved)
      }
    }
    if (targets.length > 0) graph.fileImports.set(f, targets)

    const fromMod = graph.files.get(f) as string
    for (const t of targets) {
      const toMod = graph.files.get(t)
      if (!toMod) continue
      const key = `${fromMod} ${toMod}`
      if (seenEdge.has(key)) continue
      seenEdge.add(key)
      graph.edges.push({ from: fromMod, to: toMod, raw: relative(PROJECT_ROOT, f) })

      if (!graph.moduleDeps.has(fromMod)) graph.moduleDeps.set(fromMod, new Set())
      if (!graph.moduleRdeps.has(toMod)) graph.moduleRdeps.set(toMod, new Set())
      graph.moduleDeps.get(fromMod)?.add(toMod)
      graph.moduleRdeps.get(toMod)?.add(fromMod)
    }
  }

  return graph
}

export function modulePathLabel(mod: string): string {
  return isAbsolute(mod) ? mod : `src/${mod}`
}

// Restrict the graph to a target module plus its 1-hop neighborhood. Used by
// the targeted `--module` audit mode.
export function subgraphAround(graph: ModuleGraph, prefix: string): ModuleGraph {
  const center = new Set<string>()
  for (const mod of graph.modules) {
    if (mod === prefix || mod.startsWith(`${prefix}/`) || prefix.startsWith(`${mod}/`)) {
      center.add(mod)
    }
  }
  const keep = new Set<string>(center)
  for (const mod of center) {
    for (const d of graph.moduleDeps.get(mod) ?? []) keep.add(d)
    for (const r of graph.moduleRdeps.get(mod) ?? []) keep.add(r)
  }
  const sub: ModuleGraph = {
    modules: keep,
    files: new Map(),
    moduleFiles: new Map(),
    fileImports: new Map(),
    edges: [],
    moduleDeps: new Map(),
    moduleRdeps: new Map(),
  }
  for (const [f, mod] of graph.files) {
    if (keep.has(mod)) {
      sub.files.set(f, mod)
      const arr = sub.moduleFiles.get(mod) ?? []
      arr.push(f)
      sub.moduleFiles.set(mod, arr)
    }
  }
  for (const [f, ts] of graph.fileImports) {
    if (keep.has(graph.files.get(f) as string)) sub.fileImports.set(f, ts)
  }
  for (const e of graph.edges) {
    if (keep.has(e.from) && keep.has(e.to)) {
      sub.edges.push(e)
      if (!sub.moduleDeps.has(e.from)) sub.moduleDeps.set(e.from, new Set())
      if (!sub.moduleRdeps.has(e.to)) sub.moduleRdeps.set(e.to, new Set())
      sub.moduleDeps.get(e.from)?.add(e.to)
      sub.moduleRdeps.get(e.to)?.add(e.from)
    }
  }
  return sub
}
