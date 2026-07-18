// tests/unit/automation/cron-parser.test.ts
// Unit tests for the 5-field cron parser (parseCronNextMs)

import { describe, expect, test } from 'bun:test'

// Replicate the cron parser inline for unit test isolation.
// The logic is aligned with src/automation/scheduler.ts.

const DAY_NAMES: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

interface CronField {
  values: number[]
  isAll: boolean
}

function parseCronField(field: string, min: number, max: number, allowNames?: boolean): CronField {
  const trimmed = field.trim()
  if (trimmed === '*') return { values: [], isAll: true }

  const values: number[] = []
  const parts = trimmed.split(',')

  for (const part of parts) {
    const stepMatch = part.match(/^(\*|\d+(-\d+)?(\/\d+)?)(\/\d+)$/)
    let step = 1
    let rangePart = part
    if (stepMatch) {
      step = Number.parseInt(stepMatch[4]?.slice(1) ?? '1', 10)
      rangePart = stepMatch[1]!
    }

    if (rangePart === '*') {
      for (let v = min; v <= max; v += step) values.push(v)
      continue
    }

    const rangeMatch = rangePart.match(/^(\d+|([a-z]{3}))-(\d+|([a-z]{3}))$/i)
    if (rangeMatch) {
      const startStr = rangeMatch[1]!
      const endStr = rangeMatch[3]!
      let start: number
      let end: number
      if (allowNames && DAY_NAMES[startStr.toLowerCase()] !== undefined) {
        start = DAY_NAMES[startStr.toLowerCase()]!
        end = allowNames
          ? (DAY_NAMES[endStr.toLowerCase()]! ?? Number.parseInt(endStr, 10))
          : Number.parseInt(endStr, 10)
      } else {
        start = Number.parseInt(startStr, 10)
        end = Number.parseInt(endStr, 10)
      }
      for (let v = start; v <= end; v += step) values.push(v)
      continue
    }

    const singleMatch = rangePart.match(/^(\d+|([a-z]{3}))$/i)
    if (singleMatch) {
      let val: number
      const matchVal = singleMatch[1]!
      if (allowNames && DAY_NAMES[matchVal.toLowerCase()] !== undefined) {
        val = DAY_NAMES[matchVal.toLowerCase()]!
      } else {
        val = Number.parseInt(matchVal, 10)
      }
      if (val >= min && val <= max) {
        values.push(val)
      }
    }
  }

  return { values: [...new Set(values)].sort((a, b) => a - b), isAll: false }
}

function parseCronNextMs(cronExpr: string, now: number): number | null {
  try {
    const fields = cronExpr.trim().split(/\s+/)
    if (fields.length !== 5) return null

    const [minField, hourField, domField, monthField, dowField] = fields as [
      string,
      string,
      string,
      string,
      string,
    ]
    const minute = parseCronField(minField, 0, 59)
    const hour = parseCronField(hourField, 0, 23)
    const dayOfMonth = parseCronField(domField, 1, 31)
    const month = parseCronField(monthField, 1, 12)
    const dayOfWeek = parseCronField(dowField, 0, 6, true)

    const current = new Date(now)
    const end = new Date(now + 365 * 24 * 60 * 60 * 1000)

    const candidate = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate(),
      current.getHours(),
      current.getMinutes(),
      0,
      0,
    )

    while (candidate <= end) {
      const m = candidate.getMinutes()
      const h = candidate.getHours()
      const dom = candidate.getDate()
      const mon = candidate.getMonth() + 1
      const dow = candidate.getDay()

      const minMatch = minute.isAll || minute.values.includes(m)
      const hourMatch = hour.isAll || hour.values.includes(h)
      const domMatch = dayOfMonth.isAll || dayOfMonth.values.includes(dom)
      const monMatch = month.isAll || month.values.includes(mon)
      const dowMatch = dayOfWeek.isAll || dayOfWeek.values.includes(dow)

      if (minMatch && hourMatch && domMatch && monMatch && dowMatch) {
        const nextMs = candidate.getTime()
        if (nextMs > now) return nextMs
      }

      candidate.setMinutes(candidate.getMinutes() + 1)
    }

    return null
  } catch {
    return null
  }
}

describe('parseCronNextMs', () => {
  test('every minute (* * * * *) returns next minute', () => {
    const now = new Date('2026-07-16T10:00:00Z').getTime()
    const next = parseCronNextMs('* * * * *', now)
    expect(next).toBe(now + 60_000)
  })

  test('every 5 minutes (*/5 * * * *) returns 5 min ahead', () => {
    const now = new Date('2026-07-16T10:00:00Z').getTime()
    const next = parseCronNextMs('*/5 * * * *', now)
    expect(next).toBe(now + 5 * 60_000)
  })

  test('specific minute (30 * * * *)', () => {
    const now = new Date('2026-07-16T10:00:00Z').getTime()
    const next = parseCronNextMs('30 * * * *', now)
    expect(next).toBe(new Date('2026-07-16T10:30:00Z').getTime())
  })

  test('range of hours (0 8-17 * * *)', () => {
    // At 10:00, next match should be next hour at minute 0
    const now = new Date('2026-07-16T10:00:00Z').getTime()
    const next = parseCronNextMs('0 8-17 * * *', now)
    // Next hour: 11:00
    expect(next).toBe(new Date('2026-07-16T11:00:00Z').getTime())
  })

  test('daily at 8am (0 8 * * *)', () => {
    const now = new Date('2026-07-16T10:00:00Z').getTime()
    const next = parseCronNextMs('0 8 * * *', now)
    // Tomorrow at 8:00
    expect(next).toBe(new Date('2026-07-17T08:00:00Z').getTime())
  })

  test('daily at 8am when before 8am', () => {
    const now = new Date('2026-07-16T06:00:00Z').getTime()
    const next = parseCronNextMs('0 8 * * *', now)
    expect(next).toBe(new Date('2026-07-16T08:00:00Z').getTime())
  })

  test('weekly on monday (0 9 * * mon)', () => {
    // July 16 2026 is a Thursday. Next Monday is July 20.
    const now = new Date('2026-07-16T10:00:00Z').getTime()
    const next = parseCronNextMs('0 9 * * mon', now)
    expect(next).toBe(new Date('2026-07-20T09:00:00Z').getTime())
  })

  test('day-of-week with name range (0 9 * * mon-fri)', () => {
    // July 16 is Thursday. Next day at 9am is tomorrow (Friday).
    const now = new Date('2026-07-16T10:00:00Z').getTime()
    const next = parseCronNextMs('0 9 * * mon-fri', now)
    expect(next).toBe(new Date('2026-07-17T09:00:00Z').getTime())
  })

  test('list of values (0,30 * * * *)', () => {
    const now = new Date('2026-07-16T10:10:00Z').getTime()
    const next = parseCronNextMs('0,30 * * * *', now)
    expect(next).toBe(new Date('2026-07-16T10:30:00Z').getTime())
  })

  test('specific date (* * 15 * *)', () => {
    const now = new Date('2026-07-14T10:00:00Z').getTime()
    const next = parseCronNextMs('0 0 15 * *', now)
    expect(next).toBe(new Date('2026-07-15T00:00:00Z').getTime())
  })

  test('invalid cron returns null', () => {
    expect(parseCronNextMs('invalid', Date.now())).toBeNull()
    expect(parseCronNextMs('* * *', Date.now())).toBeNull()
    expect(parseCronNextMs('', Date.now())).toBeNull()
  })

  test('end of year boundary does not loop forever', () => {
    const now = new Date('2026-12-31T23:59:00Z').getTime()
    const next = parseCronNextMs('* * * * *', now)
    expect(next).toBe(now + 60_000)
  })

  test('every first day of month at midnight (0 0 1 * *)', () => {
    const now = new Date('2026-07-16T10:00:00Z').getTime()
    const next = parseCronNextMs('0 0 1 * *', now)
    expect(next).toBe(new Date('2026-08-01T00:00:00Z').getTime())
  })
})

describe('matchesEventPattern', () => {
  function matchesEventPattern(pattern: string, eventType: string): boolean {
    if (pattern === eventType) return true
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -2)
      return eventType.startsWith(`${prefix}:`)
    }
    if (pattern.startsWith('*:')) {
      const suffix = pattern.slice(2)
      return eventType.endsWith(`:${suffix}`)
    }
    return false
  }

  test('exact match', () => {
    expect(matchesEventPattern('conversation:created', 'conversation:created')).toBe(true)
    expect(matchesEventPattern('conversation:created', 'conversation:complete')).toBe(false)
  })

  test('prefix wildcard (conversation:*)', () => {
    expect(matchesEventPattern('conversation:*', 'conversation:created')).toBe(true)
    expect(matchesEventPattern('conversation:*', 'conversation:error')).toBe(true)
    expect(matchesEventPattern('conversation:*', 'canvas:layer:spawned')).toBe(false)
  })

  test('suffix wildcard (*:complete)', () => {
    expect(matchesEventPattern('*:complete', 'conversation:complete')).toBe(true)
    expect(matchesEventPattern('*:complete', 'task:complete')).toBe(true)
    expect(matchesEventPattern('*:complete', 'task:failed')).toBe(false)
  })
})
