import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

const manualPath = 'docs/user-manual.md'
const manual = readFileSync(manualPath, 'utf8')

const expectedHeadings = [
  '## 1. Getting started (onboarding)',
  '## 2. Navigating the workspace',
  '## 3. Authoring with canvases',
  '## 4. Delegating tasks to the agent (HITL, pause/resume)',
  '## 5. Curating your memory (verify / reject / edit)',
  '## 6. Setting up providers (local Ollama / cloud with consent)',
  '## 7. Backup & restore (.vivim bundle)',
  '## 8. Syncing across devices (pairing code)',
  '## 9. Troubleshooting (offline mode, consent errors, latency)',
]

describe('user-manual coverage', () => {
  it('contains all 9 section headings', () => {
    for (const heading of expectedHeadings) {
      expect(manual).toContain(heading)
    }
  })

  it('references modern start commands', () => {
    const commands = ['bun run dev', 'bun run dev:backend']

    for (const cmd of commands) {
      expect(manual).toContain(cmd)
    }
  })

  it('each section is task-oriented (starts with a goal)', () => {
    const sections = manual.split(/## \d+\.\s*/).slice(1)
    for (const section of sections) {
      const lines = section.split('\n')
      const _heading = lines[0]
      const contentStart = lines.slice(1).join('\n')
      expect(contentStart).toMatch(/Goal:/i)
    }
  })
})
