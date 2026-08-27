#!/usr/bin/env bun
// src/cli/commands/automate.ts
// CLI for agent-driven frontend automation.
// Usage:
//   automate type "search-input" "HELLO"
//   automate click "button[data-testid='send']"
//   automate navigate http://localhost:5173
//   automate text "h1"
//   automate screenshot
//   automate page

import { getServerPort } from '../../config.js'

const API = `http://localhost:${getServerPort()}`

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Source': 'cli',
      ...init?.headers,
    },
    signal: AbortSignal.timeout(10_000),
  })
  const body = await resp.json()
  if (!resp.ok) throw new Error(`API error ${resp.status}: ${JSON.stringify(body)}`)
  return body as T
}

export async function runAutomate(args: string[]): Promise<void> {
  const action = args[0]

  try {
    switch (action) {
      case 'navigate': {
        const url = args[1] ?? 'http://localhost:5173'
        await api('/api/automate/navigate', {
          method: 'POST',
          body: JSON.stringify({ url }),
        })
        break
      }

      case 'click': {
        const selector = args[1]
        if (!selector) {
          // [audit] removed: console.error('Usage: automate click <selector>')
          process.exit(1)
        }
        const _result = await api('/api/automate/click', {
          method: 'POST',
          body: JSON.stringify({ selector: { selector: selector } }),
        })
        // [audit] removed: console.log(JSON.stringify(result, null, 2))
        break
      }

      case 'type': {
        const selector = args[1]
        const text = args[2]
        if (!selector || text === undefined) {
          // [audit] removed: console.error('Usage: automate type <selector> <text>')
          process.exit(1)
        }
        const _result = await api('/api/automate/type', {
          method: 'POST',
          body: JSON.stringify({ selector: { selector }, text }),
        })
        // [audit] removed: console.log(JSON.stringify(result, null, 2))
        break
      }

      case 'text': {
        const selector = args[1]
        if (!selector) {
          // [audit] removed: console.error('Usage: automate text <selector>')
          process.exit(1)
        }
        const _result = await api<{ ok: boolean; text: string }>(
          `/api/automate/text?selector=${encodeURIComponent(selector)}`,
        )
        // [audit] removed: console.log(result.text)
        break
      }

      case 'value': {
        const selector = args[1]
        if (!selector) {
          // [audit] removed: console.error('Usage: automate value <selector>')
          process.exit(1)
        }
        const _result = await api<{ ok: boolean; value: string }>(
          `/api/automate/value?selector=${encodeURIComponent(selector)}`,
        )
        // [audit] removed: console.log(result.value)
        break
      }

      case 'exists': {
        const selector = args[1]
        if (!selector) {
          // [audit] removed: console.error('Usage: automate exists <selector>')
          process.exit(1)
        }
        const _result = await api<{ ok: boolean; exists: boolean }>(
          `/api/automate/exists?selector=${encodeURIComponent(selector)}`,
        )
        // [audit] removed: console.log(result.exists ? 'yes' : 'no')
        break
      }

      case 'screenshot': {
        const result = await api<{ ok: boolean; screenshot?: string }>('/api/automate/screenshot', {
          method: 'POST',
        })
        if (result.screenshot) {
          const path = `screenshot-${Date.now()}.png`
          const { writeFileSync } = await import('node:fs')
          writeFileSync(path, Buffer.from(result.screenshot, 'base64'))
          // [audit] removed: console.log(`Screenshot saved: ${path}`)
        }
        break
      }

      case 'page': {
        const _result = await api<{ ok: boolean; title: string; url: string; content: string }>(
          '/api/automate/page',
        )
        // [audit] removed: console.log(`Title: ${result.title}`)
        // [audit] removed: console.log(`URL: ${result.url}`)
        // [audit] removed: console.log('---')
        // [audit] removed: console.log(result.content)
        break
      }

      case 'reset': {
        await api('/api/automate/reset', { method: 'POST' })
        break
      }

      default: {
        // [audit] removed: console.log — help text
      }
    }
  } catch (_err) {
    // [audit] removed: console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

if (import.meta.main) {
  runAutomate(process.argv.slice(2)).catch((_err) => {
    // [audit] removed: console.error(err)
    process.exit(1)
  })
}
