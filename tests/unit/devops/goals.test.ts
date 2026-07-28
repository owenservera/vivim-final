import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

// Test temp directory
const TEST_DIR = join(import.meta.dir, '..', '..', '..', '.test-goals')
const _TEST_GOALS_FILE = join(TEST_DIR, 'docs', 'goals', 'GOALS.md')

// Mock the GOALS_FILE path by setting env
process.env.VIVIM_TEST_DIR = TEST_DIR

// We need to test the pure functions directly
// Import types and pure functions

type GoalStatus = 'not_started' | 'in_progress' | 'achieved' | 'blocked'

interface KeyResult {
  id: string
  title: string
  description: string
  metric: string
  target: number
  current: number
  status: GoalStatus
  relatedUnits: string[]
}

interface Objective {
  id: string
  title: string
  description: string
  status: GoalStatus
  completion: number
  keyResults: KeyResult[]
}

interface Goal {
  id: string
  title: string
  description: string
  status: GoalStatus
  completion: number
  owner: string
  timeframe: string
  objectives: Objective[]
}

interface TrackerUnit {
  id: string
  status: 'pending' | 'in_progress' | 'done' | 'blocked'
}

// Pure functions to test (extracted from goals-progress.ts logic)
function calculateKeyResultProgress(kr: KeyResult, tracker: TrackerUnit[]): number {
  if (kr.relatedUnits.length === 0) {
    return kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : 0
  }
  const relatedTrackerUnits = tracker.filter((t) =>
    kr.relatedUnits.some((ru) => t.id.startsWith(ru) || ru.startsWith(t.id)),
  )
  if (relatedTrackerUnits.length === 0) {
    return kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : 0
  }
  const doneCount = relatedTrackerUnits.filter((t) => t.status === 'done').length
  const atomicProgress = Math.round((doneCount / relatedTrackerUnits.length) * 100)
  const manualProgress =
    kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : 0
  return Math.max(manualProgress, atomicProgress)
}

function calculateObjectiveProgress(obj: Objective, tracker: TrackerUnit[]): number {
  if (obj.keyResults.length === 0) return obj.completion
  const totalProgress = obj.keyResults.reduce(
    (sum, kr) => sum + calculateKeyResultProgress(kr, tracker),
    0,
  )
  return Math.round(totalProgress / obj.keyResults.length)
}

function calculateGoalProgress(goal: Goal, tracker: TrackerUnit[]): number {
  if (goal.objectives.length === 0) return goal.completion
  const totalProgress = goal.objectives.reduce(
    (sum, obj) => sum + calculateObjectiveProgress(obj, tracker),
    0,
  )
  return Math.round(totalProgress / goal.objectives.length)
}

function calculateGoalContribution(unitId: string, goals: Goal[]): number {
  let score = 0
  for (const goal of goals) {
    for (const obj of goal.objectives) {
      for (const kr of obj.keyResults) {
        if (kr.relatedUnits.some((ru) => unitId.startsWith(ru) || ru.startsWith(unitId))) {
          score++
        }
      }
    }
  }
  return score
}

// Alignment scoring logic (extracted from goals-align.ts)
interface AlignmentScore {
  goalId: string
  goalTitle: string
  score: number
  reason: string
}

function suggestAlignmentScore(
  option: { id: string; name: string; effort: string; risk: string; relatedUnits?: string[] },
  goals: Goal[],
): AlignmentScore[] {
  const scores: AlignmentScore[] = []
  for (const goal of goals) {
    let score = 0
    const reasons: string[] = []
    for (const obj of goal.objectives) {
      for (const kr of obj.keyResults) {
        if (option.relatedUnits && kr.relatedUnits.length > 0) {
          const overlap = option.relatedUnits.some((ru) =>
            kr.relatedUnits.some((kru) => ru.startsWith(kru) || kru.startsWith(ru)),
          )
          if (overlap) {
            score++
            reasons.push(`contributes to ${kr.id}`)
          }
        }
      }
    }
    if (option.effort === 'L' || option.effort === 'XL') {
      score = Math.max(1, score - 0.5)
      reasons.push('high effort penalty')
    }
    if (option.risk === 'high') {
      score = Math.max(1, score - 0.5)
      reasons.push('high risk penalty')
    }
    const finalScore = Math.max(1, Math.min(5, Math.round(score)))
    scores.push({
      goalId: goal.id,
      goalTitle: goal.title,
      score: finalScore,
      reason: reasons.join('; ') || 'no direct alignment found',
    })
  }
  return scores
}

describe('GOALS System', () => {
  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
    await mkdir(join(TEST_DIR, 'docs', 'goals'), { recursive: true })
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  describe('Progress Calculation', () => {
    it('calculates key result progress from current/target', () => {
      const kr: KeyResult = {
        id: 'KR-001',
        title: 'Test KR',
        description: '',
        metric: 'completion %',
        target: 100,
        current: 50,
        status: 'not_started',
        relatedUnits: [],
      }
      expect(calculateKeyResultProgress(kr, [])).toBe(50)
    })

    it('clamps progress to 100', () => {
      const kr: KeyResult = {
        id: 'KR-001',
        title: 'Test KR',
        description: '',
        metric: 'completion %',
        target: 50,
        current: 100,
        status: 'not_started',
        relatedUnits: [],
      }
      expect(calculateKeyResultProgress(kr, [])).toBe(100)
    })

    it('returns 0 when target is 0', () => {
      const kr: KeyResult = {
        id: 'KR-001',
        title: 'Test KR',
        description: '',
        metric: 'completion %',
        target: 0,
        current: 0,
        status: 'not_started',
        relatedUnits: [],
      }
      expect(calculateKeyResultProgress(kr, [])).toBe(0)
    })

    it('calculates progress from related units', () => {
      const kr: KeyResult = {
        id: 'KR-001',
        title: 'Test KR',
        description: '',
        metric: 'completion %',
        target: 100,
        current: 0,
        status: 'not_started',
        relatedUnits: ['11.1', '11.2'],
      }
      const tracker: TrackerUnit[] = [
        { id: '11.1', status: 'done' },
        { id: '11.2', status: 'done' },
      ]
      expect(calculateKeyResultProgress(kr, tracker)).toBe(100)
    })

    it('calculates partial progress from related units', () => {
      const kr: KeyResult = {
        id: 'KR-001',
        title: 'Test KR',
        description: '',
        metric: 'completion %',
        target: 100,
        current: 0,
        status: 'not_started',
        relatedUnits: ['11.1', '11.2', '11.3'],
      }
      const tracker: TrackerUnit[] = [
        { id: '11.1', status: 'done' },
        { id: '11.2', status: 'done' },
        { id: '11.3', status: 'pending' },
      ]
      expect(calculateKeyResultProgress(kr, tracker)).toBe(67)
    })

    it('uses manual progress when higher than atomic-derived', () => {
      const kr: KeyResult = {
        id: 'KR-001',
        title: 'Test KR',
        description: '',
        metric: 'completion %',
        target: 100,
        current: 80,
        status: 'not_started',
        relatedUnits: ['11.1'],
      }
      const tracker: TrackerUnit[] = [
        { id: '11.1', status: 'in_progress' }, // atomic-derived = 0%
      ]
      // Manual is 80%, atomic-derived is 0%, max is 80%
      expect(calculateKeyResultProgress(kr, tracker)).toBe(80)
    })

    it('calculates objective progress as average of key results', () => {
      const obj: Objective = {
        id: 'O-001',
        title: 'Test Obj',
        description: '',
        status: 'not_started',
        completion: 0,
        keyResults: [
          {
            id: 'KR-001',
            title: 'KR1',
            description: '',
            metric: '%',
            target: 100,
            current: 100,
            status: 'not_started',
            relatedUnits: [],
          },
          {
            id: 'KR-002',
            title: 'KR2',
            description: '',
            metric: '%',
            target: 100,
            current: 0,
            status: 'not_started',
            relatedUnits: [],
          },
        ],
      }
      expect(calculateObjectiveProgress(obj, [])).toBe(50)
    })

    it('calculates goal progress as average of objectives', () => {
      const goal: Goal = {
        id: 'G-001',
        title: 'Test Goal',
        description: '',
        status: 'not_started',
        completion: 0,
        owner: 'user',
        timeframe: '',
        objectives: [
          {
            id: 'O-001',
            title: 'Obj1',
            description: '',
            status: 'not_started',
            completion: 100,
            keyResults: [],
          },
          {
            id: 'O-002',
            title: 'Obj2',
            description: '',
            status: 'not_started',
            completion: 50,
            keyResults: [],
          },
        ],
      }
      expect(calculateGoalProgress(goal, [])).toBe(75)
    })
  })

  describe('Goal Contribution Scoring', () => {
    it('scores unit contribution to goals', () => {
      const goals: Goal[] = [
        {
          id: 'G-001',
          title: 'Test Goal',
          description: '',
          status: 'not_started',
          completion: 0,
          owner: 'user',
          timeframe: '',
          objectives: [
            {
              id: 'O-001',
              title: 'Test Obj',
              description: '',
              status: 'not_started',
              completion: 0,
              keyResults: [
                {
                  id: 'KR-001',
                  title: 'KR1',
                  description: '',
                  metric: '%',
                  target: 100,
                  current: 0,
                  status: 'not_started',
                  relatedUnits: ['11.1', '11.2'],
                },
                {
                  id: 'KR-002',
                  title: 'KR2',
                  description: '',
                  metric: '%',
                  target: 100,
                  current: 0,
                  status: 'not_started',
                  relatedUnits: ['11.2', '11.3'],
                },
              ],
            },
          ],
        },
      ]
      // 11.2 contributes to both KR-001 and KR-002
      expect(calculateGoalContribution('11.2', goals)).toBe(2)
      // 11.1 contributes to KR-001 only
      expect(calculateGoalContribution('11.1', goals)).toBe(1)
      // 99.9 contributes to nothing
      expect(calculateGoalContribution('99.9', goals)).toBe(0)
    })
  })

  describe('Alignment Scoring', () => {
    it('suggests alignment scores based on related units', () => {
      const goals: Goal[] = [
        {
          id: 'G-001',
          title: 'Consumer Chat MVP',
          description: '',
          status: 'not_started',
          completion: 0,
          owner: 'user',
          timeframe: '',
          objectives: [
            {
              id: 'O-001',
              title: 'Chrome Automation',
              description: '',
              status: 'not_started',
              completion: 0,
              keyResults: [
                {
                  id: 'KR-001',
                  title: 'CDP Client',
                  description: '',
                  metric: '%',
                  target: 100,
                  current: 0,
                  status: 'not_started',
                  relatedUnits: ['11.1', '11.2'],
                },
              ],
            },
          ],
        },
      ]
      const option = {
        id: 'A',
        name: 'Raw WebSocket',
        effort: 'M',
        risk: 'low',
        relatedUnits: ['11.1', '11.2'],
      }
      const scores = suggestAlignmentScore(option, goals)
      expect(scores.length).toBe(1)
      const s0 = scores[0]!
      expect(s0.goalId).toBe('G-001')
      expect(s0.score).toBeGreaterThanOrEqual(1)
    })

    it('applies effort penalty for high effort', () => {
      const goals: Goal[] = [
        {
          id: 'G-001',
          title: 'Test Goal',
          description: '',
          status: 'not_started',
          completion: 0,
          owner: 'user',
          timeframe: '',
          objectives: [
            {
              id: 'O-001',
              title: 'Test Obj',
              description: '',
              status: 'not_started',
              completion: 0,
              keyResults: [
                {
                  id: 'KR-001',
                  title: 'KR1',
                  description: '',
                  metric: '%',
                  target: 100,
                  current: 0,
                  status: 'not_started',
                  relatedUnits: ['11.1'],
                },
              ],
            },
          ],
        },
      ]
      const option = {
        id: 'A',
        name: 'Custom Build',
        effort: 'XL',
        risk: 'high',
        relatedUnits: ['11.1'],
      }
      const scores = suggestAlignmentScore(option, goals)
      const s0 = scores[0]!
      expect(s0.reason).toContain('high effort penalty')
      expect(s0.reason).toContain('high risk penalty')
    })

    it('returns minimum score of 1', () => {
      const goals: Goal[] = [
        {
          id: 'G-001',
          title: 'Test Goal',
          description: '',
          status: 'not_started',
          completion: 0,
          owner: 'user',
          timeframe: '',
          objectives: [
            {
              id: 'O-001',
              title: 'Test Obj',
              description: '',
              status: 'not_started',
              completion: 0,
              keyResults: [],
            },
          ],
        },
      ]
      const option = {
        id: 'A',
        name: 'Unrelated',
        effort: 'XL',
        risk: 'high',
        relatedUnits: ['99.9'],
      }
      const scores = suggestAlignmentScore(option, goals)
      const s0 = scores[0]!
      expect(s0.score).toBeGreaterThanOrEqual(1)
    })
  })
})
