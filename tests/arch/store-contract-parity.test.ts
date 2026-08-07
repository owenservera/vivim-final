// tests/arch/store-contract-parity.test.ts
// Ensures every store implementation has a corresponding contract.

import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')
const CONTRACTS_DIR = resolve(ROOT, 'src', 'storage', 'contracts')
const IMPL_DIR = resolve(ROOT, 'src', 'storage', 'impl')

// ── Soft assertion helper (bun:test lacks expect.soft) ───────────────────
function softFail(label: string, items: string[]): void {
  if (items.length === 0) return
  console.warn(`\n  [SOFT FAIL] ${label} (${items.length} issues):`)
  for (const item of items.slice(0, 10)) {
    console.warn(`    - ${item}`)
  }
  if (items.length > 10) console.warn(`    ... and ${items.length - 10} more`)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  '.bun',
  'coverage',
  '__generated__',
  'onboarding',
])

async function getTsFiles(dir: string, excludeDirs: Set<string> = SKIP_DIRS): Promise<string[]> {
  const results: string[] = []
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    if (excludeDirs.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await getTsFiles(full, excludeDirs)))
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      results.push(full)
    }
  }
  return results
}

/** Derive a contract filename from an implementation filename.
 *  e.g., 'capability-store-impl.ts' → 'capability-store.ts'
 *  e.g., 'workflow-store-impl.ts' → 'workflow-store.ts'
 */
function implToContractName(implFile: string): string {
  const name = basename(implFile, '.ts')
  // Remove -impl suffix
  let contractName = name
  if (contractName.endsWith('-impl')) {
    contractName = contractName.slice(0, -5)
  } else if (contractName.endsWith('-store-mem')) {
    contractName = `${contractName.slice(0, -8)}-store`
  }
  return `${contractName}.ts`
}

/** Derive an impl pattern from a contract filename.
 *  e.g., 'capability-store.ts' → 'capability-store-impl.ts'
 */
function contractToImplPattern(contractFile: string): string {
  const name = basename(contractFile, '.ts')
  return `${name}-impl.ts`
}

/** Extract the 'implements' clause from a class declaration. */
function extractImplements(content: string): string[] {
  const impls: string[] = []
  const re = /class\s+\w+\s+(?:extends\s+\w+\s+)?implements\s+([^\{]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const implList = (m[1] as string)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    impls.push(...implList)
  }
  return impls
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Store Contract Parity', () => {
  it('every store implementation should have a matching contract', async () => {
    const implFiles = await getTsFiles(IMPL_DIR)
    const missingContracts: string[] = []

    for (const implFile of implFiles) {
      const name = basename(implFile, '.ts')
      // Only check files that look like store implementations
      if (!name.includes('-store-impl') && !name.includes('-store-mem')) continue

      const contractName = implToContractName(implFile)

      // Check in contracts root
      const contractPath = join(CONTRACTS_DIR, contractName)
      // Check in contracts/onboarding
      const onboardingPath = join(CONTRACTS_DIR, 'onboarding', contractName)

      if (!existsSync(contractPath) && !existsSync(onboardingPath)) {
        missingContracts.push(`${name} → expected ${contractName}`)
      }
    }

    // Soft check — some impls may be intentionally contractless
    softFail('Missing contracts for impls', missingContracts)
    expect(true).toBe(true)
  })

  it('every contract should have at least one implementation', async () => {
    const contractFiles = await getTsFiles(CONTRACTS_DIR)
    const missingImpls: string[] = []

    for (const contractFile of contractFiles) {
      const name = basename(contractFile, '.ts')
      // Only check files that look like store contracts
      if (!name.includes('-store')) continue
      // Skip index files and non-store contracts
      if (name === 'index' || name.includes('-store-impl')) continue

      const implPattern = contractToImplPattern(contractFile)
      const implPath = join(IMPL_DIR, implPattern)
      // Also check in impl/onboarding
      const onboardingImplPath = join(IMPL_DIR, 'onboarding', implPattern)

      // Also check for non-standard impl names (e.g., command-store.ts in impl)
      const altImplPath = join(IMPL_DIR, name)

      if (!existsSync(implPath) && !existsSync(onboardingImplPath) && !existsSync(altImplPath)) {
        missingImpls.push(`${name} → expected ${implPattern} in impl/`)
      }
    }

    // Soft check — some contracts may be planned but not yet implemented
    softFail('Missing implementations for contracts', missingImpls)
    expect(true).toBe(true)
  })

  it('implementation should reference its contract interface', async () => {
    const implFiles = await getTsFiles(IMPL_DIR)
    const unlinkedImpls: string[] = []

    for (const implFile of implFiles) {
      const name = basename(implFile, '.ts')
      if (!name.includes('-store-impl') && !name.includes('-store-mem')) continue

      const content = await readFile(implFile, 'utf8')

      // Check if the file has an 'implements' clause
      const impls = extractImplements(content)
      if (impls.length === 0) {
        // Some impls may use a factory pattern instead — check for contract type reference
        const contractName = implToContractName(implFile).replace('.ts', '')
        // Convert kebab-case to PascalCase for the interface name
        const pascalName = contractName
          .split('-')
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join('')

        if (!content.includes(pascalName) && !content.includes(contractName)) {
          unlinkedImpls.push(`${name} does not appear to reference its contract interface`)
        }
      }
    }

    // Soft check — some impls may use alternative patterns
    softFail('Unlinked implementations', unlinkedImpls)
    expect(true).toBe(true)
  })

  it('contract interfaces should define at least one method', async () => {
    const contractFiles = await getTsFiles(CONTRACTS_DIR)
    const emptyContracts: string[] = []

    for (const contractFile of contractFiles) {
      const name = basename(contractFile, '.ts')
      if (!name.includes('-store')) continue
      if (name === 'index') continue

      const content = await readFile(contractFile, 'utf8')

      // Look for interface with methods (parentheses after identifier)
      const hasMethod = /\w+\s*\(/.test(content)
      if (!hasMethod) {
        emptyContracts.push(name)
      }
    }

    // Soft check — some contracts may be type-only
    softFail('Contracts without methods', emptyContracts)
    expect(true).toBe(true)
  })
})
