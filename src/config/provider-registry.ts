// src/config/provider-registry.ts
// Provider config cache sourced from the generated static protocol file
// (src/__generated__/provider-protocol.ts, or the .dev.ts override).
//
// The DB remains the single source of truth; ProviderProtocolGenerator compiles it
// into a static file at seed/gen time. This registry consumes that file so engines
// never hit the DB on the hot path. Toggle via PROVIDER_PROTOCOL_SOURCE=generated|dev.

import {
  loadProviderProtocol,
  normalizeProtocolSource,
} from '../engines/provider-protocol-loader.js'
import { config } from '../config.js'
import type { CapStoreDb } from '../storage/db.js'

export interface ProviderEndpointInfo {
  url: string
  label: string
  endpointType: string
  composerSelector?: string
  sendButtonSelector?: string
  composerType: string
  sendMethod: string
  contentEditable: boolean
}

export interface ProviderSelectorSet {
  composer: string[]
  sendButton: string[]
}

export interface CapturedEndpoint {
  urlPattern: RegExp
  label: string
}

export interface LoginIndicator {
  urlPattern: RegExp
  loggedInSelector?: string
  loggedOutSelector?: string
}

export interface ProviderRegistryConfig {
  definitions: Map<string, ProviderDef>
  endpoints: Map<string, ProviderEndpointInfo[]>
  selectors: Map<string, ProviderSelectorSet>
  urlPatterns: Map<string, RegExp>
  loginIndicators: Map<string, LoginIndicator>
  parsers: Map<string, { name: string; version: number }[]>
  capturePatterns: Map<string, RegExp>
  configs: Map<string, Map<string, string>>
}

interface ProviderDef {
  id: string
  slug: string
  displayName: string
  websiteUrl: string | null
  authType: string
}

let instance: ProviderRegistry | null = null

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export class ProviderRegistry {
  private config: ProviderRegistryConfig | null = null
  private protocolSource: 'generated' | 'dev' = 'generated'

  /**
   * Builds the in-memory config from the generated protocol file. This is now a
   * pure transform (no DB reads); the `.dev.ts` override is selected by
   * PROVIDER_PROTOCOL_SOURCE. Kept async for boot-call compatibility.
   */
  async initialize(): Promise<void> {
    const source = normalizeProtocolSource(config.providerProtocolSource)
    const { protocol } = await loadProviderProtocol(source)
    this.protocolSource = source

    const definitions = new Map<string, ProviderDef>()
    const endpoints = new Map<string, ProviderEndpointInfo[]>()
    const selectors = new Map<string, ProviderSelectorSet>()
    const urlPatterns = new Map<string, RegExp>()
    const loginIndicators = new Map<string, LoginIndicator>()
    const parsers = new Map<string, { name: string; version: number }[]>()
    const capturePatterns = new Map<string, RegExp>()
    const configs = new Map<string, Map<string, string>>()

    for (const p of protocol.providers) {
      if (!p.isActive) continue
      const slug = p.slug
      definitions.set(slug, {
        id: slug,
        slug,
        displayName: p.displayName,
        websiteUrl: p.websiteUrl ?? null,
        authType: p.authType,
      })

      const baseUrl = p.websiteUrl || `https://${slug}.com`
      urlPatterns.set(slug, new RegExp(`^${escapeRegex(baseUrl)}`, 'i'))

      const epList: ProviderEndpointInfo[] = (p.endpoints ?? []).map((e) => ({
        url: e.url,
        label: e.label,
        endpointType: e.endpointType,
        composerSelector: e.composerSelector,
        sendButtonSelector: e.sendButtonSelector,
        composerType: e.composerType,
        sendMethod: e.sendMethod,
        contentEditable: !!e.contentEditable,
      }))
      endpoints.set(slug, epList)

      const chatEp = epList.find((e) => e.endpointType === 'chat')
      if (chatEp) {
        const composers = [...(p.composerSelectors ?? [])]
        if (chatEp.composerType === 'quill')
          composers.push(
            'div.ql-editor[contenteditable="true"]',
            '.ql-editor',
            'rich-textarea [contenteditable]',
            'textarea',
          )
        else if (chatEp.contentEditable)
          composers.push('div[contenteditable="true"]', '[role="textbox"]', 'textarea')
        else if (composers.length === 0) composers.push('textarea')
        const sendButtons = [...(p.sendButtonSelectors ?? []), 'button[type="submit"]']
        selectors.set(slug, { composer: composers, sendButton: sendButtons })

        if (chatEp.url) {
          capturePatterns.set(
            slug,
            new RegExp(`${escapeRegex(chatEp.url).replace(/\/$/, '')}($|\\/|\\?)`),
          )
        }
      }

      parsers.set(
        slug,
        (p.parsers ?? []).map((pr) => ({ name: pr.name, version: pr.version })),
      )
      configs.set(slug, new Map(Object.entries(p.config ?? {})))

      const loginPattern = p.loginIndicator?.urlPattern ?? 'login|auth|signin|sign-in'
      loginIndicators.set(slug, { urlPattern: new RegExp(loginPattern, 'i') })
    }

    this.config = {
      definitions,
      endpoints,
      selectors,
      urlPatterns,
      loginIndicators,
      parsers,
      capturePatterns,
      configs,
    }
  }

  getProtocolSource(): 'generated' | 'dev' {
    return this.protocolSource
  }

  getConfig(): ProviderRegistryConfig {
    if (!this.config)
      throw new Error('ProviderRegistry not initialized — call initialize() at boot')
    return this.config
  }

  getComposerSelectors(providerId: string): string[] {
    return (
      this.getConfig().selectors.get(providerId)?.composer ?? [
        'textarea',
        '[contenteditable="true"]',
        '[role="textbox"]',
      ]
    )
  }

  getSendButtonSelectors(providerId: string): string[] {
    return this.getConfig().selectors.get(providerId)?.sendButton ?? ['button[type="submit"]']
  }

  getProviderUrl(providerId: string): string {
    const def = this.getConfig().definitions.get(providerId)
    const ep = this.getConfig().endpoints.get(providerId)
    const chatEp = ep?.find((e) => e.endpointType === 'chat')
    return chatEp?.url ?? def?.websiteUrl ?? `https://${providerId}.com`
  }

  getLoginUrl(providerId: string): string {
    const ep = this.getConfig().endpoints.get(providerId)
    const loginEp = ep?.find((e) => e.endpointType === 'login')
    if (loginEp?.url) return loginEp.url
    const def = this.getConfig().definitions.get(providerId)
    return def?.websiteUrl ? `${def.websiteUrl}/login` : `https://${providerId}.com/login`
  }

  getCapturePattern(providerId: string): RegExp | undefined {
    return this.getConfig().capturePatterns.get(providerId)
  }

  getLoginIndicator(providerId: string): LoginIndicator | undefined {
    return this.getConfig().loginIndicators.get(providerId)
  }

  getProviderList(): string[] {
    return Array.from(this.getConfig().definitions.keys())
  }

  getProviderUrlPattern(providerId: string): RegExp | undefined {
    return this.getConfig().urlPatterns.get(providerId)
  }

  getDefinitions(): Map<string, ProviderDef> {
    return this.getConfig().definitions
  }

  getEndpoints(providerId: string): ProviderEndpointInfo[] {
    return this.getConfig().endpoints.get(providerId) ?? []
  }

  getParserList(providerId: string): { name: string; version: number }[] {
    return this.getConfig().parsers.get(providerId) ?? []
  }
}

export function createProviderRegistry(_db?: CapStoreDb): ProviderRegistry {
  if (!instance) {
    instance = new ProviderRegistry()
  }
  return instance
}

export function getProviderRegistry(): ProviderRegistry {
  if (!instance)
    throw new Error('ProviderRegistry not created — call createProviderRegistry() at boot')
  return instance
}
