/**
 * backend-client.ts — Zod-validated fetch layer to localhost:9420.
 *
 * ALL API calls go through this module. Never call fetch() directly.
 * Validates every response at the boundary with Zod schemas.
 */
import { z } from "zod"

const BACKEND = "http://localhost:9420"
const WS_BACKEND = "ws://localhost:9420"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackendResponse<T> {
  ok: boolean
  data?: T
  error?: string
  status: number
}

export interface SessionState {
  sessionId: string | null
  userId: string | null
  email: string | null
  token: string | null
  authenticated: boolean
}

// ---------------------------------------------------------------------------
// Zod schemas for backend responses
// ---------------------------------------------------------------------------

export const CapabilitySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  surfaces: z.array(z.string()).optional(),
  category: z.string().optional(),
  action: z.string().optional(),
})

export const CapabilityListSchema = z.object({
  capabilities: z.array(CapabilitySchema),
  total: z.number().optional(),
})

export const InterpretRequestSchema = z.object({
  nl: z.string(),
  context: z.record(z.unknown()).optional(),
})

export const InterpretResponseSchema = z.object({
  capabilityId: z.string().optional(),
  slug: z.string().optional(),
  result: z.unknown().optional(),
  error: z.string().optional(),
})

export const ExecuteResponseSchema = z.object({
  success: z.boolean().optional(),
  result: z.unknown().optional(),
  error: z.string().optional(),
})

export const HealthResponseSchema = z.object({
  status: z.string(),
  version: z.string().optional(),
  uptime: z.number().optional(),
})

export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
})

export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  createdAt: z.string(),
  metadata: z.record(z.unknown()).optional(),
})

// ---------------------------------------------------------------------------
// Internal fetch wrapper
// ---------------------------------------------------------------------------

let sessionToken: string | null = null

export function setSessionToken(token: string | null) {
  sessionToken = token
}

export function getSessionToken(): string | null {
  return sessionToken
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestInit = {},
): Promise<BackendResponse<T>> {
  const url = `${BACKEND}${path}`
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  }
  if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`
  }

  try {
    const res = await fetch(url, { ...options, headers })
    const body = await res.text()

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}`, status: res.status }
    }

    const json = JSON.parse(body)
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      return { ok: false, error: `Schema error: ${parsed.error.message}`, status: res.status }
    }

    return { ok: true, data: parsed.data, status: res.status }
  } catch (err) {
    return { ok: false, error: String(err), status: 0 }
  }
}

// ---------------------------------------------------------------------------
// Public API methods
// ---------------------------------------------------------------------------

/** Health check — GET /api/health */
export async function checkHealth() {
  return request("/api/health", HealthResponseSchema)
}

/** List capabilities — GET /api/capabilities */
export async function listCapabilities(surface?: string) {
  const qs = surface ? `?surface=${surface}` : ""
  return request(`/api/capabilities${qs}`, CapabilityListSchema)
}

/** Interpret natural language — POST /api/interpret */
export async function interpret(nl: string, context?: Record<string, unknown>) {
  return request("/api/interpret", InterpretResponseSchema, {
    method: "POST",
    body: JSON.stringify({ nl, context }),
  })
}

/** Execute a capability — POST /api/capabilities/:id/execute */
export async function executeCapability(capabilityId: string, input?: Record<string, unknown>) {
  return request(`/api/capabilities/${encodeURIComponent(capabilityId)}/execute`, ExecuteResponseSchema, {
    method: "POST",
    body: JSON.stringify(input ?? {}),
  })
}

/** List conversations — GET /api/conversations */
export async function listConversations() {
  return request("/api/conversations", z.object({ conversations: z.array(ConversationSchema) }))
}

/** Get messages — GET /api/conversations/:id/messages */
export async function getMessages(conversationId: string) {
  return request(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, z.object({ messages: z.array(MessageSchema) }))
}

/** Send message — POST /api/conversations/:id/messages */
export async function sendMessage(conversationId: string, content: string) {
  return request(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, MessageSchema, {
    method: "POST",
    body: JSON.stringify({ content }),
  })
}

/** Login — POST /api/auth/login */
export async function login(email: string, password: string) {
  return request("/api/auth/login", z.object({ token: z.string(), userId: z.string(), email: z.string() }), {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
}

/** Logout — POST /api/auth/logout */
export async function logout() {
  return request("/api/auth/logout", z.object({ ok: z.boolean() }), { method: "POST" })
}

/** Get current session — GET /api/auth/session */
export async function getSession() {
  return request("/api/auth/session", z.object({
    authenticated: z.boolean(),
    userId: z.string().nullable(),
    email: z.string().nullable(),
  }))
}

// ---------------------------------------------------------------------------
// Conversation CRUD
// ---------------------------------------------------------------------------

/** Create conversation — POST /api/conversations */
export async function createConversation(providerId?: string) {
  return request("/api/conversations", ConversationSchema, {
    method: "POST",
    body: JSON.stringify({ providerId }),
  })
}

/** Delete conversation — DELETE /api/conversations/:id */
export async function deleteConversation(conversationId: string) {
  return request(`/api/conversations/${encodeURIComponent(conversationId)}`, z.object({ ok: z.boolean() }), {
    method: "DELETE",
  })
}

// ---------------------------------------------------------------------------
// Provider API
// ---------------------------------------------------------------------------

export const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
})

/** List providers — GET /api/providers */
export async function listProviders() {
  return request("/api/providers", z.object({ providers: z.array(ProviderSchema) }))
}

/** Get provider capabilities — GET /api/providers/:id/capabilities */
export async function getProviderCapabilities(providerId: string, planTier?: string) {
  const qs = planTier ? `?planTier=${planTier}` : ""
  return request(`/api/providers/${encodeURIComponent(providerId)}/capabilities${qs}`, CapabilityListSchema)
}

// ---------------------------------------------------------------------------
// Knowledge API
// ---------------------------------------------------------------------------

export const KnowledgeResultSchema = z.object({
  id: z.string(),
  content: z.string(),
  source: z.string().optional(),
  timestamp: z.string().optional(),
  score: z.number().optional(),
})

/** Search knowledge — GET /api/knowledge/search?q=<query> */
export async function searchKnowledge(query: string) {
  const qs = encodeURIComponent(query)
  return request(`/api/knowledge/search?q=${qs}`, z.object({ results: z.array(KnowledgeResultSchema) }))
}

/** Ingest knowledge — POST /api/knowledge/ingest */
export async function ingestKnowledge(content: string, source?: string) {
  return request("/api/knowledge/ingest", z.object({ id: z.string() }), {
    method: "POST",
    body: JSON.stringify({ content, source }),
  })
}

/** Synthesize knowledge — POST /api/knowledge/synthesize */
export async function synthesizeKnowledge(query: string) {
  return request("/api/knowledge/synthesize", z.object({ answer: z.string(), sources: z.array(z.string()) }), {
    method: "POST",
    body: JSON.stringify({ query }),
  })
}

// ---------------------------------------------------------------------------
// Memory API
// ---------------------------------------------------------------------------

export const MemoryFactSchema = z.object({
  id: z.string(),
  content: z.string(),
  confidence: z.number().optional(),
  createdAt: z.string().optional(),
})

/** Assert memory — POST /api/memory/assert */
export async function assertMemory(content: string) {
  return request("/api/memory/assert", MemoryFactSchema, {
    method: "POST",
    body: JSON.stringify({ content }),
  })
}

/** Query memory — GET /api/memory/query?q=<query> */
export async function queryMemory(query: string) {
  const qs = encodeURIComponent(query)
  return request(`/api/memory/query?q=${qs}`, z.object({ facts: z.array(MemoryFactSchema) }))
}

/** Forget memory — DELETE /api/memory/:id */
export async function forgetMemory(factId: string) {
  return request(`/api/memory/${encodeURIComponent(factId)}`, z.object({ ok: z.boolean() }), {
    method: "DELETE",
  })
}

// ---------------------------------------------------------------------------
// Telemetry API
// ---------------------------------------------------------------------------

export const ProviderHealthSchema = z.object({
  providerId: z.string(),
  status: z.string(),
  latency: z.number().optional(),
  errorCount: z.number().optional(),
  lastCheck: z.string().optional(),
})

/** Get fleet health — GET /api/telemetry/health */
export async function getHealth() {
  return request("/api/telemetry/health", z.object({ providers: z.array(ProviderHealthSchema) }))
}

// ---------------------------------------------------------------------------
// Session API
// ---------------------------------------------------------------------------

export const SessionSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  slaveId: z.string().optional(),
  conversationId: z.string().optional(),
  createdAt: z.string().optional(),
})

/** Load session — POST /api/session/load */
export async function loadSession(providerId: string, accountId?: string) {
  return request("/api/session/load", SessionSchema, {
    method: "POST",
    body: JSON.stringify({ providerId, accountId }),
  })
}

/** List sessions — GET /api/session/list */
export async function listSessions() {
  return request("/api/session/list", z.object({ sessions: z.array(SessionSchema) }))
}

/** End session — DELETE /api/session/:id */
export async function endSession(sessionId: string) {
  return request(`/api/session/${encodeURIComponent(sessionId)}`, z.object({ ok: z.boolean() }), {
    method: "DELETE",
  })
}

// ---------------------------------------------------------------------------
// WebSocket URL
// ---------------------------------------------------------------------------

export function getWsUrl(): string {
  return WS_BACKEND + "/ws"
}
