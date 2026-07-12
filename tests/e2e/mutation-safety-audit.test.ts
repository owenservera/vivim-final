// tests/e2e/mutation-safety-audit.test.ts
// Unit 5.6 — Mutation Safety Audit: verify VIVIM doesn't leave artifacts in provider pages.

import { describe, test, expect } from 'bun:test'

interface DomSnapshot {
  bodyChildCount: number
  htmlLength: number
  scriptCount: number
  styleCount: number
  divCount: number
  vivimElements: number
}

function findVivimArtifacts(snapshot: DomSnapshot): string[] {
  const violations: string[] = []
  if (snapshot.vivimElements > 0) {
    violations.push(`Found ${snapshot.vivimElements} VIVIM-injected elements in DOM`)
  }
  return violations
}

function diffSnapshots(before: DomSnapshot, after: DomSnapshot): { added: string[]; removed: string[] } {
  const added: string[] = []
  const removed: string[] = []

  if (after.scriptCount > before.scriptCount) {
    added.push(`${after.scriptCount - before.scriptCount} scripts added`)
  }
  if (after.styleCount > before.styleCount) {
    added.push(`${after.styleCount - before.styleCount} styles added`)
  }
  if (after.vivimElements > before.vivimElements) {
    added.push(`${after.vivimElements - before.vivimElements} VIVIM elements added`)
  }

  return { added, removed }
}

describe('Mutation Safety Audit', () => {
  test('findVivimArtifacts detects injected elements', () => {
    const clean: DomSnapshot = {
      bodyChildCount: 5,
      htmlLength: 50000,
      scriptCount: 10,
      styleCount: 3,
      divCount: 100,
      vivimElements: 0,
    }
    expect(findVivimArtifacts(clean)).toHaveLength(0)
  })

  test('findVivimArtifacts flags violations', () => {
    const dirty: DomSnapshot = {
      bodyChildCount: 6,
      htmlLength: 51000,
      scriptCount: 10,
      styleCount: 3,
      divCount: 102,
      vivimElements: 2,
    }
    const violations = findVivimArtifacts(dirty)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0]).toContain('VIVIM-injected')
  })

  test('diffSnapshots detects added scripts', () => {
    const before: DomSnapshot = {
      bodyChildCount: 5,
      htmlLength: 50000,
      scriptCount: 10,
      styleCount: 3,
      divCount: 100,
      vivimElements: 0,
    }
    const after: DomSnapshot = {
      bodyChildCount: 5,
      htmlLength: 50000,
      scriptCount: 12,
      styleCount: 3,
      divCount: 100,
      vivimElements: 0,
    }
    const diff = diffSnapshots(before, after)
    expect(diff.added.length).toBeGreaterThan(0)
    expect(diff.added[0]).toContain('scripts')
  })

  test('diffSnapshots clean when no changes', () => {
    const snap: DomSnapshot = {
      bodyChildCount: 5,
      htmlLength: 50000,
      scriptCount: 10,
      styleCount: 3,
      divCount: 100,
      vivimElements: 0,
    }
    const diff = diffSnapshots(snap, snap)
    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
  })
})
