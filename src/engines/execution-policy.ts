// src/engines/execution-policy.ts
// ExecutionPolicyEngine — classify actions and enforce approval policies

import { EngineError } from '../errors.js'
import { newId } from '../ids.js'
import type { ActionClassification } from './autonomous-execution.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface PolicyRule {
  id: string
  name: string
  condition: string
  classification: ActionClassification
  requiresApproval: boolean
  cooldownMs: number
  maxOccurrences: number
  windowMs: number
  isActive: boolean
}

export interface PolicyDecision {
  allowed: boolean
  classification: ActionClassification
  requiresApproval: boolean
  reason: string
  matchedRule: string | null
}

export interface PolicyStore {
  createRule(rule: Record<string, unknown>): Promise<void>
  updateRule(id: string, patch: Record<string, unknown>): Promise<void>
  getRule(id: string): Promise<Record<string, unknown> | null>
  listRules(): Promise<Array<Record<string, unknown>>>
  getRecentOccurrences(action: string, windowMs: number): Promise<number>
}

// ── Default Rules ────────────────────────────────────────────────────────

const DEFAULT_RULES: Array<Omit<PolicyRule, 'id'>> = [
  {
    name: 'read_only_safe',
    condition: 'action matches ^(get|list|read|query|fetch|search)$',
    classification: 'read',
    requiresApproval: false,
    cooldownMs: 0,
    maxOccurrences: Number.POSITIVE_INFINITY,
    windowMs: 60_000,
    isActive: true,
  },
  {
    name: 'navigate_safe',
    condition: 'action matches ^(navigate|goto|open|visit)$',
    classification: 'navigate',
    requiresApproval: false,
    cooldownMs: 0,
    maxOccurrences: Number.POSITIVE_INFINITY,
    windowMs: 60_000,
    isActive: true,
  },
  {
    name: 'write_needs_approval',
    condition: 'action matches ^(create|update|delete|submit|save|write|patch)$',
    classification: 'write',
    requiresApproval: true,
    cooldownMs: 0,
    maxOccurrences: 10,
    windowMs: 60_000,
    isActive: true,
  },
  {
    name: 'destructive_always',
    condition: 'action matches ^(delete_permanent|format|reset|drop|purge|destroy)$',
    classification: 'destructive',
    requiresApproval: true,
    cooldownMs: 5_000,
    maxOccurrences: 3,
    windowMs: 300_000,
    isActive: true,
  },
  {
    name: 'financial_always',
    condition: 'action matches ^(purchase|pay|transfer|checkout|buy|subscribe)$',
    classification: 'financial',
    requiresApproval: true,
    cooldownMs: 10_000,
    maxOccurrences: 5,
    windowMs: 600_000,
    isActive: true,
  },
  {
    name: 'communication_always',
    condition: 'action matches ^(send_email|send_message|post_comment|reply)$',
    classification: 'communication',
    requiresApproval: true,
    cooldownMs: 0,
    maxOccurrences: 20,
    windowMs: 60_000,
    isActive: true,
  },
]

// ── Engine ──────────────────────────────────────────────────────────────

export class ExecutionPolicyEngine {
  private rules: PolicyRule[] = []
  private initialized = false

  constructor(private readonly store: PolicyStore) {}

  async initialize(): Promise<void> {
    if (this.initialized) return
    const stored = await this.store.listRules()
    if (stored.length === 0) {
      for (const rule of DEFAULT_RULES) {
        const id = newId()
        await this.store.createRule({ ...rule, id })
        this.rules.push({ ...rule, id })
      }
    } else {
      this.rules = stored.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        condition: r.condition as string,
        classification: r.classification as ActionClassification,
        requiresApproval: r.requiresApproval as boolean,
        cooldownMs: r.cooldownMs as number,
        maxOccurrences: r.maxOccurrences as number,
        windowMs: r.windowMs as number,
        isActive: r.isActive as boolean,
      }))
    }
    this.initialized = true
  }

  async evaluate(action: string, _input: Record<string, unknown>): Promise<PolicyDecision> {
    await this.initialize()

    const classification = await this.classify(action)
    const matchedRule = this.findMatchingRule(action)

    if (!matchedRule) {
      return {
        allowed: true,
        classification,
        requiresApproval: false,
        reason: 'No matching rule — default allow',
        matchedRule: null,
      }
    }

    // Check cooldown
    if (matchedRule.cooldownMs > 0) {
      const recentCount = await this.store.getRecentOccurrences(action, matchedRule.cooldownMs)
      if (recentCount > 0) {
        return {
          allowed: false,
          classification,
          requiresApproval: matchedRule.requiresApproval,
          reason: `Cooldown active (${matchedRule.cooldownMs}ms) — ${recentCount} recent occurrence(s)`,
          matchedRule: matchedRule.name,
        }
      }
    }

    // Check max occurrences in window
    if (matchedRule.maxOccurrences < Number.POSITIVE_INFINITY && matchedRule.windowMs > 0) {
      const recentCount = await this.store.getRecentOccurrences(action, matchedRule.windowMs)
      if (recentCount >= matchedRule.maxOccurrences) {
        return {
          allowed: false,
          classification,
          requiresApproval: matchedRule.requiresApproval,
          reason: `Max occurrences (${matchedRule.maxOccurrences}) reached in ${matchedRule.windowMs}ms window`,
          matchedRule: matchedRule.name,
        }
      }
    }

    return {
      allowed: true,
      classification,
      requiresApproval: matchedRule.requiresApproval,
      reason: matchedRule.requiresApproval
        ? `Requires approval: ${matchedRule.name}`
        : `Allowed by rule: ${matchedRule.name}`,
      matchedRule: matchedRule.name,
    }
  }

  async classify(action: string): Promise<ActionClassification> {
    await this.initialize()
    const rule = this.findMatchingRule(action)
    return rule?.classification ?? 'read'
  }

  async addRule(rule: Omit<PolicyRule, 'id'>): Promise<PolicyRule> {
    await this.initialize()
    const id = newId()
    const newRule: PolicyRule = { ...rule, id }
    await this.store.createRule(newRule as unknown as Record<string, unknown>)
    this.rules.push(newRule)
    return newRule
  }

  async listRules(): Promise<PolicyRule[]> {
    await this.initialize()
    return [...this.rules]
  }

  async updateRule(id: string, patch: Partial<PolicyRule>): Promise<void> {
    await this.initialize()
    const idx = this.rules.findIndex((r) => r.id === id)
    if (idx === -1) throw new EngineError(`Rule not found: ${id}`)
    this.rules[idx] = { ...this.rules[idx], ...patch } as PolicyRule
    await this.store.updateRule(id, patch as Record<string, unknown>)
  }

  private findMatchingRule(action: string): PolicyRule | null {
    const lower = action.toLowerCase()
    for (const rule of this.rules) {
      if (!rule.isActive) continue
      const pattern = rule.condition.replace(/^action matches\s+/, '')
      try {
        const regex = new RegExp(pattern, 'i')
        if (regex.test(lower)) return rule
      } catch {
        if (lower === rule.name.toLowerCase()) return rule
      }
    }
    return null
  }
}
