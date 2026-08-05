import { describe, expect, it } from 'bun:test'
import { bindContext, resolvePronouns } from '../../../../src/engines/nlcl/context-binder.js'

describe('context-binder', () => {
  describe('resolvePronouns', () => {
    it('replaces "the canvas" with active layer', () => {
      const ctx = { metadata: { activeLayerId: 'layer-1' } } as any
      expect(resolvePronouns('show the canvas', ctx)).toBe('show canvas:layer-1')
    })

    it('leaves "the canvas" unchanged without active layer', () => {
      const ctx = { metadata: {} } as any
      expect(resolvePronouns('show the canvas', ctx)).toBe('show the canvas')
    })

    it('replaces "it" with lastSubject', () => {
      const ctx = { metadata: { lastSubject: 'the error' } } as any
      expect(resolvePronouns('fix it', ctx)).toBe('fix the error')
    })

    it('leaves "it" unchanged without lastSubject', () => {
      const ctx = { metadata: {} } as any
      expect(resolvePronouns('fix it', ctx)).toBe('fix it')
    })

    it('replaces "my account" with providerId', () => {
      const ctx = { providerId: 'claude' } as any
      expect(resolvePronouns('check my account', ctx)).toBe('check claude')
    })

    it('leaves text unchanged when no pronouns match', () => {
      const ctx = { metadata: {} } as any
      expect(resolvePronouns('hello world', ctx)).toBe('hello world')
    })
  })

  describe('bindContext', () => {
    it('builds context from raw request', async () => {
      const ctx = await bindContext(
        {
          conversationId: 'conv-1',
          providerId: 'chatgpt',
          activeSessionId: 'slave-1',
        },
        {},
      )
      expect(ctx.conversationId).toBe('conv-1')
      expect(ctx.providerId).toBe('chatgpt')
      expect(ctx.slaveId).toBe('slave-1')
      expect(ctx.surface).toBe('cli')
    })

    it('includes canvas state in metadata', async () => {
      const ctx = await bindContext(
        {
          canvasState: { activeLayerId: 'layer-1', background: 'dark' },
        },
        {},
      )
      expect(ctx.metadata.activeLayerId).toBe('layer-1')
      expect(ctx.metadata.canvasBackground).toBe('dark')
    })

    it('resolves providerId from conversation store', async () => {
      const convStore = {
        getConversation: async (_id: string) => ({
          id: 'conv-1',
          providerSessionId: 'ps-1',
          providerId: 'gemini',
          accountId: null,
          title: null,
          state: 'active',
          messageCount: 0,
          lastMessageAt: null,
          contextJson: '{}',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: 'live',
          externalId: null,
          importJobId: null,
          syncedAt: null,
        }),
      }
      const ctx = await bindContext({ conversationId: 'conv-1' }, { conversationStore: convStore })
      expect(ctx.providerId).toBe('gemini')
    })

    it('gracefully handles conversation store errors', async () => {
      const convStore = {
        getConversation: async (_id: string) => {
          throw new Error('db error')
        },
      }
      const ctx = await bindContext({ conversationId: 'conv-1' }, { conversationStore: convStore })
      expect(ctx.providerId).toBeUndefined()
    })
  })
})
