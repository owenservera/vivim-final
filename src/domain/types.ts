// src/domain/types.ts
// Core domain types for the Chrome slave platform.
// Phase 2: Domain Layer isolates business logic from runtime mechanics.

import type { SlaveLifecycle } from '../executor/slave-states.js'

// ── Core Domain Entities ────────────────────────────────────────────────────

/**
 * Unique identifier for a Chrome slave instance.
 */
export type SlaveId = string & { __brand: 'SlaveId' }

/**
 * Unique identifier for a provider (e.g., 'chatgpt', 'claude', 'gemini').
 */
export type ProviderId = string & { __brand: 'ProviderId' }

/**
 * Unique identifier for an account within a provider.
 */
export type AccountId = string & { __brand: 'AccountId' }

/**
 * Unique identifier for a pool lease.
 */
export type LeaseId = string & { __brand: 'LeaseId' }

/**
 * Unique identifier for a conversation.
 */
export type ConversationId = string & { __brand: 'ConversationId' }

// ── Domain Models ───────────────────────────────────────────────────────────

/**
 * Represents a Chrome slave instance in the domain.
 */
export interface Slave {
  id: SlaveId
  providerId: ProviderId
  accountId: AccountId
  debugPort: number
  profileDir: string
  status: SlaveLifecycle
  pid: number | null
  consecutiveFailures: number
  lastHealthCheck: number
  createdAt: number
}

/**
 * Represents a lease on a Chrome slave from the pool.
 */
export interface Lease {
  id: LeaseId
  slaveId: SlaveId
  providerId: ProviderId
  accountId: AccountId
  acquiredAt: number
  expiresAt: number
  healthy: boolean
}

/**
 * Represents a provider configuration in the domain.
 */
export interface Provider {
  id: ProviderId
  name: string
  urls: {
    login: string
    app: string
    loggedInPattern: RegExp
  }
  selectors: {
    composer: string[]
    sendButton: string[]
    fallback: 'heuristic'
  }
  composerType: 'textarea' | 'contenteditable' | 'quill' | 'codemirror'
}

/**
 * Represents a capability registered for a provider.
 */
export interface Capability {
  id: string
  providerId: ProviderId
  action: string
  surfaces: string[]
}

// ── Value Objects ───────────────────────────────────────────────────────────

/**
 * Represents a browser endpoint (local or remote).
 * Phase 2: Remote-Readiness — no assumption of localhost.
 */
export interface BrowserEndpoint {
  type: 'local' | 'remote' | 'container'
  host: string
  port: number
  path?: string
}

/**
 * Represents resource requirements for a CDP command.
 */
export interface ResourceRequirements {
  resourceClass: 'DOM' | 'Input' | 'Runtime' | 'Network' | 'Screenshot' | 'Target'
  exclusive: boolean
  timeoutMs: number
}

// ── Factory Functions ───────────────────────────────────────────────────────

export function createSlaveId(id: string): SlaveId {
  return id as SlaveId
}

export function createProviderId(id: string): ProviderId {
  return id as ProviderId
}

export function createAccountId(id: string): AccountId {
  return id as AccountId
}

export function createLeaseId(id: string): LeaseId {
  return id as LeaseId
}

export function createConversationId(id: string): ConversationId {
  return id as ConversationId
}
