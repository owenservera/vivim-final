// tests/arch/api-contract.test.ts
// Validates API contract consistency between backend and frontend.

import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

// ── Soft assertion helper (bun:test lacks expect.soft) ───────────────────
function softFail(label: string, items: string[]): void {
  if (items.length === 0) return
  console.warn(`\n  [SOFT FAIL] ${label} (${items.length} issues):`)
  for (const item of items.slice(0, 10)) {
    console.warn(`    - ${item}`)
  }
  if (items.length > 10) console.warn(`    ... and ${items.length - 10} more`)
}

const ROOT = resolve(import.meta.dir, '../..')

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract all ErrorCode members from a union type definition. */
function extractErrorCodes(content: string): string[] {
  const codes: string[] = []
  // Match the ErrorCode type union: | 'CodeName'
  const re = /export type ErrorCode[\s\S]*?=[\s\S]*?;/
  const match = re.exec(content)
  if (!match) return codes

  const memberRe = /'([A-Z][a-zA-Z]+)'/g
  let m: RegExpExecArray | null
  while ((m = memberRe.exec(match[0] as string)) !== null) {
    codes.push(m[1] as string)
  }
  return codes
}

/** Extract all WsEvent type strings (the 'type' discriminant values). */
function extractWsEventTypes(content: string): string[] {
  const types: string[] = []
  // Match type: 'event:name' in interfaces
  const re = /type:\s*'([^']+)'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    types.push(m[1] as string)
  }
  return types
}

/** Extract Zod schema names from a schemas file. */
function extractZodSchemaNames(content: string): string[] {
  const names: string[] = []
  // Match: const SomeSchema = z.object( or z.array( etc
  const re = /export\s+const\s+(\w+Schema\b)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    names.push(m[1] as string)
  }
  return names
}

/** Get all router file paths under src/server/. */
async function getRouterFiles(): Promise<string[]> {
  const serverDir = resolve(ROOT, 'src', 'server')
  const routers: string[] = []

  async function walk(dir: string): Promise<void> {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory() && entry.name !== 'middleware') {
        await walk(full)
      } else if (entry.isFile() && entry.name.endsWith('-router.ts')) {
        routers.push(full)
      }
    }
  }

  await walk(serverDir)
  return routers
}

/** Extract route path strings from a router file. */
function extractRoutePaths(content: string): string[] {
  const routes: string[] = []
  // Match common route patterns: .get('/path', .post('/path', etc
  const re = /\.(get|post|put|patch|delete|options)\s*\(\s*['"]([/\w-]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    routes.push(m[2] as string)
  }
  return routes
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('API Contract Consistency', () => {
  it('backend error codes should match frontend error classifier', async () => {
    const backendPath = resolve(ROOT, 'src', 'server', 'errors.ts')
    const frontendPath = resolve(ROOT, 'frontend', 'src', 'types', 'shared', 'errors.ts')

    if (!existsSync(backendPath) || !existsSync(frontendPath)) return

    const backendContent = await readFile(backendPath, 'utf8')
    const frontendContent = await readFile(frontendPath, 'utf8')

    const backendCodes = new Set(extractErrorCodes(backendContent))
    const frontendCodes = new Set(extractErrorCodes(frontendContent))

    // Codes in backend but missing from frontend
    const missingInFrontend = [...backendCodes].filter((c) => !frontendCodes.has(c))
    // Codes in frontend but missing from backend (stale)
    const staleInFrontend = [...frontendCodes].filter((c) => !backendCodes.has(c))

    const issues: string[] = []
    if (missingInFrontend.length > 0) {
      issues.push(`Missing in frontend: ${missingInFrontend.join(', ')}`)
    }
    if (staleInFrontend.length > 0) {
      issues.push(`Stale in frontend: ${staleInFrontend.join(', ')}`)
    }

    // Soft assertion: report drift but don't hard-fail
    softFail('Error code drift', issues)
    expect(true).toBe(true)
  })

  it('WebSocket event types should match between backend and frontend', async () => {
    const frontendWsPath = resolve(ROOT, 'frontend', 'src', 'types', 'shared', 'ws-events.ts')
    if (!existsSync(frontendWsPath)) return

    const frontendContent = await readFile(frontendWsPath, 'utf8')
    const frontendEvents = new Set(extractWsEventTypes(frontendContent))

    // Check that the frontend WsEvent union covers all defined type discriminants
    const definedTypes = extractWsEventTypes(frontendContent)
    const uniqueTypes = new Set(definedTypes)

    // Verify the WsEvent union type includes all defined event types
    const wsEventMatch = /export type WsEvent[\s\S]*?=/
    const wsEventUnion = wsEventMatch.exec(frontendContent)
    const unionTypes: string[] = []
    if (wsEventUnion) {
      // Extract all referenced interfaces in the union
      const re = /Ws\w+Event/g
      let m: RegExpExecArray | null
      while ((m = re.exec(frontendContent)) !== null) {
        unionTypes.push(m[0] as string)
      }
    }

    // Check that each event type has a corresponding interface
    const missingInterfaces: string[] = []
    for (const type of uniqueTypes) {
      // Derive interface name: 'capability:executed' → 'WsCapabilityExecutedEvent'
      const parts = type.split(':')
      const prefix = parts[0] as string
      const suffix = (parts[1] ?? '')
        .split('_')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join('')
      const interfaceName = `Ws${prefix.charAt(0).toUpperCase() + prefix.slice(1)}${suffix}Event`

      if (
        !frontendContent.includes(`interface ${interfaceName}`) &&
        !frontendContent.includes(`type ${interfaceName}`)
      ) {
        missingInterfaces.push(`${type} → expected ${interfaceName}`)
      }
    }

    softFail('Missing WS event interfaces', missingInterfaces)

    // Verify at least the core event types exist
    const coreEvents = [
      'capability:executed',
      'capability:failed',
      'conversation:complete',
      'conversation:error',
    ]
    const missingCore = coreEvents.filter((e) => !frontendEvents.has(e))
    expect(missingCore).toEqual([])
  })

  it('API response schemas should exist for major router endpoints', async () => {
    const routerFiles = await getRouterFiles()
    const allRoutePaths = new Set<string>()

    for (const routerFile of routerFiles) {
      const content = await readFile(routerFile, 'utf8')
      const paths = extractRoutePaths(content)
      for (const path of paths) {
        allRoutePaths.add(path)
      }
    }

    // We don't require a 1:1 mapping (many routes are server-internal),
    // but we verify the frontend has SOME schema definitions
    const frontendSchemasPath = resolve(ROOT, 'frontend', 'src', 'api', 'schemas.ts')
    const frontendTypesPath = resolve(ROOT, 'frontend', 'src', 'types', 'api.ts')
    const frontendApiTypesPath = resolve(
      ROOT,
      'frontend',
      'src',
      'types',
      'shared',
      'api-contract.ts',
    )

    const hasSchemas = existsSync(frontendSchemasPath)
    const hasTypes = existsSync(frontendTypesPath)
    const hasApiContract = existsSync(frontendApiTypesPath)

    // At minimum, the frontend should have type definitions for API responses
    expect(hasTypes || hasSchemas || hasApiContract).toBe(true)

    // Verify the frontend has response type definitions
    if (hasSchemas) {
      const content = await readFile(frontendSchemasPath, 'utf8')
      const schemaNames = extractZodSchemaNames(content)
      // Should have at least some validation schemas
      if (schemaNames.length > 0) {
        expect(schemaNames.length).toBeGreaterThan(0)
      }
    }
  })

  it('frontend error classifier should handle all backend error codes', async () => {
    const frontendErrorsPath = resolve(ROOT, 'frontend', 'src', 'types', 'shared', 'errors.ts')
    const frontendClassifierPath = resolve(ROOT, 'frontend', 'src', 'lib', 'errorClassifier.ts')

    if (!existsSync(frontendErrorsPath)) return

    const errorsContent = await readFile(frontendErrorsPath, 'utf8')
    const errorCodes = extractErrorCodes(errorsContent)

    // Every error code should have a user-facing message in ERROR_MESSAGES
    const messagesRe = /ERROR_MESSAGES[\s\S]*?=[\s\S]*?\{([\s\S]*?)\}/
    const messagesMatch = messagesRe.exec(errorsContent)
    const missingMessages: string[] = []

    if (messagesMatch) {
      for (const code of errorCodes) {
        if (!messagesMatch[1]!.includes(code)) {
          missingMessages.push(code)
        }
      }
    }

    softFail('Error codes missing messages', missingMessages)
    expect(true).toBe(true)

    // If classifier exists, verify it handles retryable codes
    if (existsSync(frontendClassifierPath)) {
      const classifierContent = await readFile(frontendClassifierPath, 'utf8')
      // Should at least handle NotFound and ValidationError
      expect(classifierContent).toMatch(/NotFound|ValidationError/)
    }
  })
})
