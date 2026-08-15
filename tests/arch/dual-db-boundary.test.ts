import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')
const SYSTEM_SCHEMA = readFileSync(join(ROOT, 'prisma/system/schema.prisma'), 'utf-8')
const USER_SCHEMA = readFileSync(join(ROOT, 'prisma/user/schema.prisma'), 'utf-8')

function extractModelNames(schema: string): Set<string> {
  const names = new Set<string>()
  for (const match of schema.matchAll(/^model\s+(\w+)/gm)) {
    names.add(match[1]!)
  }
  return names
}

function extractRelations(schema: string): Array<{
  fromModel: string
  fieldName: string
  targetModel: string
}> {
  const relations: Array<{
    fromModel: string
    fieldName: string
    targetModel: string
  }> = []

  let currentModel = ''
  for (const line of schema.split('\n')) {
    const modelMatch = line.match(/^model\s+(\w+)/)
    if (modelMatch) {
      currentModel = modelMatch[1]!
      continue
    }

    const relMatch = line.match(/(\w+)\s+.*@relation\(.*references:\s*\[(\w+)\]/)
    if (relMatch && currentModel) {
      relations.push({
        fromModel: currentModel,
        fieldName: relMatch[1]!,
        targetModel: relMatch[2]!,
      })
    }
  }

  return relations
}

describe('dual-db boundary enforcement', () => {
  describe('cross-boundary @relation check', () => {
    it('user schema has no @relation targeting a system-only model', () => {
      const systemModels = extractModelNames(SYSTEM_SCHEMA)
      const userRelations = extractRelations(USER_SCHEMA)

      const violations = userRelations.filter((r) => systemModels.has(r.targetModel))
      if (violations.length > 0) {
        const details = violations
          .map((v) => `  ${v.fromModel}.${v.fieldName} -> ${v.targetModel}`)
          .join('\n')
        expect(`Cross-boundary relations in user schema:\n${details}`).toBe('')
      }
    })

    it('system schema has no @relation targeting a user-only model', () => {
      const userModels = extractModelNames(USER_SCHEMA)
      const systemRelations = extractRelations(SYSTEM_SCHEMA)

      const violations = systemRelations.filter((r) => userModels.has(r.targetModel))
      if (violations.length > 0) {
        const details = violations
          .map((v) => `  ${v.fromModel}.${v.fieldName} -> ${v.targetModel}`)
          .join('\n')
        expect(`Cross-boundary relations in system schema:\n${details}`).toBe('')
      }
    })
  })

  describe('SchemaMeta presence', () => {
    it('system schema has SchemaMeta model', () => {
      expect(SYSTEM_SCHEMA).toContain('model SchemaMeta')
    })

    it('user schema has SchemaMeta model', () => {
      expect(USER_SCHEMA).toContain('model SchemaMeta')
    })
  })

  describe('generator output paths', () => {
    it('system client outputs to generated/system-client', () => {
      expect(SYSTEM_SCHEMA).toContain('output')
      expect(SYSTEM_SCHEMA).toContain('system-client')
    })

    it('user client outputs to generated/user-client', () => {
      expect(USER_SCHEMA).toContain('output')
      expect(USER_SCHEMA).toContain('user-client')
    })
  })

  describe('datasource URLs', () => {
    it('system uses SYSTEM_DATABASE_URL', () => {
      expect(SYSTEM_SCHEMA).toContain('SYSTEM_DATABASE_URL')
    })

    it('user uses USER_DATABASE_URL', () => {
      expect(USER_SCHEMA).toContain('USER_DATABASE_URL')
    })
  })
})
