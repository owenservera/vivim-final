#!/usr/bin/env bun
// scripts/gen-test-scaffold.ts
// Stepwise test-generation process — engine → test scaffold.
//
// Reads an engine module, extracts its public API (exported functions / classes),
// and emits a Conventional test stub at tests/unit/engines/<name>.test.ts.
// This is the mechanical half of closing a coverage gap; the human half is
// filling in the `// TODO` assertions with real behaviour expectations.
//
// Usage:
//   bun run scripts/gen-test-scaffold.ts src/engines/<name>.ts
//   bun run scripts/gen-test-scaffold.ts src/engines/<name>.ts --dry   # print only
//   bun run scripts/gen-test-scaffold.ts --all                        # scaffold every untested engine

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'

const ENGINE_DIR = join(import.meta.dir, '..', 'src', 'engines')
const TEST_DIR = join(import.meta.dir, '..', 'tests', 'unit', 'engines')

interface ApiMember {
  kind: 'function' | 'class' | 'const' | 'interface' | 'type'
  name: string
}

function extractApi(src: string): ApiMember[] {
  const members: ApiMember[] = []
  const re =
    /export\s+(async\s+)?(function|class|const|interface|type)\s+([A-Za-z0-9_]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const kind = m[2] as ApiMember['kind']
    const name = m[3]!
    members.push({ kind, name })
  }
  return members
}

function isTypeOnly(kind: ApiMember['kind']): boolean {
  return kind === 'interface' || kind === 'type'
}

function renderTest(engineName: string, members: ApiMember[]): string {
  const importPath = `../../../src/engines/${engineName}.js`
  const importNames = members.map((m) => m.name).join(', ')

  const blocks: string[] = []
  const callables = members.filter((m) => (m.kind === 'function' || m.kind === 'class'))
  const types = members.filter(isTypeOnly)

  if (types.length) {
    blocks.push(`  // Type-level exports present: ${types.map((t) => t.name).join(', ')}.
  // Prefer behavioural tests below; add schema/shape tests if these are Zod objects.`)
  }

  for (const m of callables) {
    if (m.kind === 'class') {
      blocks.push(`  describe('${m.name}', () => {
    test('constructs without throwing', () => {
      // TODO: supply the real store/dependency contract mock.
      // const engine = new ${m.name}(/* deps */)
      // expect(engine).toBeDefined()
      expect(true).toBe(true)
    })

    test('TODO: core behaviour', () => {
      // TODO: exercise the primary public method and assert the contract.
      expect(true).toBe(true)
    })
  })`)
    } else {
      blocks.push(`  describe('${m.name}', () => {
    test('TODO: behaviour', () => {
      // TODO: call ${m.name}(...) with representative inputs and assert output.
      expect(true).toBe(true)
    })
  })`)
    }
  }

  return `// tests/unit/engines/${engineName}.test.ts
// AUTO-SCAFFOLDED by scripts/gen-test-scaffold.ts — fill in the TODOs.
// Coverage gap closure for src/engines/${engineName}.ts

import { describe, expect, test } from 'bun:test'
import { ${importNames} } from '${importPath}'

describe('${engineName}', () => {
${blocks.join('\n\n')}
})
`
}

function engineBasename(p: string): string {
  return basename(p).replace(/\.ts$/, '')
}

function scaffoldOne(enginePath: string, dry: boolean): void {
  const abs = enginePath
  if (!existsSync(abs)) {
    console.error(`✗ engine not found: ${abs}`)
    process.exitCode = 1
    return
  }
  const name = engineBasename(abs)
  const src = readFileSync(abs, 'utf8')
  const members = extractApi(src)
  const out = renderTest(name, members)
  const target = join(TEST_DIR, `${name}.test.ts`)
  if (dry) {
    console.log(`\n=== ${target} ===\n`)
    console.log(out)
    return
  }
  if (existsSync(target)) {
    console.error(`✗ test already exists: ${target} (skipping to avoid overwrite)`)
    return
  }
  writeFileSync(target, out)
  console.log(`✓ scaffolded ${target} (${members.length} exported members)`)
}

function scaffoldAll(): void {
  const files = readdirSync(ENGINE_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.d.ts'))
  let count = 0
  for (const f of files) {
    const target = join(TEST_DIR, `${f.replace(/\.ts$/, '')}.test.ts`)
    if (existsSync(target)) continue
    scaffoldOne(join(ENGINE_DIR, f), false)
    count++
  }
  console.log(`\nScaffolded ${count} untested engines.`)
}

function main(): void {
  const args = process.argv.slice(2)
  if (args.includes('--all')) {
    scaffoldAll()
    return
  }
  const dry = args.includes('--dry')
  const path = args.find((a) => a.endsWith('.ts'))
  if (!path) {
    console.error('Usage: bun run scripts/gen-test-scaffold.ts <src/engines/name.ts> [--dry] | --all')
    process.exitCode = 1
    return
  }
  const abs = path.includes('/') || path.includes('\\') ? path : join(ENGINE_DIR, path)
  scaffoldOne(abs, dry)
}

main()
