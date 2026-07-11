// tests/unit/devops/decision.test.ts
// Unit tests for the Architecture Decision Record (ADR) system.

import { beforeAll, describe, expect, test } from 'bun:test'
import {
  addHumanReview,
  addReview,
  formatReviewStatus,
  generateReviewPrompt,
  getReviewStatus,
  validateDecisionReadiness,
  validateReviewReadiness,
} from '../../../devops/decision-review.ts'
import {
  approve,
  compareOptions,
  createDecision,
  decide,
  getDecision,
  listDecisions,
  renderDecisionMarkdown,
  updateAnalysis,
  updateDecision,
} from '../../../devops/decision.ts'

// ── Test data ─────────────────────────────────────────────────────────────

const TEST_INPUT = {
  title: 'CDP Transport Strategy',
  author: 'test-user',
  problemStatement: 'We need a CDP transport layer for Chrome communication.',
  context: 'ChromeGovernor needs a CDP transport to communicate with Chrome via WebSocket.',
  options: [
    {
      name: 'Raw WebSocket',
      description: 'Port BunCdpClient from cap-store.',
      pros: ['Battle-tested', 'Production code'],
      cons: ['Legacy code', 'Needs adaptation'],
      effort: 'M' as const,
      risk: 'low' as const,
    },
    {
      name: 'Custom CDP Client',
      description: 'Build new CDP client from scratch.',
      pros: ['Clean interface', 'No legacy'],
      cons: ['More effort', 'No production testing'],
      effort: 'L' as const,
      risk: 'medium' as const,
    },
  ],
  relatedUnits: ['11.1', '11.2'],
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Decision Record', () => {
  let createdId: string

  test('createDecision() creates a new ADR with correct status', async () => {
    const record = await createDecision(TEST_INPUT)

    expect(record.id).toMatch(/^ADR-\d+$/)
    expect(record.title).toBe('CDP Transport Strategy')
    expect(record.status).toBe('proposed')
    expect(record.author).toBe('test-user')
    expect(record.options).toHaveLength(2)
    expect(record.options[0]?.id).toBe('A')
    expect(record.options[1]?.id).toBe('B')
    expect(record.reviewHistory).toHaveLength(0)

    createdId = record.id
  })

  test('getDecision() retrieves a created ADR', async () => {
    const record = await getDecision(createdId)

    expect(record).not.toBeNull()
    expect(record?.id).toBe(createdId)
    expect(record?.title).toBe('CDP Transport Strategy')
    expect(record?.status).toBe('proposed')
    expect(record?.options).toHaveLength(2)
  })

  test('getDecision() returns null for non-existent ADR', async () => {
    const record = await getDecision('ADR-999')
    expect(record).toBeNull()
  })

  test('listDecisions() lists all ADRs', async () => {
    const decisions = await listDecisions()

    expect(decisions.length).toBeGreaterThanOrEqual(1)
    const found = decisions.find((d) => d.id === createdId)
    expect(found).toBeDefined()
  })

  test('updateDecision() updates status with valid transition', async () => {
    const record = await updateDecision(createdId, { status: 'in_review' })

    expect(record.status).toBe('in_review')
  })

  test('updateDecision() throws on invalid status transition', async () => {
    // Try to go from in_review directly to approved (skipping decided)
    await expect(updateDecision(createdId, { status: 'approved' })).rejects.toThrow(
      'Invalid status transition',
    )
  })

  test('decide() selects an option and sets rationale', async () => {
    const record = await decide(createdId, 'A', 'Battle-tested code reduces risk.')

    expect(record.status).toBe('decided')
    expect(record.decidedOption).toBe('A')
    expect(record.rationale).toBe('Battle-tested code reduces risk.')
  })

  test('decide() throws for non-existent option', async () => {
    await expect(decide(createdId, 'Z', 'reason')).rejects.toThrow('Option Z not found')
  })

  test('approve() sets status to approved', async () => {
    const record = await approve(createdId)

    expect(record.status).toBe('approved')
  })

  test('approve() throws on already approved decision', async () => {
    await expect(approve(createdId)).rejects.toThrow('already approved')
  })

  test('renderDecisionMarkdown() produces valid markdown', async () => {
    const record = await getDecision(createdId)
    expect(record).not.toBeNull()

    const md = renderDecisionMarkdown(record as NonNullable<typeof record>)

    expect(md).toContain('# ADR-')
    expect(md).toContain('CDP Transport Strategy')
    expect(md).toContain('**Status:** APPROVED')
    expect(md).toContain('## Problem Statement')
    expect(md).toContain('## Options Considered')
    expect(md).toContain('## Analysis')
    expect(md).toContain('## Decision')
    expect(md).toContain('## Consequences')
    expect(md).toContain('## Review History')
  })
})

describe('Decision Review', () => {
  let testId: string

  beforeAll(async () => {
    const record = await createDecision({
      title: 'Review Test Decision',
      author: 'test-user',
      problemStatement: 'Test problem',
      context: 'Test context',
      options: [
        { name: 'Option A', description: 'A', pros: [], cons: [], effort: 'S', risk: 'low' },
        { name: 'Option B', description: 'B', pros: [], cons: [], effort: 'S', risk: 'low' },
      ],
    })
    testId = record.id
  })

  test('addReview() adds a review round', async () => {
    const { record, round } = await addReview(testId, {
      reviewer: 'AI',
      type: 'ai',
      feedback: 'Option A is lower risk.',
      changesMade: 'Added edge case analysis.',
    })

    expect(round).toBe(1)
    expect(record.reviewHistory).toHaveLength(1)
    expect(record.reviewHistory[0]?.type).toBe('ai')
    expect(record.status).toBe('in_review')
  })

  test('addHumanReview() adds a human review', async () => {
    const { record, round } = await addHumanReview(testId, 'Product Manager', 'Agree with A.', '')

    expect(round).toBe(2)
    expect(record.reviewHistory).toHaveLength(2)
    expect(record.reviewHistory[1]?.type).toBe('human')
    expect(record.status).toBe('revised')
  })

  test('validateReviewReadiness() checks for minimum options', async () => {
    const noOptions = await createDecision({
      title: 'No Options',
      author: 'test',
      problemStatement: 'test',
      context: 'test',
      options: [],
    })

    const readiness = validateReviewReadiness(noOptions)
    expect(readiness.ready).toBe(false)
    expect(readiness.reason).toContain('At least 2 options')
  })

  test('validateDecisionReadiness() enforces minimum 2 rounds', async () => {
    // Create a fresh record with no reviews
    const fresh = await createDecision({
      title: 'Fresh Decision',
      author: 'test',
      problemStatement: 'test',
      context: 'test',
      options: [
        { name: 'A', description: 'A', pros: [], cons: [], effort: 'S', risk: 'low' },
        { name: 'B', description: 'B', pros: [], cons: [], effort: 'S', risk: 'low' },
      ],
    })

    const readiness = validateDecisionReadiness(fresh)
    expect(readiness.ready).toBe(false)
    expect(readiness.reason).toContain('Minimum 2 review rounds')
  })

  test('validateDecisionReadiness() passes after 2 rounds', async () => {
    // Already has 2 rounds from previous tests
    const record = await getDecision(testId)
    expect(record).not.toBeNull()

    const readiness = validateDecisionReadiness(record as NonNullable<typeof record>)
    expect(readiness.ready).toBe(true)
  })

  test('getReviewStatus() returns correct summary', async () => {
    const record = await getDecision(testId)
    expect(record).not.toBeNull()

    const status = getReviewStatus(record as NonNullable<typeof record>)
    expect(status.totalRounds).toBe(2)
    expect(status.hasAiReview).toBe(true)
    expect(status.hasHumanReview).toBe(true)
    expect(status.canDecide).toBe(true)
    expect(status.blockers).toHaveLength(0)
  })

  test('formatReviewStatus() produces readable output', async () => {
    const record = await getDecision(testId)
    expect(record).not.toBeNull()

    const output = formatReviewStatus(record as NonNullable<typeof record>)
    expect(output).toContain('Review Status for')
    expect(output).toContain('Total rounds: 2')
    expect(output).toContain('Can decide: Yes')
  })

  test('addReview() throws on already approved decision', async () => {
    const approved = await createDecision({
      title: 'Already Approved',
      author: 'test',
      problemStatement: 'test',
      context: 'test',
      options: [
        { name: 'A', description: 'A', pros: [], cons: [], effort: 'S', risk: 'low' },
        { name: 'B', description: 'B', pros: [], cons: [], effort: 'S', risk: 'low' },
      ],
    })
    // Transition: proposed → in_review → decided → approved
    await updateDecision(approved.id, { status: 'in_review' })
    await updateDecision(approved.id, { status: 'decided' })
    await approve(approved.id)

    await expect(
      addReview(approved.id, {
        reviewer: 'AI',
        type: 'ai',
        feedback: 'Too late',
        changesMade: '',
      }),
    ).rejects.toThrow('already approved')
  })
})

// ── New feature tests ────────────────────────────────────────────────────

describe('updateAnalysis()', () => {
  let analysisId: string

  beforeAll(async () => {
    const record = await createDecision({
      title: 'Analysis Test',
      author: 'test',
      problemStatement: 'test problem',
      context: 'test context',
      options: [{ name: 'A', description: 'A', pros: [], cons: [], effort: 'S', risk: 'low' }],
    })
    analysisId = record.id
  })

  test('fills analysis and consequences', async () => {
    const record = await updateAnalysis(analysisId, 'Test analysis text', 'Test consequences')
    expect(record.analysis).toBe('Test analysis text')
    expect(record.consequences).toBe('Test consequences')
  })

  test('throws on already approved', async () => {
    const approved = await createDecision({
      title: 'Approved',
      author: 'test',
      problemStatement: 'test',
      context: 'test',
      options: [{ name: 'A', description: 'A', pros: [], cons: [], effort: 'S', risk: 'low' }],
    })
    await updateDecision(approved.id, { status: 'in_review' })
    await updateDecision(approved.id, { status: 'decided' })
    await approve(approved.id)

    await expect(updateAnalysis(approved.id, 'a', 'c')).rejects.toThrow('already approved')
  })
})

describe('compareOptions()', () => {
  test('generates comparison table', async () => {
    const record = await createDecision({
      title: 'Compare Test',
      author: 'test',
      problemStatement: 'test',
      context: 'test',
      options: [
        {
          name: 'Fast',
          description: 'fast',
          pros: ['Speed'],
          cons: ['Risk'],
          effort: 'S',
          risk: 'high',
          goalAlignment: 3,
        },
        {
          name: 'Safe',
          description: 'safe',
          pros: ['Reliable'],
          cons: ['Slow'],
          effort: 'L',
          risk: 'low',
          goalAlignment: 5,
        },
      ],
    })

    const table = compareOptions(record)
    expect(table).toContain('| Attribute |')
    expect(table).toContain('| Effort |')
    expect(table).toContain('| Risk |')
    expect(table).toContain('| Goal Alignment |')
    expect(table).toContain('3/5')
    expect(table).toContain('5/5')
    expect(table).toContain('| Pros |')
    expect(table).toContain('| Cons |')
  })

  test('returns message for no options', async () => {
    const record = await createDecision({
      title: 'Empty',
      author: 'test',
      problemStatement: 'test',
      context: 'test',
      options: [],
    })
    expect(compareOptions(record)).toBe('No options to compare.')
  })

  test('shows [pending goals] when no goal scores', async () => {
    const record = await createDecision({
      title: 'No Goals',
      author: 'test',
      problemStatement: 'test',
      context: 'test',
      options: [{ name: 'A', description: 'a', pros: [], cons: [], effort: 'S', risk: 'low' }],
    })
    expect(compareOptions(record)).toContain('[pending goals]')
  })

  test('shows SELECTED when decided', async () => {
    const record = await createDecision({
      title: 'Decided',
      author: 'test',
      problemStatement: 'test',
      context: 'test',
      options: [
        { name: 'A', description: 'a', pros: [], cons: [], effort: 'S', risk: 'low' },
        { name: 'B', description: 'b', pros: [], cons: [], effort: 'S', risk: 'low' },
      ],
    })
    await updateDecision(record.id, { status: 'in_review' })
    await decide(record.id, 'A', 'reason')
    const updated = await getDecision(record.id)
    expect(updated).not.toBeNull()
    expect(compareOptions(updated as NonNullable<typeof updated>)).toContain('**SELECTED**')
  })
})

describe('generateReviewPrompt()', () => {
  test('produces structured questions for options', async () => {
    const record = await createDecision({
      title: 'Prompt Test',
      author: 'test',
      problemStatement: 'test',
      context: 'test',
      options: [
        { name: 'A', description: 'a', pros: [], cons: [], effort: 'S', risk: 'low' },
        { name: 'B', description: 'b', pros: [], cons: [], effort: 'S', risk: 'low' },
      ],
    })

    const prompt = generateReviewPrompt(record)
    expect(prompt.decisionId).toBe(record.id)
    expect(prompt.questions.length).toBeGreaterThanOrEqual(4)

    const prefQ = prompt.questions.find((q) => q.id === 'preference')
    expect(prefQ).toBeDefined()
    expect(prefQ?.type).toBe('choice')
    expect(prefQ?.options).toHaveLength(2)
    expect(prefQ?.required).toBe(true)

    const riskQ = prompt.questions.find((q) => q.id === 'risk')
    expect(riskQ).toBeDefined()
    expect(riskQ?.options).toContain('low')
  })
})

describe('goalAlignment parsing', () => {
  test('round-trips through markdown', async () => {
    const record = await createDecision({
      title: 'Goal Roundtrip',
      author: 'test',
      problemStatement: 'test',
      context: 'test',
      options: [
        {
          name: 'A',
          description: 'a',
          pros: [],
          cons: [],
          effort: 'S',
          risk: 'low',
          goalAlignment: 4,
        },
      ],
    })

    const md = renderDecisionMarkdown(record)
    expect(md).toContain('**Goal Alignment:** 4/5')

    const parsed = await getDecision(record.id)
    expect(parsed).not.toBeNull()
    expect(parsed?.options[0]?.goalAlignment).toBe(4)
  })
})
