// devops/research-bridge.ts
// Bridge between DevOps research briefs and SpecKit research.md files.
// Enables bidirectional format conversion and topic-based brief discovery.
//
// DevOps briefs live in: docs/research/briefs/*-brief.md
// SpecKit research lives in: specs/NNN-name/research.md

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ── Types ────────────────────────────────────────────────────

export interface Source {
  title: string
  url: string
  claim: string
  confidence: string
}

export interface Brief {
  topic: string
  confidence: 'High' | 'Medium' | 'Low'
  sources: Source[]
  keyDecisions: string[]
  evidenceSummary: string
  date: string
  rawContent: string
}

// ── Paths ────────────────────────────────────────────────────

function getBriefsDir(): string {
  return join(process.cwd(), 'docs', 'research', 'briefs')
}

function getSpecsDir(): string {
  return join(process.cwd(), 'specs')
}

// ── Topic matching ───────────────────────────────────────────

function normalizeTopic(topic: string): string[] {
  return topic
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
}

function matchScore(filename: string, topicWords: string[]): number {
  const normalizedFilename = filename
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/-brief$/, '')
    .split(/[-_\s]/)

  let matches = 0
  for (const word of topicWords) {
    if (normalizedFilename.some((fw) => fw.includes(word) || word.includes(fw))) {
      matches++
    }
  }

  return topicWords.length > 0 ? matches / topicWords.length : 0
}

// ── Brief parsing ────────────────────────────────────────────

function parseBrief(content: string, filename: string): Brief {
  const lines = content.split('\n')
  let topic = filename.replace(/-brief\.md$/, '').replace(/-/g, ' ')
  let confidence: Brief['confidence'] = 'Medium'
  const sources: Source[] = []
  const keyDecisions: string[] = []
  let evidenceSummary = ''
  let currentSection = ''

  for (const line of lines) {
    // Extract topic from title
    if (line.startsWith('# ')) {
      topic = line.slice(2).trim()
      continue
    }

    // Extract confidence
    const confMatch = line.match(/confidence:\s*(high|medium|low)/i)
    if (confMatch) {
      confidence = confMatch[1]!.charAt(0).toUpperCase() + confMatch[1]!.slice(1).toLowerCase() as Brief['confidence']
      continue
    }

    // Track sections
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim().toLowerCase()
      continue
    }

    // Extract key decisions
    if (currentSection.includes('key decision') && line.startsWith('- ')) {
      keyDecisions.push(line.slice(2).trim())
      continue
    }

    // Extract evidence summary
    if (currentSection.includes('evidence') && line.trim()) {
      evidenceSummary += line.trim() + ' '
      continue
    }

    // Extract sources
    if (currentSection.includes('source') && line.startsWith('- ')) {
      const sourceMatch = line.match(/- \[(.+?)\]\((.+?)\):?\s*(.*)$/)
      if (sourceMatch) {
        sources.push({
          title: sourceMatch[1]!,
          url: sourceMatch[2]!,
          claim: sourceMatch[3] ?? '',
          confidence: confidence,
        })
      }
    }
  }

  return {
    topic,
    confidence,
    sources,
    keyDecisions,
    evidenceSummary: evidenceSummary.trim(),
    date: new Date().toISOString().slice(0, 10),
    rawContent: content,
  }
}

// ── Format conversion ────────────────────────────────────────

export function convertBriefToSpecKit(brief: Brief): string {
  const lines: string[] = []

  lines.push(`# Research: ${brief.topic}`)
  lines.push('')
  lines.push(`<!-- confidence: ${brief.confidence} -->`)
  lines.push('')

  // Summary (from evidence summary)
  lines.push('## Summary')
  lines.push('')
  lines.push(brief.evidenceSummary || 'No summary available.')
  lines.push('')

  // Decision (from key decisions)
  lines.push('## Decision')
  lines.push('')
  if (brief.keyDecisions.length > 0) {
    brief.keyDecisions.forEach((d, i) => {
      lines.push(`${i + 1}. ${d}`)
    })
  } else {
    lines.push('No decisions recorded.')
  }
  lines.push('')

  // Rationale (from evidence)
  lines.push('## Rationale')
  lines.push('')
  if (brief.sources.length > 0) {
    for (const source of brief.sources) {
      lines.push(`- ${source.claim || source.title} ([${source.title}](${source.url}))`)
    }
  } else {
    lines.push('No evidence available.')
  }
  lines.push('')

  // Sources
  lines.push('## Sources')
  lines.push('')
  if (brief.sources.length > 0) {
    for (const source of brief.sources) {
      lines.push(`- [${source.title}](${source.url})`)
    }
  } else {
    lines.push('No sources available.')
  }
  lines.push('')

  // Alternatives (from open questions if present in raw content)
  const openQuestionsMatch = brief.rawContent.match(/##\s*Open Questions\s*\n([\s\S]*?)(?=\n##|$)/i)
  if (openQuestionsMatch) {
    lines.push('## Alternatives')
    lines.push('')
    lines.push(openQuestionsMatch[1]!.trim())
    lines.push('')
  }

  return lines.join('\n')
}

export function convertSpecKitToBrief(content: string): Brief {
  const lines = content.split('\n')
  let topic = 'Unknown Topic'
  let confidence: Brief['confidence'] = 'Medium'
  const keyDecisions: string[] = []
  let evidenceSummary = ''
  const sources: Source[] = []
  let currentSection = ''

  for (const line of lines) {
    // Extract topic from title
    if (line.startsWith('# ')) {
      topic = line.slice(2).replace(/^Research:\s*/, '').trim()
      continue
    }

    // Extract confidence from comment
    const confMatch = line.match(/<!--\s*confidence:\s*(high|medium|low)\s*-->/i)
    if (confMatch) {
      confidence = confMatch[1]!.charAt(0).toUpperCase() + confMatch[1]!.slice(1).toLowerCase() as Brief['confidence']
      continue
    }

    // Track sections
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim().toLowerCase()
      continue
    }

    // Extract decisions
    if (currentSection.includes('decision') && line.match(/^\d+\.\s/)) {
      keyDecisions.push(line.replace(/^\d+\.\s/, '').trim())
      continue
    }

    // Extract rationale/evidence
    if (currentSection.includes('rationale') && line.startsWith('- ')) {
      evidenceSummary += line.slice(2).trim() + ' '
      continue
    }

    // Extract sources
    if (currentSection.includes('source') && line.startsWith('- ')) {
      const sourceMatch = line.match(/- \[(.+?)\]\((.+?)\)/)
      if (sourceMatch) {
        sources.push({
          title: sourceMatch[1]!,
          url: sourceMatch[2]!,
          claim: '',
          confidence,
        })
      }
    }
  }

  return {
    topic,
    confidence,
    sources,
    keyDecisions,
    evidenceSummary: evidenceSummary.trim(),
    date: new Date().toISOString().slice(0, 10),
    rawContent: content,
  }
}

// ── Core API ─────────────────────────────────────────────────

/**
 * Find a DevOps research brief matching the given topic.
 * Returns the best matching brief or null if none found.
 */
export async function findBriefForTopic(topic: string): Promise<Brief | null> {
  const briefsDir = getBriefsDir()

  if (!existsSync(briefsDir)) {
    return null
  }

  const topicWords = normalizeTopic(topic)
  if (topicWords.length === 0) {
    return null
  }

  const entries = await readdir(briefsDir)
  const briefFiles = entries.filter((e) => e.endsWith('-brief.md'))

  let bestMatch: { file: string; score: number } | null = null

  for (const file of briefFiles) {
    const score = matchScore(file, topicWords)
    if (score > 0.3 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { file, score }
    }
  }

  if (!bestMatch) {
    return null
  }

  const content = await readFile(join(briefsDir, bestMatch.file), 'utf8')
  return parseBrief(content, bestMatch.file)
}

/**
 * Export a DevOps brief to SpecKit research.md format.
 * Returns the converted content as a string.
 */
export function exportBriefForSpecKit(brief: Brief, _featureDir: string): string {
  return convertBriefToSpecKit(brief)
}

/**
 * Import a SpecKit research.md and convert to DevOps brief format.
 * Returns the converted brief or null if no research.md exists.
 */
export async function importSpecKitResearch(featureDir: string): Promise<Brief | null> {
  const researchPath = join(getSpecsDir(), featureDir, 'research.md')

  if (!existsSync(researchPath)) {
    return null
  }

  try {
    const content = await readFile(researchPath, 'utf8')
    return convertSpecKitToBrief(content)
  } catch {
    return null
  }
}

/**
 * Find all SpecKit research.md files and check their freshness.
 * Returns files older than the specified age in days.
 */
export async function findStaleSpecKitResearch(
  maxAgeDays: number = 180,
): Promise<Array<{ path: string; lastModified: string; ageDays: number }>> {
  const specsDir = getSpecsDir()

  if (!existsSync(specsDir)) {
    return []
  }

  const stale: Array<{ path: string; lastModified: string; ageDays: number }> = []
  const entries = await readdir(specsDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const researchPath = join(specsDir, entry.name, 'research.md')
    if (!existsSync(researchPath)) continue

    try {
      const content = await readFile(researchPath, 'utf8')
      // Try to extract date from content
      const dateMatch = content.match(/(?:date|generated):\s*(\d{4}-\d{2}-\d{2})/i)
      if (dateMatch) {
        const fileDate = new Date(dateMatch[1]!)
        const ageDays = Math.floor((Date.now() - fileDate.getTime()) / (1000 * 60 * 60 * 24))
        if (ageDays > maxAgeDays) {
          stale.push({
            path: researchPath,
            lastModified: dateMatch[1]!,
            ageDays,
          })
        }
      }
    } catch {
      // Skip unparseable files
    }
  }

  return stale
}
