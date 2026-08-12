// src/engines/code-audit/patch.ts
// Patch synthesis phase. Uses each rule's declarative RulePatchRecipe to
// generate a concrete diff for the finding's line, then — when verification
// is enabled — re-runs the rule against a patched copy of the file and keeps
// only patches that clear the finding.

import { readFileSync } from 'node:fs'
import { getRule } from './rules.js'
import { tokenize } from './tokenizer.js'
import type { Finding, FindingSeed, RulePatchRecipe, TokenizedFile } from './types.js'

export interface SuggestedPatch {
  diff: string
  explanation: string
  patchedSnippet: string
  kind: RulePatchRecipe['kind']
}

/** Produce a unified-diff-style string for a single line replacement. */
function makeDiff(filePath: string, lineNumber: number, oldLine: string, newLine: string): string {
  const label = filePath
  return [
    `--- a/${label}`,
    `+++ b/${label}`,
    `@@ -${lineNumber} +${lineNumber} @@`,
    `-${oldLine}`,
    `+${newLine}`,
  ].join('\n')
}

/** Render a patch for a finding using its rule's recipe. */
export function renderPatch(
  f: Finding,
  recipe: RulePatchRecipe,
  lineText: string,
): SuggestedPatch | null {
  const lineNo = f.location.lineNumber ?? 1
  const indent = /^\s*/.exec(lineText)?.[0] ?? ''
  const content = lineText.trim()

  switch (recipe.kind) {
    case 'remove-line':
      return {
        diff: makeDiff(
          f.location.filePath,
          lineNo,
          lineText,
          `${indent}// [audit] removed: ${content}`,
        ),
        explanation: recipe.summary,
        patchedSnippet: `${indent}// [audit] removed: ${content}`,
        kind: recipe.kind,
      }
    case 'insert-log':
      return {
        diff: makeDiff(
          f.location.filePath,
          lineNo,
          lineText,
          `${indent}${content}\n${indent}  // [audit] log the error with context here (e.g. logger.error(err))`,
        ),
        explanation: recipe.summary,
        patchedSnippet: `${indent}${content}\n${indent}  // [audit] log the error with context here`,
        kind: recipe.kind,
      }
    default:
      // 'manual' and anything else: no auto-patch, advisory only.
      return null
  }
}

function reDetectOnPatched(
  ruleId: string,
  filePath: string,
  patchedLines: string[],
): FindingSeed[] {
  const rule = getRule(ruleId)
  if (!rule) return []
  const source = patchedLines.join('\n')
  const tf: TokenizedFile = tokenize(filePath, source)
  if (rule.detectRaw) {
    return rule.detectRaw(filePath, patchedLines)
  }
  return rule.detect(tf)
}

/**
 * Verify a generated patch by re-running the owning rule on a patched copy of
 * the file. Returns true when the finding no longer reproduces at that line.
 */
export function verifyPatch(
  f: Finding,
  patchedSnippet: string,
): { status: 'verified' | 'refuted'; note: string } {
  try {
    const filePath = f.location.filePath
    const source = readFileSync(filePath, 'utf8')
    const lines = source.split('\n')
    const lineNo = f.location.lineNumber ?? 1
    if (lineNo < 1 || lineNo > lines.length) {
      return { status: 'refuted', note: 'Line out of range; cannot verify.' }
    }
    lines[lineNo - 1] = patchedSnippet
    const after = reDetectOnPatched(f.ruleId, filePath, lines)
    const stillPresent = after.some((s) => s.line === lineNo)
    if (!stillPresent) {
      return {
        status: 'verified',
        note: 'Rule no longer fires at the target line on the patched copy.',
      }
    }
    return {
      status: 'refuted',
      note: 'Finding persists after patch application; recipe insufficient.',
    }
  } catch (err) {
    return { status: 'refuted', note: `Patch verification failed: ${(err as Error).message}` }
  }
}

/**
 * Synthesize + optionally verify patches for all findings that carry a
 * renderable recipe. Mutates findings in place.
 */
export async function synthesizePatches(findings: Finding[], verify = false): Promise<Finding[]> {
  for (const f of findings) {
    const rule = getRule(f.ruleId)
    if (!rule?.patch) continue
    const lineText = f.location.snippet ?? ''
    const patch = renderPatch(f, rule.patch, lineText)
    if (!patch) continue
    f.suggestedPatch = patch
    if (verify) {
      f.patchVerification = verifyPatch(f, patch.patchedSnippet)
    } else {
      f.patchVerification = { status: 'unverified', note: 'Patch verification disabled.' }
    }
  }
  return findings
}
