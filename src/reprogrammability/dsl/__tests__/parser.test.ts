// src/reprogrammability/dsl/__tests__/parser.test.ts
// Phase 3 of ROADMAP-REPROGRAMMABLE-CANVAS.md

import { describe, expect, it } from 'bun:test'
import { DslParseError, parseMutation, parseMutationList, parseShorthand } from '../parser.js'

describe('Phase 3 — Mutation DSL Parser', () => {
  describe('JSON form', () => {
    it('parses a valid JSON mutation', () => {
      const mut = parseMutation(
        JSON.stringify({
          op: 'set_property',
          target: 'panel:conversations',
          payload: { path: 'visible', value: false },
          provenance: 'manual',
        }),
      )
      expect(mut.op).toBe('set_property')
      expect(mut.target).toBe('panel:conversations')
    })

    it('rejects invalid JSON', () => {
      expect(() => parseMutation('{not json')).toThrow(DslParseError)
    })

    it('rejects schema-invalid JSON', () => {
      expect(() =>
        parseMutation(
          JSON.stringify({
            op: 'teleport', // not a valid op
            target: 'panel:conversations',
            payload: {},
            provenance: 'manual',
          }),
        ),
      ).toThrow(DslParseError)
    })
  })

  describe('shorthand /hide', () => {
    it('parses /hide panel:conversations', () => {
      const mut = parseShorthand('/hide panel:conversations')
      expect(mut.op).toBe('set_property')
      expect(mut.target).toBe('panel:conversations')
      expect(mut.payload).toEqual({ path: 'visible', value: false })
      expect(mut.provenance).toBe('nlcl')
    })

    it('respects "as manual" override', () => {
      const mut = parseShorthand('/hide panel:conversations as manual')
      expect(mut.provenance).toBe('manual')
    })

    it('requires a target', () => {
      expect(() => parseShorthand('/hide')).toThrow(DslParseError)
    })
  })

  describe('shorthand /show', () => {
    it('parses /show panel:conversations', () => {
      const mut = parseShorthand('/show panel:conversations')
      expect(mut.op).toBe('set_property')
      expect(mut.payload).toEqual({ path: 'visible', value: true })
    })
  })

  describe('shorthand /rename', () => {
    it('parses /rename with quoted name', () => {
      const mut = parseShorthand('/rename panel:conversations "My Panel"')
      expect(mut.op).toBe('set_property')
      expect(mut.payload).toEqual({ path: 'title', value: 'My Panel' })
    })

    it('requires quoted name', () => {
      expect(() => parseShorthand('/rename panel:conversations MyPanel')).toThrow(DslParseError)
    })
  })

  describe('shorthand /move', () => {
    it('parses /move to a dock edge', () => {
      const mut = parseShorthand('/move panel:conversations to right')
      expect(mut.op).toBe('set_property')
      expect(mut.payload).toEqual({ path: 'dock', value: 'right' })
    })

    it('parses /move to a slot', () => {
      const mut = parseShorthand('/move card:doc:abc to chat.thread')
      expect(mut.op).toBe('set_slot')
      expect(mut.payload).toEqual({ slotId: 'chat.thread' })
    })
  })

  describe('shorthand /restyle', () => {
    it('parses /restyle with string values', () => {
      const mut = parseShorthand('/restyle panel:conversations background=black color=white')
      expect(mut.op).toBe('restyle')
      expect(mut.payload).toEqual({ background: 'black', color: 'white' })
    })

    it('parses /restyle with JSON values', () => {
      const mut = parseShorthand('/restyle panel:conversations opacity=0.5 visible=true')
      expect(mut.payload).toEqual({ opacity: 0.5, visible: true })
    })
  })

  describe('shorthand /rebind', () => {
    it('parses /rebind with capability', () => {
      const mut = parseShorthand('/rebind card:doc:abc capability=cap:send-message')
      expect(mut.op).toBe('rebind')
      expect(mut.payload).toEqual({
        capabilityId: 'cap:send-message',
        action: 'bind',
      })
    })

    it('parses /rebind with slot', () => {
      const mut = parseShorthand('/rebind card:doc:abc capability=cap:send-message slot=primary')
      expect(mut.payload).toEqual({
        capabilityId: 'cap:send-message',
        slot: 'primary',
        action: 'bind',
      })
    })
  })

  describe('shorthand /unbind', () => {
    it('parses /unbind', () => {
      const mut = parseShorthand('/unbind card:doc:abc capability=cap:send-message')
      expect(mut.op).toBe('rebind')
      expect(mut.payload).toEqual({
        capabilityId: 'cap:send-message',
        action: 'unbind',
      })
    })
  })

  describe('shorthand /replace', () => {
    it('parses /replace with JSON payload', () => {
      const mut = parseShorthand(
        '/replace panel:conversations {"kind":"panel","variant":"default","title":"X","dock":"left"}',
      )
      expect(mut.op).toBe('replace')
      expect(mut.target).toBe('panel:conversations')
      expect(mut.payload).toEqual({ kind: 'panel', variant: 'default', title: 'X', dock: 'left' })
    })
  })

  describe('shorthand /remove', () => {
    it('parses /remove', () => {
      const mut = parseShorthand('/remove card:doc:abc')
      expect(mut.op).toBe('remove')
      expect(mut.target).toBe('card:doc:abc')
    })
  })

  describe('shorthand /reorder', () => {
    it('parses /reorder with comma-separated ids', () => {
      const mut = parseShorthand('/reorder panel:conversations a,b,c')
      expect(mut.op).toBe('reorder')
      expect(mut.payload).toEqual(['a', 'b', 'c'])
    })
  })

  describe('shorthand unknown command', () => {
    it('throws on unknown command', () => {
      expect(() => parseShorthand('/teleport panel:conversations')).toThrow(DslParseError)
    })
  })

  describe('parseMutation dispatch', () => {
    it('routes JSON to JSON parser', () => {
      const mut = parseMutation('{"op":"remove","target":"x","provenance":"manual"}')
      expect(mut.op).toBe('remove')
    })

    it('routes / to shorthand parser', () => {
      const mut = parseMutation('/hide panel:conversations')
      expect(mut.op).toBe('set_property')
    })

    it('rejects bare text', () => {
      expect(() => parseMutation('hello world')).toThrow(DslParseError)
    })
  })

  describe('parseMutationList', () => {
    it('parses a JSON array', () => {
      const list = parseMutationList(
        JSON.stringify([
          { op: 'remove', target: 'a', provenance: 'manual' },
          { op: 'remove', target: 'b', provenance: 'manual' },
        ]),
      )
      expect(list).toHaveLength(2)
    })

    it('parses one-per-line', () => {
      const list = parseMutationList('/hide panel:a\n/hide panel:b\n/show panel:c')
      expect(list).toHaveLength(3)
      expect(list[0]?.target).toBe('panel:a')
      expect(list[2]?.op).toBe('set_property')
    })

    it('returns empty for empty input', () => {
      expect(parseMutationList('')).toEqual([])
      expect(parseMutationList('   \n  ')).toEqual([])
    })
  })
})
