import { beforeEach, describe, expect, test } from 'bun:test'
import {
  type CapabilityShape,
  CapabilityShapeRegistry,
  type DomIndicator,
} from '../../../src/engines/capability-shape-registry.js'

describe('CapabilityShapeRegistry', () => {
  let registry: CapabilityShapeRegistry

  beforeEach(() => {
    registry = new CapabilityShapeRegistry()
  })

  test('has built-in shapes loaded', () => {
    const shapes = registry.listShapes()
    expect(shapes.length).toBeGreaterThanOrEqual(5)
    expect(shapes.some((s) => s.id === 'chat_app')).toBe(true)
    expect(shapes.some((s) => s.id === 'coding_ide')).toBe(true)
  })

  test('getShape returns built-in shape', () => {
    const shape = registry.getShape('chat_app')
    expect(shape).not.toBeNull()
    expect(shape?.name).toBe('Chat Application')
    expect(shape?.expectedCapabilities.send_message).toBe('required')
  })

  test('getShape returns null for unknown', () => {
    expect(registry.getShape('nonexistent')).toBeNull()
  })

  test('registerShape adds custom shape', () => {
    const custom: CapabilityShape = {
      id: 'my_app',
      name: 'My App',
      expectedCapabilities: { do_thing: 'required' },
      discoveryHints: { urlPatterns: [], domIndicators: [], interactiveElementPatterns: [] },
      projectionRules: {
        composer: { selector: 'input', mapping: {} },
        messageList: { selector: 'div', mapping: {} },
      },
      parserExpectations: {
        responseFormat: 'json',
        parserArchetype: 'generic',
        fallbackStrategy: 'raw',
      },
    }
    registry.registerShape(custom)
    expect(registry.getShape('my_app')).toBe(custom)
  })

  test('matchShape finds chat_app by DOM indicators', () => {
    const indicators: DomIndicator[] = [
      { selector: 'textarea', text: 'Message' },
      { selector: '[data-testid="composer"]', text: 'Send' },
    ]
    const match = registry.matchShape(indicators)
    expect(match).not.toBeNull()
    expect(match?.shapeId).toBe('chat_app')
    expect(match?.confidence).toBeGreaterThan(0.5)
  })

  test('matchShape returns null for empty indicators', () => {
    expect(registry.matchShape([])).toBeNull()
  })

  test('registerAdapter and getAdapter', () => {
    const adapter = {
      shapeId: 'chat_app',
      toUniversal: (s: Record<string, unknown>) => s,
      fromUniversal: (s: Record<string, unknown>) => s,
      projectState: (s: Record<string, unknown>) => s,
    }
    registry.registerAdapter(adapter)
    expect(registry.getAdapter('chat_app')).toBe(adapter)
  })
})
