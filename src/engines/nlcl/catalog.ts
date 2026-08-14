// src/engines/nlcl/catalog.ts
// Consumer Command Catalog — all NL command patterns for 95% consumer volume.
// Every pattern is deterministic (regex + keyword). NO AI required.
// Categories: file, browser, web+ai, email, app, conversation, llm, system, memory.
//
// This file is a THIN REGISTRY. Pattern data lives in categories/*.ts (pure
// data modules) and flows through the shared builder in categories/builder.ts.
// Add a new category by adding a file in categories/ and a line here.

import { aiPatterns } from './categories/ai.ts'
import { appPatterns } from './categories/app.ts'
import { automationPatterns } from './categories/automation.ts'
import { browserPatterns } from './categories/browser.ts'
import { canvasPatterns } from './categories/canvas.ts'
import { channelPatterns } from './categories/channel.ts'
import { conversationPatterns } from './categories/conversation.ts'
import { emailPatterns } from './categories/email.ts'
import { filePatterns } from './categories/file.ts'
import { llmPatterns } from './categories/llm.ts'
import { memoryPatterns } from './categories/memory.ts'
import { opencodePatterns } from './categories/opencode.ts'
import { providerCapPatterns } from './categories/provider-cap.ts'
import { sessionPatterns } from './categories/session.ts'
import { systemPatterns } from './categories/system.ts'
import { workflowPatterns } from './categories/workflow.ts'

import type { CommandPattern } from './types.js'

// ── Registry ────────────────────────────────────────────────────────────────

export { dayToCron, extractEmails } from './categories/builder.js'
export function getDefaultCommandPatterns(): CommandPattern[] {
  return [
    ...filePatterns,
    ...browserPatterns,
    ...llmPatterns,
    ...emailPatterns,
    ...appPatterns,
    ...conversationPatterns,
    ...systemPatterns,
    ...canvasPatterns,
    ...channelPatterns,
    ...sessionPatterns,
    ...workflowPatterns,
    ...memoryPatterns,
    ...automationPatterns,
    ...opencodePatterns,
    ...providerCapPatterns,
    ...aiPatterns,
  ]
}

export function getPatternsByCategory(): Record<string, CommandPattern[]> {
  const all = getDefaultCommandPatterns()
  const result: Record<string, CommandPattern[]> = {}
  for (const p of all) {
    if (!result[p.category]) result[p.category] = []
    result[p.category]?.push(p)
  }
  return result
}
