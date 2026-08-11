// shared/parser/paths.ts — Safe Path Traversal Library
// Harvested from edge-pwa/shared/parser/paths.ts

import { type ArrayPath, type PathSegment } from './types.js'

/**
 * Tokenize a path string into a list of keys and array indices.
 * Handles mixed dot and bracket notation: e.g. "mapping.messages[0]['text']"
 */
export function parsePath(pathStr: string): ArrayPath {
  if (!pathStr || typeof pathStr !== 'string') return []

  const normalized = pathStr
    .replace(/\[['"]?([^'\"]+?)['\"]?\]/g, '.$1')
    .replace(/^\./, '')

  return normalized
    .split('.')
    .filter(Boolean)
    .map(segment => {
      if (/^\d+$/.test(segment)) {
        return parseInt(segment, 10)
      }
      return segment
    })
}

/**
 * Recursively navigate an object or array safely using a tokenized path.
 * Supports '*' wildcards to map over all array items or object values.
 */
function traverse(current: any, segments: ArrayPath): any {
  if (current === undefined || current === null) {
    return undefined
  }

  if (segments.length === 0) {
    return current
  }

  const [first, ...rest] = segments

  if (first === '*') {
    if (Array.isArray(current)) {
      const mapped = current
        .map(item => traverse(item, rest))
        .filter(val => val !== undefined && val !== null)
      return mapped.length > 0 ? mapped : undefined
    }

    if (typeof current === 'object') {
      const mapped = Object.values(current)
        .map(item => traverse(item, rest))
        .filter(val => val !== undefined && val !== null)
      return mapped.length > 0 ? mapped : undefined
    }

    return undefined
  }

  try {
    const next = current[first]
    return traverse(next, rest)
  } catch {
    return undefined
  }
}

/**
 * Safe path-based data extractor. Returns undefined if path does not exist.
 * Examples:
 *   safeGet(data, "0.1.0") -> data[0][1][0]
 *   safeGet(data, "mapping.*.message.content") -> maps all message contents
 */
export function safeGet(obj: any, path: string | ArrayPath): any {
  if (obj === undefined || obj === null) return undefined

  const segments = typeof path === 'string' ? parsePath(path) : path
  return traverse(obj, segments)
}
