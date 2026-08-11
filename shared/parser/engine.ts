// shared/parser/engine.ts — Core Declarative Parser Execution Engine
// Harvested from edge-pwa/shared/parser/engine.ts

import { type Schema, type SelectorRule } from './types.js'
import { safeGet } from './paths.js'
import * as transforms from './transforms.js'

function getPreprocessor(preprocess: any): (val: any) => any {
  if (typeof preprocess === 'function') return preprocess
  if (preprocess === 'jsonParse') return transforms.jsonParse
  if (preprocess === 'trim') return transforms.trim
  return (val: any) => val
}

function getTransformer(transform: any): (val: any, context?: any) => any {
  if (typeof transform === 'function') return transform
  if (transform === 'trim') return transforms.trim
  if (transform === 'toTimestamp') return transforms.toTimestamp
  if (transform === 'stripHtml') return transforms.stripHtml
  if (transform === 'extractLinks') return (val: any) => transforms.extractLinks(val)
  if (transform === 'extractAttachments') return (val: any, context?: any) => transforms.extractAttachments(val, context)
  return (val: any) => val
}

function isSelectorRule(obj: any): obj is SelectorRule {
  if (!obj || typeof obj !== 'object') return false
  return (
    'path' in obj ||
    'paths' in obj ||
    'preprocess' in obj ||
    'transform' in obj ||
    'defaultValue' in obj ||
    'schema' in obj
  )
}

/**
 * Core Object Schema Parser.
 * Maps any raw source structure into a clean target model based on a declarative schema.
 */
export function parseObject<T>(source: any, schema: Schema<T>, context?: any): T {
  if (source === undefined || source === null) {
    return null as any
  }

  const result: any = {}

  for (const [key, rule] of Object.entries(schema)) {
    // 1. Static primitive value or constant
    if (typeof rule !== 'object' || rule === null) {
      result[key] = rule
      continue
    }

    // 2. Nested implicit sub-schema (no path/paths selectors)
    if (!isSelectorRule(rule)) {
      result[key] = parseObject(source, rule as Schema<any>, context)
      continue
    }

    // 3. Resolve value from path or fallback paths
    let extracted: any = undefined

    if (rule.path !== undefined) {
      extracted = safeGet(source, rule.path)
    }

    if ((extracted === undefined || extracted === null) && rule.paths) {
      for (const fallbackPath of rule.paths) {
        extracted = safeGet(source, fallbackPath)
        if (extracted !== undefined && extracted !== null) {
          break
        }
      }
    }

    // Apply default value if still missing
    if (extracted === undefined || extracted === null) {
      extracted = rule.defaultValue
    }

    // 4. Preprocess
    if (rule.preprocess && extracted !== undefined && extracted !== null) {
      const fn = getPreprocessor(rule.preprocess)
      extracted = fn(extracted)
    }

    // 5. Recursively run nested schema or map arrays
    if (rule.schema && extracted !== undefined && extracted !== null) {
      if (rule.array) {
        if (Array.isArray(extracted)) {
          extracted = extracted
            .map(item => parseObject(item, rule.schema!, source))
            .filter(item => item !== null && item !== undefined)
        } else {
          extracted = []
        }
      } else {
        extracted = parseObject(extracted, rule.schema, source)
      }
    }

    // 6. Post-process pipeline transformations
    if (rule.transform && extracted !== undefined && extracted !== null) {
      const fn = getTransformer(rule.transform)
      extracted = fn(extracted, source)
    }

    result[key] = extracted
  }

  return result as T
}

/**
 * Core Array Schema Parser.
 * Maps a list of raw objects at a specific path using a declarative schema.
 */
export function parseArray<T>(source: any, itemPath: string, schema: Schema<T>, context?: any): T[] {
  const items = safeGet(source, itemPath)
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map(item => parseObject(item, schema, context))
    .filter(item => item !== null && item !== undefined)
}
