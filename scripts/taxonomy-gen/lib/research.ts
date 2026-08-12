// scripts/taxonomy-gen/lib/research.ts
// Web-search research helper for doubts + existing-library discovery.
//
// This module is a thin wrapper that the AGENT uses during sessions. In agent
// mode, the orchestrator prints a research request; the opencode agent performs
// the web search (web-search-prime / firecrawl / exa) and returns findings.
// In auto mode, this would call an LLM-with-search endpoint.
//
// We keep it as a prompt generator + result formatter so the agent knows exactly
// what to search and how to record findings.

export interface ResearchRequest {
  query: string
  purpose: 'existing-library' | 'doubt' | 'validation'
  platform?: string
}

export function buildResearchPrompt(req: ResearchRequest): string {
  const lines: string[] = []
  lines.push(`# Research Needed${req.platform ? ` — ${req.platform}` : ''}`)
  lines.push('')
  lines.push(`**Purpose:** ${req.purpose}`)
  lines.push(`**Query:** ${req.query}`)
  lines.push('')
  switch (req.purpose) {
    case 'existing-library':
      lines.push('Search GitHub/npm for downloadable taxonomy libraries we can reuse:')
      lines.push('- "platform capability taxonomy github"')
      lines.push('- "social media API capabilities list"')
      lines.push('- "CDP selector library playwright"')
      lines.push('- "messaging platform message types schema"')
      lines.push('If found, record the URL + what can be reused.')
      break
    case 'doubt':
      lines.push('Search for current/accurate information to resolve uncertainty:')
      lines.push(`- "${req.query}"`)
      lines.push('Record the finding + source URL + confidence.')
      break
    case 'validation':
      lines.push('Search to validate generated data:')
      lines.push(`- "${req.query}"`)
      break
  }
  return lines.join('\n')
}

export function recordFinding(
  platform: string,
  finding: string,
  sourceUrl: string,
  confidence: 'high' | 'medium' | 'low'
): void {
  // In agent mode, the agent appends this to output/providers/<slug>/research.md
  // This function just formats for display.
  // [audit] removed: console.log(`[research] ${platform}: ${finding} (${confidence}) <- ${sourceUrl}`)
}

export const EXISTING_LIB_QUERIES = [
  'platform capability taxonomy github',
  'social media API capabilities list',
  'CDP selector library playwright',
  'messaging platform message types schema',
  ' chatbot ui selector dataset',
]
