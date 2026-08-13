/**
 * POST /api/help/agent
 * ---------------------------------------------------------------------------
 * AI agent endpoint for the help system. Uses the backend NLCL system for
 * intent classification and routes to appropriate mode (explain/guide/execute).
 *
 * Request body:
 *   - query: string — user's question or request
 *   - screenContext?: ScreenContext — current page context
 *   - history?: ChatMessage[] — conversation history
 *   - classifyOnly?: boolean — if true, only return mode classification
 *
 * Response: SSE stream with text, citations, and actions
 */

import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestBody {
  query: string
  screenContext?: Record<string, unknown>
  history?: Array<{ role: string; content: string }>
  classifyOnly?: boolean
}

type AgentMode = 'explain' | 'guide' | 'execute'

// ---------------------------------------------------------------------------
// Backend NLCL intent classification
// ---------------------------------------------------------------------------

/**
 * Classify user intent using the backend NLCL system.
 * Falls back to keyword classification if the backend is unavailable.
 */
async function classifyIntentViaBackend(query: string): Promise<AgentMode> {
  try {
    const backendPort = process.env.CAP_STORE_PORT || '9420'
    const response = await fetch(`http://localhost:${backendPort}/api/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: query,
        ctx: { surface: 'help-agent' },
      }),
    })

    if (response.ok) {
      const data = await response.json()
      if (data.ok) {
        // Determine mode based on the resolved intent
        if (data.requiresConfirmation) {
          return 'execute' // Needs user confirmation before executing
        }
        if (data.classification === 'read') {
          return 'explain' // Read-only intent → explain mode
        }
        return 'execute' // Action intent → execute mode
      }
    }
  } catch {
    // [audit] log the error with context here
    // Backend unavailable, fall back to keyword classification
  }

  return classifyIntentFallback(query)
}

/**
 * Fallback keyword-based classification (when backend is unavailable).
 */
function classifyIntentFallback(query: string): AgentMode {
  const lower = query.toLowerCase()

  const executeKeywords = ['add', 'create', 'send', 'open', 'switch', 'toggle', 'delete', 'remove']
  const guideKeywords = ['help me', 'how do i', 'how to', 'walk me', 'guide me', 'show me']
  const explainKeywords = ['what is', 'what does', 'explain', 'describe', 'how does']

  for (const kw of executeKeywords) {
    if (lower.startsWith(kw) && !lower.includes('?')) return 'execute'
  }
  for (const kw of guideKeywords) {
    if (lower.includes(kw)) return 'guide'
  }
  for (const kw of explainKeywords) {
    if (lower.includes(kw)) return 'explain'
  }
  return 'guide'
}

// ---------------------------------------------------------------------------
// Response generation based on mode
// ---------------------------------------------------------------------------

function generateResponse(
  _query: string,
  mode: AgentMode,
  screenContext?: Record<string, unknown>,
): {
  text: string
  citations: Array<{ source: string; snippet: string }>
  actions: Array<{ label: string; mode: string }>
} {
  const route = (screenContext?.page as { route?: string })?.route || 'unknown'

  if (mode === 'explain') {
    if (route === '/' || route.includes('chat')) {
      return {
        text: 'This is the **main chat interface** of Vivim. You can:\n\n- Type messages in the composer at the bottom\n- Switch between providers using the provider selector\n- View conversation history in the sidebar\n- Access capabilities via the command palette (Ctrl+K)\n\nThe canvas behind the chat provides additional context and visualizations.',
        citations: [
          {
            source: 'docs/merged-design-v2/00-merged-architecture.md',
            snippet: 'Architecture overview',
          },
        ],
        actions: [{ label: 'Walk me through it', mode: 'guide' }],
      }
    }

    return {
      text: `I can see you're on the **${route}** page. The screen context shows ${Array.isArray(screenContext?.elements) ? screenContext.elements.length : 0} interactive elements.\n\nTo give you a more specific explanation, I would need to analyze the DOM structure in detail. Would you like me to walk you through the key features on this page?`,
      citations: [
        { source: 'docs/merged-design-v2/00-merged-architecture.md', snippet: 'Page structure' },
      ],
      actions: [{ label: 'Walk me through it', mode: 'guide' }],
    }
  }

  if (mode === 'execute') {
    return {
      text: `I can help you execute that. Based on your request, here's what I'll do:\n\n1. Parse your intent into a capability call\n2. Execute the capability via the backend system\n3. Report the result\n\nWould you like me to proceed?`,
      citations: [
        { source: 'docs/merged-design-v2/04-merged-engines.md', snippet: 'Capability system' },
      ],
      actions: [
        { label: 'Do it', mode: 'execute' },
        { label: 'Show me how first', mode: 'guide' },
      ],
    }
  }

  // Guide mode (default)
  return {
    text: 'I can help you with that. Let me understand your request and provide step-by-step guidance.\n\nWhat specific aspect would you like to focus on first?',
    citations: [
      { source: 'docs/merged-design-v2/04-merged-engines.md', snippet: 'Workflow guidance' },
    ],
    actions: [
      { label: 'Start walkthrough', mode: 'guide' },
      { label: 'Just explain', mode: 'explain' },
    ],
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json()
    const { query, screenContext, history, classifyOnly } = body

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Classify intent using backend NLCL system
    const mode = await classifyIntentViaBackend(query)

    // If classifyOnly, just return the mode
    if (classifyOnly) {
      return NextResponse.json({ mode })
    }

    // Generate response based on mode
    const response = generateResponse(query, mode, screenContext)

    // Create SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        // Send text chunks
        const words = response.text.split(' ')
        for (let i = 0; i < words.length; i++) {
          const chunk = `data: ${JSON.stringify({ type: 'text', content: (i === 0 ? '' : ' ') + words[i] })}\n\n`
          controller.enqueue(encoder.encode(chunk))
        }

        // Send citations
        if (response.citations.length > 0) {
          const citationsChunk = `data: ${JSON.stringify({ type: 'citations', content: response.citations })}\n\n`
          controller.enqueue(encoder.encode(citationsChunk))
        }

        // Send actions
        if (response.actions.length > 0) {
          const actionsChunk = `data: ${JSON.stringify({ type: 'actions', content: response.actions })}\n\n`
          controller.enqueue(encoder.encode(actionsChunk))
        }

        // End stream
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
