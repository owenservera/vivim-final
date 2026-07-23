// tests/unit/engines/messaging-archetypes.test.ts
// MESSAGING_ARCHETYPES — normalize functions for WhatsApp, Facebook, Telegram, Slack.
import { describe, expect, it } from 'bun:test'
import { MESSAGING_ARCHETYPES } from '../../../src/engines/messaging-archetypes.js'

describe('MESSAGING_ARCHETYPES', () => {
  it('has 5 archetypes', () => {
    expect(Object.keys(MESSAGING_ARCHETYPES)).toHaveLength(5)
  })

  describe('whatsapp', () => {
    it('normalizes message with all fields', () => {
      const msg = MESSAGING_ARCHETYPES.whatsapp.normalize({
        from: 'Alice',
        body: 'Hello!',
        timestamp: 1234567890,
        id: 'w1',
      })
      expect(msg.channelId).toBe('whatsapp')
      expect(msg.author).toBe('Alice')
      expect(msg.text).toBe('Hello!')
      expect(msg.ts).toBe(1234567890)
      expect(msg.threadId).toBe('w1')
    })

    it('handles missing fields gracefully', () => {
      const msg = MESSAGING_ARCHETYPES.whatsapp.normalize({})
      expect(msg.author).toBe('unknown')
      expect(msg.text).toBe('')
    })
  })

  describe('facebook', () => {
    it('normalizes message', () => {
      const msg = MESSAGING_ARCHETYPES.facebook.normalize({
        from: 'Bob',
        message: 'Hey there',
        time: 9999,
      })
      expect(msg.channelId).toBe('facebook')
      expect(msg.author).toBe('Bob')
      expect(msg.text).toBe('Hey there')
      expect(msg.ts).toBe(9999)
    })
  })

  describe('telegram', () => {
    it('normalizes message with chat.id', () => {
      const msg = MESSAGING_ARCHETYPES.telegram.normalize({
        chat: { id: 12345 },
        from: { username: 'charlie' },
        text: 'Hi',
        date: 5555,
      })
      expect(msg.channelId).toBe('telegram:12345')
      expect(msg.author).toBe('charlie')
    })

    it('falls back to first_name when username missing', () => {
      const msg = MESSAGING_ARCHETYPES.telegram.normalize({
        chat: { id: 1 },
        from: { first_name: 'Dave' },
        text: 'yo',
      })
      expect(msg.author).toBe('Dave')
    })
  })

  describe('slack', () => {
    it('normalizes message', () => {
      const msg = MESSAGING_ARCHETYPES.slack.normalize({
        channel: 'C123',
        user: 'U456',
        text: 'slack msg',
        ts: 7777,
      })
      expect(msg.channelId).toBe('C123')
      expect(msg.author).toBe('U456')
      expect(msg.text).toBe('slack msg')
      expect(msg.ts).toBe(7777)
    })
  })

  it('each archetype has required fields', () => {
    for (const [name, arch] of Object.entries(MESSAGING_ARCHETYPES)) {
      expect(arch.providerId).toBeTruthy()
      expect(typeof arch.normalize).toBe('function')
      expect(['webhook', 'polling', 'cdp-scrape']).toContain(arch.pollStrategy)
    }
  })
})
