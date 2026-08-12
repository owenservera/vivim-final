// scripts/taxonomy-gen/lib/llm-ping.ts
// Autonomous LLM caller. In --mode auto, sends the prompt to an LLM API and
// parses JSON. In --mode agent, prints the prompt for the opencode agent to fulfill.
//
// Supports Z.AI (OpenAI-compatible) and OpenAI. Reads API key from env.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export type PingMode = 'auto' | 'agent'

export interface PingResult {
  mode: PingMode
  prompt: string
  outputPath?: string
  raw?: string
  parsed?: unknown
}

const OUTPUT_DIR = join(import.meta.dir, '..', 'output')

export async function ping(
  prompt: string,
  opts: { mode: PingMode; outputPath?: string; model?: string }
): Promise<PingResult> {
  if (opts.mode === 'agent') {
    // Print prompt for the agent to fulfill; do not call API
    // [audit] removed: console.log('\n' + '═'.repeat(70))
    // [audit] removed: console.log('🔷 PROMPT (agent mode — generate the output, save to ' + (opts.outputPath ?? '<path>') + ')')
    console.log('═'.repeat(70))
    console.log(prompt)
    console.log('═'.repeat(70) + '\n')
    return { mode: 'agent', prompt, outputPath: opts.outputPath }
  }

  // Auto mode: call LLM API
  const apiKey = process.env.ZAI_API_KEY ?? process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Auto mode requires ZAI_API_KEY or OPENAI_API_KEY in env. Use --mode agent instead.')
  }
  const baseUrl = process.env.ZAI_API_KEY
    ? 'https://api.z.ai/api/paas/v4/chat/completions'
    : 'https://api.openai.com/v1/chat/completions'
  const model = opts.model ?? (process.env.ZAI_API_KEY ? 'glm-4.6' : 'gpt-4o')

  const raw = await callLlm(baseUrl, apiKey, model, prompt)
  const parsed = extractJson(raw)

  if (opts.outputPath) {
    const full = join(OUTPUT_DIR, opts.outputPath)
    if (!existsSync(join(full, '..'))) mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, JSON.stringify(parsed, null, 2))
  }

  return { mode: 'auto', prompt, outputPath: opts.outputPath, raw, parsed }
}

async function callLlm(baseUrl: string, apiKey: string, model: string, prompt: string): Promise<string> {
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a taxonomy generation engine. Always respond with strict, valid JSON only. No markdown fences, no commentary.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  })
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return json.choices?.[0]?.message?.content ?? ''
}

function extractJson(raw: string): unknown {
  // Strip markdown fences if present
  let s = raw.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim()
  }
  return JSON.parse(s)
}
