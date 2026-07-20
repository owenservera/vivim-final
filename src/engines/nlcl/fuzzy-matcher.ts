// src/engines/nlcl/fuzzy-matcher.ts
// FuzzyMatcher — Layer 2 of the SOTA NLU pipeline (Fuzzy Match).
// Character/word-level similarity for typo tolerance. Pure TypeScript, zero deps.
//
// SOTA reference: Jaro-Winkler is the industry standard for entity/typo matching
// (Elasticsearch entity-resolution pattern: TF-IDF → Jaro-Winkler → embeddings).
// Vex Intent Classifier (TS hybrid) uses Levenshtein + cosine — this module provides
// Levenshtein + Jaro-Winkler + Dice-bigram (token-set) similarity.

/** Levenshtein edit distance (iterative, O(n*m) with O(min) space). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1).fill(0)

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const del = prev[j] ?? i + j
      const ins = curr[j - 1] ?? i + j
      const sub = prev[j - 1] ?? i + j - 1
      curr[j] = Math.min(del + 1, ins + 1, sub + cost)
    }
    const tmp = prev
    prev = curr
    curr = tmp
  }
  return prev[b.length] ?? a.length
}

/** Normalized Levenshtein similarity in [0, 1]. */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

/** Jaro-Winkler similarity in [0, 1] (1 = identical). */
export function jaroWinkler(a: string, b: string, prefixScale = 0.1): number {
  const s1 = a.toLowerCase()
  const s2 = b.toLowerCase()
  if (s1 === s2) return 1
  const len1 = s1.length
  const len2 = s2.length
  if (len1 === 0 || len2 === 0) return 0

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1
  const matchDistanceClamped = matchDistance < 0 ? 0 : matchDistance

  const s1Matches = new Array<boolean>(len1).fill(false)
  const s2Matches = new Array<boolean>(len2).fill(false)

  let matches = 0
  let transpositions = 0

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistanceClamped)
    const end = Math.min(i + matchDistanceClamped + 1, len2)
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue
      if (s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0

  let k = 0
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue
    while (k < s2Matches.length && !s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3

  let prefix = 0
  const maxPrefix = Math.min(4, Math.min(len1, len2))
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) prefix++
    else break
  }

  return jaro + prefix * prefixScale * (1 - jaro)
}

function bigrams(s: string): Map<string, number> {
  const grams = new Map<string, number>()
  const str = s.toLowerCase().replace(/\s+/g, ' ').trim()
  if (str.length === 0) return grams
  if (str.length === 1) {
    grams.set(str, 1)
    return grams
  }
  for (let i = 0; i < str.length - 1; i++) {
    const g = str.slice(i, i + 2)
    grams.set(g, (grams.get(g) ?? 0) + 1)
  }
  return grams
}

/** Dice coefficient over character bigrams — robust typo tolerance at char level. */
export function diceCoefficient(a: string, b: string): number {
  const bg1 = bigrams(a)
  const bg2 = bigrams(b)
  if (bg1.size === 0 && bg2.size === 0) return a === b ? 1 : 0
  if (bg1.size === 0 || bg2.size === 0) return 0

  let intersection = 0
  for (const [g, count] of bg1) {
    const other = bg2.get(g)
    if (other) intersection += Math.min(count, other)
  }
  const total =
    [...bg1.values()].reduce((a, c) => a + c, 0) + [...bg2.values()].reduce((a, c) => a + c, 0)
  if (total === 0) return 0
  return (2 * intersection) / total
}

/**
 * Best-effort string similarity combining Jaro-Winkler (surface form) and
 * Dice bigrams (typo tolerance). Returns value in [0, 1].
 */
export function fuzzySimilarity(a: string, b: string): number {
  const jw = jaroWinkler(a, b)
  const dice = diceCoefficient(a, b)
  // Jaro-Winkler is more precise for whole-phrase match; Dice rescues transpositions/typos.
  return Math.max(jw, dice * 0.95)
}
