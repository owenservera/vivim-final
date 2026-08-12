/**
 * POST /api/help/search
 * ---------------------------------------------------------------------------
 * Capability-registry-powered search endpoint for the help system.
 *
 * Proxies to the backend NLCL system for intent resolution via the 5-layer
 * pipeline (deterministic → fuzzy → semantic → LLM).
 *
 * Request body:
 *   - query: string — search query
 *
 * Response:
 *   - results: CapabilitySearchResult[] — matching capabilities with info
 *   - stats: { totalCapabilities, totalPatterns, resolutionLayer }
 */

import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestBody {
  query: string
}

interface CapabilitySearchResult {
  id: string
  type: 'capability' | 'help' | 'guide'
  title: string
  description: string
  category?: string
  slug?: string
  confidence: number
  source?: string
  actions?: Array<{
    label: string
    mode: 'explain' | 'guide' | 'execute'
    command?: string
  }>
}

// ---------------------------------------------------------------------------
// Capability catalog (static fallback when backend is unavailable)
// ---------------------------------------------------------------------------

const CAPABILITY_CATALOG: CapabilitySearchResult[] = [
  {
    id: 'send_message',
    type: 'capability',
    title: 'Send Message',
    description: 'Send a message to any connected AI provider (ChatGPT, Claude, Gemini, etc.)',
    category: 'chat',
    slug: 'send_message',
    confidence: 1.0,
    actions: [
      { label: 'Execute', mode: 'execute', command: 'send_message' },
      { label: 'Learn more', mode: 'explain' },
    ],
  },
  {
    id: 'select_model',
    type: 'capability',
    title: 'Switch Model',
    description: 'Change the active AI model for the current conversation',
    category: 'chat',
    slug: 'select_model',
    confidence: 1.0,
    actions: [
      { label: 'Execute', mode: 'execute', command: 'select_model' },
      { label: 'Learn more', mode: 'explain' },
    ],
  },
  {
    id: 'list_conversations',
    type: 'capability',
    title: 'View Conversations',
    description: 'Browse your chat history across all providers',
    category: 'explore',
    slug: 'list_conversations',
    confidence: 1.0,
    actions: [{ label: 'Execute', mode: 'execute', command: 'list_conversations' }],
  },
  {
    id: 'add_provider',
    type: 'guide',
    title: 'Add Provider',
    description: 'Set up a new AI provider (ChatGPT, Claude, Gemini, DeepSeek, Qwen, Grok)',
    category: 'setup',
    confidence: 1.0,
    actions: [{ label: 'Walk through setup', mode: 'guide' }],
  },
  {
    id: 'help_general',
    type: 'help',
    title: 'General Help',
    description: 'Get help with Vivim features, workflows, and capabilities',
    category: 'help',
    confidence: 1.0,
    actions: [{ label: 'Ask a question', mode: 'explain' }],
  },
]

// ---------------------------------------------------------------------------
// Simple text matching (fallback when backend is unavailable)
// ---------------------------------------------------------------------------

function matchCapabilities(query: string): CapabilitySearchResult[] {
  const queryLower = query.toLowerCase()
  const results: CapabilitySearchResult[] = []

  for (const cap of CAPABILITY_CATALOG) {
    const titleMatch = cap.title.toLowerCase().includes(queryLower)
    const descMatch = cap.description.toLowerCase().includes(queryLower)
    const slugMatch = cap.slug?.toLowerCase().includes(queryLower)

    if (titleMatch || descMatch || slugMatch) {
      // Boost score for exact matches
      let confidence = 0.7
      if (titleMatch) confidence = 0.9
      if (slugMatch) confidence = 1.0

      results.push({
        ...cap,
        confidence,
      })
    }
  }

  // Sort by confidence
  results.sort((a, b) => b.confidence - a.confidence)
  return results.slice(0, 5)
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json()
    const { query } = body

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Try to proxy to backend NLCL system first
    try {
      const backendPort = process.env.CAP_STORE_PORT || '9420'
      const response = await fetch(`http://localhost:${backendPort}/api/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: query,
          ctx: { surface: 'help-search' },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.ok && data.capabilityId) {
          // Backend resolved to a capability
          const results: CapabilitySearchResult[] = [
            {
              id: data.capabilityId,
              type: 'capability',
              title: data.capabilityId
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (l: string) => l.toUpperCase()),
              description: data.text || `Execute ${data.capabilityId}`,
              category: data.capabilityId.split('_')[0],
              slug: data.capabilityId,
              confidence: 0.9,
              actions: [
                { label: 'Execute', mode: 'execute', command: data.capabilityId },
                { label: 'Learn more', mode: 'explain' },
              ],
            },
          ]

          return NextResponse.json({
            results,
            stats: {
              totalCapabilities: CAPABILITY_CATALOG.length,
              totalPatterns: CAPABILITY_CATALOG.length,
              resolutionLayer: 'backend-nlcl',
            },
          })
        }
      }
    } catch {
  // [audit] log the error with context here
      // Backend unavailable, fall back to local matching
    }

    // Fallback: local capability matching
    const results = matchCapabilities(query)

    return NextResponse.json({
      results,
      stats: {
        totalCapabilities: CAPABILITY_CATALOG.length,
        totalPatterns: CAPABILITY_CATALOG.length,
        resolutionLayer: 'local-fallback',
      },
    })
  } catch (error) {
    // [audit] removed: console.error('[Help Search] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
