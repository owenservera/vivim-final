import { beforeEach, describe, expect, test } from 'bun:test'
import { CapabilityShapeRegistry } from '../../../src/engines/capability-shape-registry.js'

describe('CapabilityShapeRegistry (Phase 22)', () => {
  let registry: CapabilityShapeRegistry

  beforeEach(() => {
    registry = new CapabilityShapeRegistry()
  })

  describe('getEffectiveShape', () => {
    test('returns shape without overrides', () => {
      const shape = registry.getEffectiveShape('chat_app')
      expect(shape.id).toBe('chat_app')
      expect(shape.name).toBe('Chat Application')
    })

    test('merges parent shape with child overrides', () => {
      registry.registerShape({
        id: 'child_chat',
        name: 'Child Chat',
        extendsShape: 'chat_app',
        overrides: { name: 'Enhanced Chat' },
        expectedCapabilities: { send_message: 'required' },
        discoveryHints: { urlPatterns: [], domIndicators: [], interactiveElementPatterns: [] },
        projectionRules: {
          composer: { selector: 'textarea', mapping: {} },
          messageList: { selector: 'div', mapping: {} },
        },
        parserExpectations: {
          responseFormat: 'sse',
          parserArchetype: 'claude',
          fallbackStrategy: 'plain_text',
        },
      })
      const effective = registry.getEffectiveShape('child_chat')
      expect(effective.id).toBe('child_chat')
      expect(effective.name).toBe('Enhanced Chat')
    })

    test('throws for unknown shape', () => {
      expect(() => registry.getEffectiveShape('nonexistent')).toThrow()
    })
  })

  describe('getChildShapes', () => {
    test('returns shapes that extend a parent', () => {
      registry.registerShape({
        id: 'child1',
        name: 'Child 1',
        extendsShape: 'chat_app',
        expectedCapabilities: {},
        discoveryHints: { urlPatterns: [], domIndicators: [], interactiveElementPatterns: [] },
        projectionRules: {
          composer: { selector: '', mapping: {} },
          messageList: { selector: '', mapping: {} },
        },
        parserExpectations: {
          responseFormat: 'custom',
          parserArchetype: 'generic',
          fallbackStrategy: 'raw',
        },
      })
      const children = registry.getChildShapes('chat_app')
      expect(children.some((c) => c.id === 'child1')).toBe(true)
    })

    test('returns empty array for no children', () => {
      const children = registry.getChildShapes('data_dashboard')
      expect(children).toHaveLength(0)
    })
  })

  describe('loadAdaptersFromDir', () => {
    test('registers adapter from file', async () => {
      await registry.loadAdaptersFromDir('C:\\0-BlackBoxProject-0\\vivim-final\\seeds\\adapters')
      const adapter = registry.getAdapter('chat_app')
      expect(adapter).not.toBeNull()
      expect(adapter?.shapeId).toBe('chat_app')
    })
  })

  describe('adapter round-trip', () => {
    test('chat_app adapter passes through', async () => {
      await registry.loadAdaptersFromDir('C:\\0-BlackBoxProject-0\\vivim-final\\seeds\\adapters')
      const adapter = registry.getAdapter('chat_app')
      expect(adapter).not.toBeNull()
      const shape = registry.getShape('chat_app')!
      const cap = { type: 'send_message' }
      const universal = adapter!.toUniversal(cap, shape)
      expect(universal).toEqual(cap)
    })

    test('coding_ide adapter maps run_code', async () => {
      await registry.loadAdaptersFromDir('C:\\0-BlackBoxProject-0\\vivim-final\\seeds\\adapters')
      const adapter = registry.getAdapter('coding_ide')
      expect(adapter).not.toBeNull()
      const shape = registry.getShape('coding_ide')!
      const cap = { type: 'run_code' }
      const universal = adapter!.toUniversal(cap, shape)
      expect(universal.uiComponent).toBe('action_button')
    })

    test('search_engine adapter maps search', async () => {
      await registry.loadAdaptersFromDir('C:\\0-BlackBoxProject-0\\vivim-final\\seeds\\adapters')
      const adapter = registry.getAdapter('search_engine')
      expect(adapter).not.toBeNull()
      const shape = registry.getShape('search_engine')!
      const cap = { type: 'search' }
      const universal = adapter!.toUniversal(cap, shape)
      expect(universal.uiComponent).toBe('text_input')
    })
  })
})
