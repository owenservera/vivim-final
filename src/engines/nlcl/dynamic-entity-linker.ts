// src/engines/nlcl/dynamic-entity-linker.ts
// Tier 4 unit 16.5 — DynamicEntityLinker.
//
// Closes audit finding ❌-12: the upgrade design doc proposed DynamicEntityLinker
// as a separate pipeline stage. The audit observed this is wrong — entity
// linking must happen INSIDE parameter extraction, because:
//   1. The entity reference may be the value of any schema property (not just
//      a fixed "entityName" slot).
//   2. The schema's input shape determines which slots need entity linking
//      (a `workspaceId` slot needs workspace linking; a `conversationId` slot
//      needs conversation linking).
//   3. Running as a separate stage forces a second pass over the raw input,
//      which can produce conflicting extractions (param-extract pulls
//      "vivim" as a free-text string, entity-linker then tries to re-resolve
//      "vivim" as a workspace name — race condition).
//
// Architecture:
//   • EntityLinkerProvider interface — one implementation per entity type
//     (workspace, conversation, provider, slave, file, etc.).
//   • DynamicEntityLinker — registry of providers; called by param-extract
//     for each schema property whose name matches a known entity type.
//   • WorkspaceEntityLinker — first concrete impl; resolves "the vivim
//     workspace" / "my project" / "the canvas workspace" to a workspaceId
//     via the WorkspaceStore.
//
// The linker is OPT-IN — param-extract calls it only when an entity provider
// is registered for the schema property's name. Without providers, behavior
// is unchanged from the existing param-extract flow.

import type { NLCContext } from './types.js'

// ── Provider Interface ─────────────────────────────────────────────────────

export interface EntityLinkResult {
  /** The resolved entity ID, or null if no match. */
  entityId: string | null
  /** All candidate matches (for disambiguation flows). */
  candidates: EntityCandidate[]
  /** The source provider that produced this result (for audit). */
  provider: string
  /** Confidence in the match (0..1). */
  confidence: number
}

export interface EntityCandidate {
  id: string
  displayName: string
  /** Why this candidate was selected (for audit / debug). */
  matchedOn: 'exact' | 'prefix' | 'fuzzy' | 'context-default'
  score: number
}

export interface EntityLinkerProvider {
  /** The provider's entity type (e.g. 'workspace', 'conversation'). */
  readonly entityType: string
  /** Schema property names this provider handles (e.g. ['workspaceId', 'workspace']). */
  readonly handlesProperties: readonly string[]
  /** Resolve a raw text reference to an entity ID. */
  resolve(query: string, ctx: NLCContext): Promise<EntityLinkResult>
}

// ── Dynamic Entity Linker (registry) ──────────────────────────────────────

export class DynamicEntityLinker {
  private readonly providersByProperty = new Map<string, EntityLinkerProvider>()

  registerProvider(provider: EntityLinkerProvider): void {
    for (const prop of provider.handlesProperties) {
      this.providersByProperty.set(prop, provider)
    }
  }

  /** Check if any provider handles the given schema property. */
  hasProviderFor(property: string): boolean {
    return this.providersByProperty.has(property)
  }

  /** Resolve a property's value to an entity ID. Returns null if no provider. */
  async resolve(
    property: string,
    query: string,
    ctx: NLCContext,
  ): Promise<EntityLinkResult | null> {
    const provider = this.providersByProperty.get(property)
    if (!provider) return null
    return provider.resolve(query, ctx)
  }

  /** List all registered providers (for diagnostics). */
  listProviders(): EntityLinkerProvider[] {
    const seen = new Set<EntityLinkerProvider>()
    for (const p of this.providersByProperty.values()) {
      seen.add(p)
    }
    return [...seen]
  }
}

// ── WorkspaceEntityLinker (first concrete impl) ───────────────────────────

export interface WorkspaceStoreContract {
  listWorkspaces(): Promise<
    Array<{ id: string; name: string; path: string; description?: string | null }>
  >
  getWorkspaceByName(
    name: string,
  ): Promise<{ id: string; name: string; path: string; description?: string | null } | null>
}

/**
 * Resolves natural-language workspace references to workspace IDs.
 *
 * Patterns handled:
 *   • "the vivim workspace" / "vivim workspace" → exact name match
 *   • "my project" / "the project" → ctx.metadata.workspacePath or first workspace
 *   • "the canvas workspace" / "current workspace" → ctx.metadata.activeWorkspaceId
 *   • bare workspace name → fuzzy match
 */
export class WorkspaceEntityLinker implements EntityLinkerProvider {
  readonly entityType = 'workspace'
  readonly handlesProperties = ['workspaceId', 'workspace', 'targetWorkspaceId'] as const

  constructor(private readonly store: WorkspaceStoreContract) {}

  async resolve(query: string, ctx: NLCContext): Promise<EntityLinkResult> {
    const trimmed = query.trim()
    if (!trimmed) {
      return this.empty()
    }

    // Pattern 1: "the X workspace" / "X workspace"
    const explicitMatch = trimmed.match(/^(?:the\s+)?(.+?)\s+workspace$/i)
    if (explicitMatch) {
      const name = explicitMatch[1]?.trim()
      if (name) {
        const exact = await this.store.getWorkspaceByName(name)
        if (exact) {
          return {
            entityId: exact.id,
            candidates: [{ id: exact.id, displayName: exact.name, matchedOn: 'exact', score: 1.0 }],
            provider: 'workspace',
            confidence: 1.0,
          }
        }
      }
    }

    // Pattern 2: "current workspace" / "the canvas workspace"
    if (/^(current|active|the\s+canvas)\s+workspace$/i.test(trimmed)) {
      const activeId = ctx.metadata?.activeWorkspaceId as string | undefined
      if (activeId) {
        return {
          entityId: activeId,
          candidates: [
            { id: activeId, displayName: '<active>', matchedOn: 'context-default', score: 0.9 },
          ],
          provider: 'workspace',
          confidence: 0.9,
        }
      }
    }

    // Pattern 3: "my project" / "the project"
    if (/^(my|the)\s+project$/i.test(trimmed)) {
      const path = ctx.metadata?.workspacePath as string | undefined
      if (path) {
        const all = await this.store.listWorkspaces()
        const match = all.find((w) => w.path === path)
        if (match) {
          return {
            entityId: match.id,
            candidates: [
              { id: match.id, displayName: match.name, matchedOn: 'context-default', score: 0.85 },
            ],
            provider: 'workspace',
            confidence: 0.85,
          }
        }
      }
      // Fall back to first workspace (best-effort).
      const all = await this.store.listWorkspaces()
      if (all.length > 0 && all[0]) {
        return {
          entityId: all[0].id,
          candidates: [
            { id: all[0].id, displayName: all[0].name, matchedOn: 'context-default', score: 0.5 },
          ],
          provider: 'workspace',
          confidence: 0.5,
        }
      }
    }

    // Pattern 4: bare workspace name — fuzzy match against all workspaces.
    const all = await this.store.listWorkspaces()
    const candidates: EntityCandidate[] = []
    const lowerQuery = trimmed.toLowerCase()
    for (const ws of all) {
      const lowerName = ws.name.toLowerCase()
      if (lowerName === lowerQuery) {
        candidates.push({
          id: ws.id,
          displayName: ws.name,
          matchedOn: 'exact',
          score: 1.0,
        })
      } else if (lowerName.startsWith(lowerQuery) || lowerQuery.startsWith(lowerName)) {
        candidates.push({
          id: ws.id,
          displayName: ws.name,
          matchedOn: 'prefix',
          score: 0.7,
        })
      } else if (lowerName.includes(lowerQuery) || lowerQuery.includes(lowerName)) {
        candidates.push({
          id: ws.id,
          displayName: ws.name,
          matchedOn: 'fuzzy',
          score: 0.5,
        })
      }
    }
    candidates.sort((a, b) => b.score - a.score)
    const top = candidates[0]
    if (top) {
      return {
        entityId: top.id,
        candidates,
        provider: 'workspace',
        confidence: top.score,
      }
    }

    return this.empty()
  }

  private empty(): EntityLinkResult {
    return {
      entityId: null,
      candidates: [],
      provider: 'workspace',
      confidence: 0,
    }
  }
}
