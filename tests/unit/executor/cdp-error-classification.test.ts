// tests/unit/executor/cdp-error-classification.test.ts
import { describe, expect, it } from 'bun:test'
import {
  classifyCdpError,
  isRecoverable,
  retryDelayForError,
} from '../../../src/executor/cdp-error-classifier.js'

describe('classifyCdpError', () => {
  describe('timeout', () => {
    it('classifies timeout errors', () => {
      expect(classifyCdpError(new Error('CDP command timed out')).type).toBe('timeout')
    })
    it('classifies timed out errors', () => {
      expect(classifyCdpError(new Error('Request timed out')).type).toBe('timeout')
    })
    it('classifies from string', () => {
      expect(classifyCdpError('Capture timeout after 30000ms').type).toBe('timeout')
    })
  })

  describe('protocol_error', () => {
    it('classifies protocol errors', () => {
      expect(classifyCdpError(new Error('CDP command failed: No handler')).type).toBe(
        'protocol_error',
      )
    })
    it('classifies websocket errors', () => {
      expect(classifyCdpError(new Error('WebSocket connection failed')).type).toBe('protocol_error')
    })
    it('classifies not connected', () => {
      expect(classifyCdpError(new Error('Not connected to CDP endpoint')).type).toBe(
        'protocol_error',
      )
    })
    it('classifies session lost', () => {
      expect(
        classifyCdpError(new Error('CDP session lost for slave: s1 — re-attach failed')).type,
      ).toBe('protocol_error')
    })
    it('classifies cdp client not connected', () => {
      expect(classifyCdpError(new Error('CDP client not connected for slave: s1')).type).toBe(
        'protocol_error',
      )
    })
  })

  describe('chrome_crash', () => {
    it('classifies target closed', () => {
      expect(classifyCdpError(new Error('Target closed')).type).toBe('chrome_crash')
    })
    it('classifies browser disconnected', () => {
      expect(classifyCdpError(new Error('Browser has disconnected')).type).toBe('chrome_crash')
    })
    it('classifies slave not running', () => {
      expect(classifyCdpError(new Error('Slave not running: s1')).type).toBe('chrome_crash')
    })
  })

  describe('page_navigation', () => {
    it('classifies navigation errors', () => {
      expect(classifyCdpError(new Error('Navigation timed out')).type).toBe('page_navigation')
    })
    it('classifies frame detached', () => {
      expect(classifyCdpError(new Error('Frame detached')).type).toBe('page_navigation')
    })
    it('classifies target destroyed', () => {
      expect(classifyCdpError(new Error('Target destroyed')).type).toBe('page_navigation')
    })
  })

  describe('dialog_blocking', () => {
    it('classifies dialog errors', () => {
      expect(classifyCdpError(new Error('Dialog is open')).type).toBe('dialog_blocking')
    })
    it('classifies alert errors', () => {
      expect(classifyCdpError(new Error('Page has an alert dialog')).type).toBe('dialog_blocking')
    })
    it('classifies beforeunload', () => {
      expect(classifyCdpError(new Error('beforeunload dialog open')).type).toBe('dialog_blocking')
    })
  })

  describe('rate_limited', () => {
    it('classifies rate limit errors', () => {
      expect(classifyCdpError(new Error('Rate limit exceeded')).type).toBe('rate_limited')
    })
    it('classifies 429 errors', () => {
      expect(classifyCdpError(new Error('HTTP 429 Too Many Requests')).type).toBe('rate_limited')
    })
  })

  describe('unknown', () => {
    it('classifies unclassified errors as unknown', () => {
      expect(classifyCdpError(new Error('Something weird happened')).type).toBe('unknown')
    })
    it('returns the original message', () => {
      const result = classifyCdpError(new Error('Test message'))
      expect(result.message).toBe('Test message')
    })
  })
})

describe('isRecoverable', () => {
  it('returns true for timeout', () => {
    expect(isRecoverable('timeout')).toBe(true)
  })
  it('returns true for protocol_error', () => {
    expect(isRecoverable('protocol_error')).toBe(true)
  })
  it('returns true for chrome_crash', () => {
    expect(isRecoverable('chrome_crash')).toBe(true)
  })
  it('returns true for page_navigation', () => {
    expect(isRecoverable('page_navigation')).toBe(true)
  })
  it('returns true for dialog_blocking', () => {
    expect(isRecoverable('dialog_blocking')).toBe(true)
  })
  it('returns true for rate_limited', () => {
    expect(isRecoverable('rate_limited')).toBe(true)
  })
  it('returns false for unknown', () => {
    expect(isRecoverable('unknown')).toBe(false)
  })
})

describe('retryDelayForError', () => {
  it('returns 2000ms for timeout', () => {
    expect(retryDelayForError('timeout')).toBe(2000)
  })
  it('returns 1000ms for protocol_error', () => {
    expect(retryDelayForError('protocol_error')).toBe(1000)
  })
  it('returns 5000ms for chrome_crash', () => {
    expect(retryDelayForError('chrome_crash')).toBe(5000)
  })
  it('returns 1000ms for page_navigation', () => {
    expect(retryDelayForError('page_navigation')).toBe(1000)
  })
  it('returns 500ms for dialog_blocking', () => {
    expect(retryDelayForError('dialog_blocking')).toBe(500)
  })
  it('returns 10000ms for rate_limited', () => {
    expect(retryDelayForError('rate_limited')).toBe(10000)
  })
  it('returns 2000ms for unknown', () => {
    expect(retryDelayForError('unknown')).toBe(2000)
  })
})
