import { describe, expect, it } from 'bun:test'
import { assertRecipe, RECIPE_META } from '../../../../src/engines/harness/recipe-types.js'
import { EngineError } from '../../../../src/errors.js'

describe('recipe-types', () => {
  describe('RECIPE_META', () => {
    it('has schemaVersion 1', () => {
      expect(RECIPE_META.schemaVersion).toBe(1)
    })
  })

  describe('assertRecipe', () => {
    it('passes for valid recipe', () => {
      const recipe = {
        id: 'r1',
        providerId: 'chatgpt',
        capabilitySlug: 'send_message',
        steps: [],
      }
      expect(() => assertRecipe(recipe)).not.toThrow()
    })

    it('throws for null', () => {
      expect(() => assertRecipe(null)).toThrow(EngineError)
    })

    it('throws for non-object', () => {
      expect(() => assertRecipe('string')).toThrow(EngineError)
    })

    it('throws when id is missing', () => {
      expect(() => assertRecipe({ providerId: 'p', capabilitySlug: 'c', steps: [] })).toThrow(
        EngineError,
      )
    })

    it('throws when providerId is missing', () => {
      expect(() => assertRecipe({ id: 'r', capabilitySlug: 'c', steps: [] })).toThrow(EngineError)
    })

    it('throws when capabilitySlug is missing', () => {
      expect(() => assertRecipe({ id: 'r', providerId: 'p', steps: [] })).toThrow(EngineError)
    })

    it('throws when steps is not an array', () => {
      expect(() =>
        assertRecipe({ id: 'r', providerId: 'p', capabilitySlug: 'c', steps: 'not-array' }),
      ).toThrow(EngineError)
    })
  })
})
