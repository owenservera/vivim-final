// src/engines/nlcl/text-normalizer.ts
// TextNormalizer — Layer 0 of the SOTA NLU pipeline (Normalization).
// Preprocessing for all downstream matching: lowercasing, filler stripping,
// tokenization, stopword removal, light stemming.
// Pure TypeScript, ZERO external dependencies (research allows wink-nlp OR custom;
// custom keeps the "zero AI / zero dep" NLCL invariant from AGENTS.md).
//
// SOTA reference: wink-nlp (2M tok/s, zero deps) is the production-grade choice;
// this module replicates the subset of that pipeline NLCL needs without a dependency.

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'at', 'by', 'for',
  'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
  'again', 'further', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you',
  'your', 'he', 'she', 'it', 'its', 'they', 'them', 'their', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'of', 'as', 'can',
  'could', 'would', 'should', 'will', 'just', 'so', 'than', 'too', 'very', 's', 't',
  'my', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'how', 'what', 'who',
  'whom', 'which', 'where', 'why', 'please', 'thanks', 'thank', 'hey', 'ok', 'okay',
])

// Prefixes stripped before matching (colloquial lead-ins).
const FILLER_PREFIXES = [
  'please',
  'can you',
  'could you',
  'would you',
  'will you',
  'i want to',
  "i'd like to",
  'i would like to',
  "let's",
  'lets',
  'hey',
  'ok',
  'okay',
  'can we',
  'could we',
]

export class TextNormalizer {
  /**
   * Full normalization for string-similarity matching (fuzzy / Jaro-Winkler).
   * Lowercases, strips leading filler, collapses whitespace.
   *
   * Contraction expansion is intentionally NOT applied: the deterministic parser
   * must normalize identically to the pre-SOTA baseline so existing patterns that
   * embed apostrophes (e.g. "what's my health") keep matching. Fuzzy/semantic
   * layers normalize both query and candidate phrases with this same function,
   * so cross-layer consistency is preserved without it.
   */
  normalize(input: string): string {
    if (!input) return ''
    let text = input.toLowerCase().trim()

    let changed = true
    while (changed) {
      changed = false
      for (const prefix of FILLER_PREFIXES) {
        const re = new RegExp(`^${prefix}\\s+`)
        if (re.test(text)) {
          text = text.replace(re, '')
          changed = true
        }
      }
    }

    return text.replace(/\s+/g, ' ').trim()
  }

  /**
   * Tokenize for TF-IDF / semantic matching: normalize + split + stem + drop stopwords.
   */
  tokenize(input: string): string[] {
    const normalized = this.normalize(input)
    if (!normalized) return []
    return normalized
      .split(/\s+/)
      .map((tok) => this.stem(tok))
      .filter((tok) => tok.length > 1 && !STOPWORDS.has(tok))
  }

  /**
   * Light English stemmer (Porter-lite). Conservative: only strips common suffixes
   * that don't change word meaning for command matching.
   */
  stem(token: string): string {
    if (token.length <= 3) return token
    const suffixes: Array<[string, string]> = [
      ['ing', ''],
      ['ies', 'y'],
      ['ied', 'y'],
      ['edly', ''],
      ['edness', ''],
      ['edness', ''],
      ['ness', ''],
      ['ment', ''],
      ['ments', ''],
      ['ation', ''],
      ['izations', 'ize'],
      ['ization', 'ize'],
      ['edly', ''],
      ['ed', ''],
      ['es', ''],
      ['ly', ''],
      ['ally', ''],
      ['ous', ''],
      ['ful', ''],
      ['ious', ''],
      ['er', ''],
      ['est', ''],
      ['s', ''],
    ]
    for (const [suffix, replacement] of suffixes) {
      if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
        return token.slice(0, token.length - suffix.length) + replacement
      }
    }
    return token
  }

  removeStopwords(tokens: string[]): string[] {
    return tokens.filter((t) => !STOPWORDS.has(t))
  }
}

export const defaultNormalizer = new TextNormalizer()

export function normalizeText(input: string): string {
  return defaultNormalizer.normalize(input)
}

export function tokenizeText(input: string): string[] {
  return defaultNormalizer.tokenize(input)
}
