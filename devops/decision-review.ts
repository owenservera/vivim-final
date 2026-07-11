// devops/decision-review.ts
// Review round management for Architecture Decision Records.
//
// Enforces:
//   - Minimum 2 review rounds before decision
//   - Both AI and human must review
//   - Reviews must include feedback and changes made
//
// Workflow:
//   1. Add AI review (technical analysis)
//   2. Add human review (business/product fit)
//   3. Revise decision based on feedback
//   4. Second round of reviews
//   5. Proceed to decision

import {
  getDecision,
  updateDecision,
  type DecisionRecord,
  type AddReviewInput,
  type ReviewRound,
} from './decision.ts'

// ── Validation ────────────────────────────────────────────────────────────

const MIN_REVIEW_ROUNDS = 2

export function validateReviewReadiness(record: DecisionRecord): { ready: boolean; reason: string } {
  if (record.status === 'approved' || record.status === 'rejected') {
    return { ready: false, reason: `Decision is already ${record.status}` }
  }

  if (record.options.length < 2) {
    return { ready: false, reason: 'At least 2 options must be considered before review' }
  }

  return { ready: true, reason: 'OK' }
}

export function validateDecisionReadiness(record: DecisionRecord): { ready: boolean; reason: string } {
  if (record.status === 'approved' || record.status === 'rejected') {
    return { ready: false, reason: `Decision is already ${record.status}` }
  }

  if (record.reviewHistory.length < MIN_REVIEW_ROUNDS) {
    return {
      ready: false,
      reason: `Minimum ${MIN_REVIEW_ROUNDS} review rounds required. Currently: ${record.reviewHistory.length}`,
    }
  }

  const hasAiReview = record.reviewHistory.some(r => r.type === 'ai')
  const hasHumanReview = record.reviewHistory.some(r => r.type === 'human')

  if (!hasAiReview) {
    return { ready: false, reason: 'AI review required (technical analysis)' }
  }

  if (!hasHumanReview) {
    return { ready: false, reason: 'Human review required (business/product fit)' }
  }

  return { ready: true, reason: 'OK' }
}

// ── Add review ────────────────────────────────────────────────────────────

export async function addReview(
  id: string,
  input: AddReviewInput,
): Promise<{ record: DecisionRecord; round: number }> {
  const record = await getDecision(id)
  if (!record) {
    throw new Error(`Decision ${id} not found`)
  }

  const readiness = validateReviewReadiness(record)
  if (!readiness.ready) {
    throw new Error(readiness.reason)
  }

  const round = record.reviewHistory.length + 1

  const review: ReviewRound = {
    round,
    date: new Date().toISOString(),
    reviewer: input.reviewer,
    type: input.type,
    feedback: input.feedback,
    changesMade: input.changesMade,
  }

  const updated = await updateDecision(id, {
    status: round === 1 ? 'in_review' : 'revised',
    reviewers: [...new Set([...record.reviewers, input.reviewer])],
    reviewHistory: [...record.reviewHistory, review],
  })

  return { record: updated, round }
}

// ── AI review helper ──────────────────────────────────────────────────────

export async function addAiReview(
  id: string,
  feedback: string,
  changesMade: string,
): Promise<{ record: DecisionRecord; round: number }> {
  return addReview(id, {
    reviewer: 'AI',
    type: 'ai',
    feedback,
    changesMade,
  })
}

// ── Human review helper ───────────────────────────────────────────────────

export async function addHumanReview(
  id: string,
  reviewer: string,
  feedback: string,
  changesMade: string,
): Promise<{ record: DecisionRecord; round: number }> {
  return addReview(id, {
    reviewer,
    type: 'human',
    feedback,
    changesMade,
  })
}

// ── Status summary ────────────────────────────────────────────────────────

export function getReviewStatus(record: DecisionRecord): {
  totalRounds: number
  hasAiReview: boolean
  hasHumanReview: boolean
  canDecide: boolean
  blockers: string[]
} {
  const hasAiReview = record.reviewHistory.some(r => r.type === 'ai')
  const hasHumanReview = record.reviewHistory.some(r => r.type === 'human')
  const readiness = validateDecisionReadiness(record)

  return {
    totalRounds: record.reviewHistory.length,
    hasAiReview,
    hasHumanReview,
    canDecide: readiness.ready,
    blockers: readiness.ready ? [] : [readiness.reason],
  }
}

// ── Format review for display ─────────────────────────────────────────────

export function formatReview(review: ReviewRound): string {
  const lines: string[] = []

  lines.push(`### Round ${review.round}: ${review.date.slice(0, 10)}`)
  lines.push('')
  lines.push(`**Reviewer:** ${review.type === 'ai' ? 'AI (technical analysis)' : `Human (${review.reviewer})`}`)
  lines.push('')
  lines.push('**Feedback:**')
  lines.push(review.feedback)
  lines.push('')

  if (review.changesMade) {
    lines.push('**Changes Made:**')
    lines.push(review.changesMade)
    lines.push('')
  }

  return lines.join('\n')
}

export function formatReviewStatus(record: DecisionRecord): string {
  const status = getReviewStatus(record)
  const lines: string[] = []

  lines.push(`Review Status for ${record.id}:`)
  lines.push(`  Total rounds: ${status.totalRounds}`)
  lines.push(`  AI reviewed: ${status.hasAiReview ? 'Yes' : 'No'}`)
  lines.push(`  Human reviewed: ${status.hasHumanReview ? 'Yes' : 'No'}`)
  lines.push(`  Can decide: ${status.canDecide ? 'Yes' : 'No'}`)

  if (status.blockers.length > 0) {
    lines.push('  Blockers:')
    for (const blocker of status.blockers) {
      lines.push(`    - ${blocker}`)
    }
  }

  return lines.join('\n')
}

// ── Structured Review Prompts ──────────────────────────────────────────────

export type QuestionType = 'rating' | 'choice' | 'text'

export interface ReviewQuestion {
  id: string
  question: string
  type: QuestionType
  options?: string[]
  required: boolean
}

export interface ReviewPrompt {
  decisionId: string
  questions: ReviewQuestion[]
}

export interface ReviewAnswer {
  questionId: string
  value: string | number
}

export function generateReviewPrompt(record: DecisionRecord): ReviewPrompt {
  const questions: ReviewQuestion[] = []

  // Option preference question
  if (record.options.length >= 2) {
    questions.push({
      id: 'preference',
      question: 'Which option do you prefer?',
      type: 'choice',
      options: record.options.map(o => `${o.id}: ${o.name}`),
      required: true,
    })
  }

  // Feasibility ratings for each option
  if (record.options.length > 0) {
    questions.push({
      id: 'feasibility',
      question: 'Rate each option on feasibility (1=low, 5=high):',
      type: 'rating',
      required: true,
    })
  }

  // Concerns
  questions.push({
    id: 'concerns',
    question: 'What concerns do you have about the proposed options?',
    type: 'text',
    required: false,
  })

  // Suggested changes
  questions.push({
    id: 'changes',
    question: 'What changes would you suggest before deciding?',
    type: 'text',
    required: false,
  })

  // Risk assessment
  questions.push({
    id: 'risk',
    question: 'How would you assess the overall risk level?',
    type: 'choice',
    options: ['low', 'medium', 'high'],
    required: true,
  })

  return { decisionId: record.id, questions }
}

export function formatReviewPrompt(prompt: ReviewPrompt): string {
  const lines: string[] = []

  lines.push(`Review Prompt for ${prompt.decisionId}:`)
  lines.push('')

  for (const q of prompt.questions) {
    const required = q.required ? ' (required)' : ' (optional)'
    lines.push(`[${q.id}] ${q.question}${required}`)

    if (q.type === 'choice' && q.options) {
      for (const opt of q.options) {
        lines.push(`  - ${opt}`)
      }
    } else if (q.type === 'rating') {
      lines.push('  - 1 (low) to 5 (high)')
    }

    lines.push('')
  }

  return lines.join('\n')
}

export function addStructuredReview(
  id: string,
  prompt: ReviewPrompt,
  answers: ReviewAnswer[],
  reviewer: string,
  type: 'ai' | 'human',
): Promise<{ record: DecisionRecord; round: number }> {
  // Validate required questions are answered
  for (const q of prompt.questions) {
    if (q.required) {
      const answer = answers.find(a => a.questionId === q.id)
      if (!answer || (typeof answer.value === 'string' && !answer.value.trim())) {
        throw new Error(`Required question '${q.id}' not answered`)
      }
    }
  }

  // Format answers into feedback text
  const feedbackParts: string[] = []
  for (const answer of answers) {
    const question = prompt.questions.find(q => q.id === answer.questionId)
    if (question) {
      feedbackParts.push(`${question.question}\nAnswer: ${answer.value}`)
    }
  }

  return addReview(id, {
    reviewer,
    type,
    feedback: feedbackParts.join('\n\n'),
    changesMade: '',
  })
}
