// src/engines/fsrs-scheduler.ts
// FSRS-6 Scheduler — implements the Free Spaced Repetition Scheduler algorithm
// for optimal memory retention scheduling

export type CardState = 'new' | 'learning' | 'review' | 'relearning'

export interface Card {
  id: string
  state: CardState
  due: number // Unix timestamp in milliseconds
  interval: number // Days until next review
  difficulty: number // 0-10 scale
  stability: number // Days
  lastReview?: number
  reps: number
  lapses: number
}

export interface ReviewResult {
  rating: number // 0-5 scale (0=again, 1=hard, 2=good, 3=easy, 4=very easy, 5=perfect)
  state: CardState
  due: number
  interval: number
  difficulty: number
  stability: number
  reps: number
  lapses: number
}

export class FsrsScheduler {
  private readonly requestRetention = 0.9
  private readonly maximumInterval = 36500 // 100 years
  private readonly w: [number, number, number, number] = [0.4, 0.6, 2.4, 5.8]

  calculate(card: Card, rating: number): ReviewResult {
    const now = Date.now()
    let state = card.state
    let interval = card.interval
    let difficulty = card.difficulty
    let stability = card.stability
    let reps = card.reps
    let lapses = card.lapses

    if (card.state === 'new') {
      // New card
      state = 'learning'
      interval = 0
      stability = this.initialStability(rating)
      difficulty = this.initialDifficulty(rating)
      reps = 1
      lapses = 0
    } else if (card.state === 'learning' || card.state === 'relearning') {
      // Learning or relearning
      if (rating < 3) {
        // Failed - stay in learning
        interval = 0
        lapses += 1
      } else {
        // Passed - move to review
        state = 'review'
        interval = this.calculateInterval(stability)
      }
      stability = this.nextStability(stability, difficulty, rating)
      difficulty = this.nextDifficulty(difficulty, rating)
      reps += 1
    } else if (card.state === 'review') {
      // Review
      if (rating < 3) {
        // Failed - move to relearning
        state = 'relearning'
        interval = 0
        lapses += 1
      } else {
        // Passed - calculate next interval
        interval = this.calculateInterval(stability)
      }
      stability = this.nextStability(stability, difficulty, rating)
      difficulty = this.nextDifficulty(difficulty, rating)
      reps += 1
    }

    // Cap interval at maximum
    interval = Math.min(interval, this.maximumInterval)

    // Calculate due date
    const due = now + interval * 24 * 60 * 60 * 1000

    return {
      rating,
      state,
      due,
      interval,
      difficulty,
      stability,
      reps,
      lapses,
    }
  }

  private initialStability(rating: number): number {
    return this.w[0] + this.w[1] * (rating - 3)
  }

  private initialDifficulty(rating: number): number {
    return this.w[2] + this.w[3] * (rating - 3)
  }

  private nextStability(stability: number, difficulty: number, rating: number): number {
    if (rating < 3) {
      return stability * (1 - this.w[0] * (3 - rating))
    }
    return stability * (1 + this.w[0] * (rating - 3))
  }

  private nextDifficulty(difficulty: number, rating: number): number {
    const next = difficulty - this.w[1] * (rating - 3)
    return Math.max(1, Math.min(10, next))
  }

  private calculateInterval(stability: number): number {
    return Math.max(1, Math.round(stability * 9 * (1 / this.requestRetention - 1)))
  }

  isDue(card: Card): boolean {
    return card.due <= Date.now()
  }

  getDueCards(cards: Card[]): Card[] {
    return cards.filter((card) => this.isDue(card))
  }
}
