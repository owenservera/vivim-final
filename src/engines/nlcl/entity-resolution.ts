// src/engines/nlcl/entity-resolution.ts
// EntityResolution — value normalization for extracted slots (Gap 7.4 in research).
// Normalizes relative dates, times, number-words, and booleans into canonical forms
// so the deterministic system "feels intelligent". Pure TypeScript, zero deps.
//
// SOTA reference: Snips NLU built-in entity resolution (datetime→ISO, numbers→normalized).
// Wired into NLCommandParser after regex extraction so every pattern benefits.

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
}

const _DAY_MS = 86_400_000

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Normalize relative date words in a string → ISO date (yyyy-mm-dd). */
export function normalizeRelativeDate(text: string, now: Date = new Date()): string {
  const lowered = text.toLowerCase().trim()
  if (/^today$/.test(lowered)) return isoDate(now)
  if (/^tomorrow$/.test(lowered)) return isoDate(addDays(now, 1))
  if (/^yesterday$/.test(lowered)) return isoDate(addDays(now, -1))

  const inDays = lowered.match(/^in (\d+) days?$/)
  if (inDays?.[1]) return isoDate(addDays(now, Number(inDays[1])))

  const nextWeekday = lowered.match(
    /^next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/,
  )
  if (nextWeekday?.[1]) {
    const target = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ].indexOf(nextWeekday[1] ?? '')
    const current = now.getDay()
    let delta = target - current
    if (delta <= 0) delta += 7
    return isoDate(addDays(now, delta))
  }
  return text
}

/** Normalize common time expressions → HH:MM (24h). */
export function normalizeRelativeTime(text: string): string {
  const lowered = text.toLowerCase().trim()
  if (lowered === 'noon') return '12:00'
  if (lowered === 'midnight') return '00:00'

  const hm = lowered.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/)
  if (hm) {
    let hour = Number(hm[1])
    const minute = hm[2] ?? '00'
    const meridiem = hm[3]
    if (meridiem === 'pm' && hour < 12) hour += 12
    if (meridiem === 'am' && hour === 12) hour = 0
    return `${String(hour).padStart(2, '0')}:${minute}`
  }
  return text
}

/** Normalize spelled-out numbers and magnitude suffixes (1k → 1000). */
export function normalizeNumberWords(text: string): string {
  let result = text
  // Magnitude suffixes: 1k, 2m, 3b
  result = result.replace(/\b(\d+(?:\.\d+)?)\s*(k|m|b)\b/gi, (_m, num: string, suffix: string) => {
    const base = Number(num)
    const mult = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[suffix.toLowerCase()] ?? 1
    return String(base * mult)
  })
  // Spelled-out numbers
  result = result.replace(/\b[a-z-]+\b/gi, (word) => {
    const w = word.toLowerCase()
    if (w in NUMBER_WORDS) return String(NUMBER_WORDS[w])
    return word
  })
  return result
}

/** Normalize yes/no words → boolean. Returns original string if not a boolean. */
export function normalizeBoolean(text: string): boolean | string {
  const lowered = text.toLowerCase().trim()
  if (['yes', 'y', 'true', 'on', 'enable', 'enabled'].includes(lowered)) return true
  if (['no', 'n', 'false', 'off', 'disable', 'disabled'].includes(lowered)) return false
  return text
}

/**
 * Recursively resolve common entity values in an extracted input record.
 * Conservative: only transforms strings that exactly match a known pattern,
 * so names/paths/queries pass through untouched.
 */
export function resolveEntityValues(
  input: Record<string, unknown>,
  now: Date = new Date(),
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      out[key] = resolveSingleValue(key, value, now)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = resolveEntityValues(value as Record<string, unknown>, now)
    } else {
      out[key] = value
    }
  }
  return out
}

function resolveSingleValue(key: string, value: string, now: Date): string {
  const loweredKey = key.toLowerCase()
  if (loweredKey.includes('date') || loweredKey === 'when') {
    return normalizeRelativeDate(value, now)
  }
  if (loweredKey.includes('time') || loweredKey === 'at') {
    return normalizeRelativeTime(value)
  }
  if (loweredKey.includes('count') || loweredKey.includes('number') || loweredKey === 'num') {
    return normalizeNumberWords(value)
  }
  if (loweredKey.includes('enabled') || loweredKey === 'confirm' || loweredKey === 'force') {
    const b = normalizeBoolean(value)
    return typeof b === 'boolean' ? String(b) : value
  }
  return value
}

// ── Unit 1.4 — Intent Registry (programmatic registration) ─────────────────

type IntentEntry = {
  slug: string
  patterns: string[]
  confidence: number
}
const intentRegistry = new Map<string, IntentEntry>()

/**
 * Register a new intent programmatically (no code change required).
 * The entry is resolved during NL interpretation.
 */
export function registerIntent(
  slug: string,
  patterns: string[],
  opts?: { confidence?: number },
): void {
  intentRegistry.set(slug, { slug, patterns, confidence: opts?.confidence ?? 1.0 })
}

/** Get all registered intents. */
export function listIntents(): IntentEntry[] {
  return [...intentRegistry.values()]
}

/** Resolve an intent slug from the registry by matching against patterns. */
export function resolveIntentFromRegistry(
  text: string,
): { slug: string; confidence: number } | null {
  const lowered = text.toLowerCase()
  for (const entry of intentRegistry.values()) {
    for (const pattern of entry.patterns) {
      if (lowered.includes(pattern.toLowerCase())) {
        return { slug: entry.slug, confidence: entry.confidence }
      }
    }
  }
  return null
}
