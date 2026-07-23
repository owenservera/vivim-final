import { describe, expect, it } from 'bun:test'
import { recipeToConfig, configToProgram, PROGRAM_STATUS } from '../../../../src/engines/harness/program-schema.js'
import { ValidationError } from '../../../../src/errors.js'

describe('program-schema', () => {
  const recipe = { id: 'r1', providerId: 'chatgpt', capabilitySlug: 'send', steps: [] }

  describe('PROGRAM_STATUS', () => {
    it('has all status constants', () => {
      expect(PROGRAM_STATUS.DRAFT).toBe('draft')
      expect(PROGRAM_STATUS.CANDIDATE).toBe('candidate')
      expect(PROGRAM_STATUS.PROMOTED).toBe('promoted')
      expect(PROGRAM_STATUS.FAILED).toBe('failed')
    })
  })

  describe('recipeToConfig', () => {
    it('serializes recipe with schemaVersion', () => {
      const json = recipeToConfig(recipe as any)
      const parsed = JSON.parse(json)
      expect(parsed.schemaVersion).toBe(1)
      expect(parsed.recipe.id).toBe('r1')
    })

    it('produces valid JSON', () => {
      const json = recipeToConfig(recipe as any)
      expect(() => JSON.parse(json)).not.toThrow()
    })
  })

  describe('configToProgram', () => {
    it('parses valid config JSON', () => {
      const json = recipeToConfig(recipe as any)
      const cfg = configToProgram(json)
      expect(cfg.schemaVersion).toBe(1)
      expect(cfg.recipe).toEqual(recipe)
    })

    it('throws for non-object', () => {
      expect(() => configToProgram('"string"')).toThrow(ValidationError)
    })

    it('throws for missing schemaVersion', () => {
      expect(() => configToProgram(JSON.stringify({ recipe: {} }))).toThrow(ValidationError)
    })

    it('throws for missing recipe', () => {
      expect(() => configToProgram(JSON.stringify({ schemaVersion: 1 }))).toThrow(ValidationError)
    })
  })
})
