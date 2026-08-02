/**
 * Manifest Applier — Cloud → Local DB Bridge
 *
 * Parses verified ledger entries (ManifestContent shapes) and upserts
 * into the local Prisma DB. Called by the sync loop after chain verification.
 *
 * CRITICAL: All changes are additive — we only upsert, never delete.
 * The cloud ledger is the source of truth for provider manifests.
 */

import { newId } from '../../ids.js'
import { getLogger } from '../logger.js'
import type { CapStoreDb } from '../../storage/db.js'
import type {
  LedgerEntry,
  ManifestContent,
  ProviderDefinitionContent,
  ProviderEndpointContent,
  ProviderParserContent,
  ProviderCapabilityContent,
  CapabilityBindingContent,
  CapabilityTaxonomyContent,
} from './types.js'

const log = getLogger('manifest-applier')

export interface ApplyResult {
  entriesProcessed: number
  upserted: number
  skipped: number
  errors: Array<{ entryId: string; error: string }>
}

/**
 * Apply a batch of verified ledger entries to the local DB.
 *
 * Each entry's contentJson is parsed and dispatched to the appropriate
 * Prisma model based on its `type` field.
 */
export async function applyManifestEntries(
  db: CapStoreDb,
  entries: LedgerEntry[],
): Promise<ApplyResult> {
  const result: ApplyResult = {
    entriesProcessed: entries.length,
    upserted: 0,
    skipped: 0,
    errors: [],
  }

  for (const entry of entries) {
    try {
      const content = JSON.parse(entry.contentJson) as ManifestContent
      const applied = await applySingleEntry(db, entry, content)
      if (applied) {
        result.upserted++
      } else {
        result.skipped++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error(`[manifest-applier] entry ${entry.id} failed: ${msg}`)
      result.errors.push({ entryId: entry.id, error: msg })
    }
  }

  log.info(
    `[manifest-applier] applied ${result.upserted}/${result.entriesProcessed} entries ` +
      `(${result.skipped} skipped, ${result.errors.length} errors)`,
  )

  return result
}

async function applySingleEntry(
  db: CapStoreDb,
  entry: LedgerEntry,
  content: ManifestContent,
): Promise<boolean> {
  switch (content.type) {
    case 'provider_definition':
      return applyProviderDefinition(db, entry, content)
    case 'provider_endpoint':
      return applyProviderEndpoint(db, entry, content)
    case 'provider_parser':
      return applyProviderParser(db, entry, content)
    case 'provider_capability':
      return applyProviderCapability(db, entry, content)
    case 'capability_binding':
      return applyCapabilityBinding(db, entry, content)
    case 'capability_taxonomy':
      return applyCapabilityTaxonomy(db, entry, content)
    default:
      log.warn(`[manifest-applier] unknown content type in entry ${entry.id}`)
      return false
  }
}

// ── Provider Definition ──────────────────────────────────────────────────────

async function applyProviderDefinition(
  db: CapStoreDb,
  entry: LedgerEntry,
  content: ProviderDefinitionContent,
): Promise<boolean> {
  const now = Date.now()
  await db.prisma.providerDefinition.upsert({
    where: { id: content.id },
    create: {
      id: content.id,
      slug: content.slug,
      displayName: content.name,
      description: content.description ?? null,
      category: content.category ?? 'ai',
      providerType: 'llm',
      isActive: 1,
      protocolStatus: 'Active',
      websiteUrl: content.homepage ?? null,
      documentationUrl: null,
      authType: 'browser',
      hasMultiAccount: 0,
      profileStrategy: 'per_account',
      fleetConfigJson: '{}',
      capabilitiesJson: '{}',
      modelsJson: '[]',
      createdAt: entry.createdAt,
      updatedAt: now,
    },
    update: {
      slug: content.slug,
      displayName: content.name,
      description: content.description ?? null,
      category: content.category ?? 'ai',
      websiteUrl: content.homepage ?? null,
      updatedAt: now,
    },
  })
  return true
}

// ── Provider Endpoint ────────────────────────────────────────────────────────

async function applyProviderEndpoint(
  db: CapStoreDb,
  entry: LedgerEntry,
  content: ProviderEndpointContent,
): Promise<boolean> {
  const now = Date.now()
  await db.prisma.providerEndpoint.upsert({
    where: { id: content.id },
    create: {
      id: content.id,
      providerId: content.providerId,
      url: content.url,
      label: content.endpointType,
      endpointType: content.endpointType,
      isDefault: 0,
      selectorsJson: '{}',
      composerType: 'textarea',
      sendMethod: 'both',
      contentEditable: 0,
      createdAt: entry.createdAt,
      updatedAt: now,
    },
    update: {
      url: content.url,
      label: content.endpointType,
      endpointType: content.endpointType,
      updatedAt: now,
    },
  })
  return true
}

// ── Provider Parser ──────────────────────────────────────────────────────────

async function applyProviderParser(
  db: CapStoreDb,
  entry: LedgerEntry,
  content: ProviderParserContent,
): Promise<boolean> {
  const now = Date.now()
  await db.prisma.providerParser.upsert({
    where: { id: content.id },
    create: {
      id: content.id,
      providerId: content.providerId,
      parserName: content.parserName,
      parserVersion: content.parserVersion,
      parserLogicType: content.logicType,
      parserFilePath: null,
      parserLogicCode: content.logicCode,
      parserHash: null,
      sampleBody: null,
      isActive: 1,
      fallbackParserId: content.fallbackParserId ?? null,
      createdAt: entry.createdAt,
      updatedAt: now,
    },
    update: {
      parserName: content.parserName,
      parserVersion: content.parserVersion,
      parserLogicType: content.logicType,
      parserLogicCode: content.logicCode,
      fallbackParserId: content.fallbackParserId ?? null,
      updatedAt: now,
    },
  })
  return true
}

// ── Provider Capability ──────────────────────────────────────────────────────

async function applyProviderCapability(
  db: CapStoreDb,
  entry: LedgerEntry,
  content: ProviderCapabilityContent,
): Promise<boolean> {
  const now = Date.now()
  await db.prisma.providerCapability.upsert({
    where: {
      providerId_globalCapabilityId: {
        providerId: content.providerId,
        globalCapabilityId: content.id,
      },
    },
    create: {
      id: newId(),
      providerId: content.providerId,
      globalCapabilityId: content.id,
      recoveryStrategiesJson: '[]',
      confidence: 1.0,
      successCount: 0,
      failCount: 0,
      consecutiveFailures: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      selectorHitCount: 0,
      selectorMissCount: 0,
      createdAt: entry.createdAt,
      updatedAt: now,
    },
    update: {
      updatedAt: now,
    },
  })
  return true
}

// ── Capability Binding ───────────────────────────────────────────────────────

async function applyCapabilityBinding(
  db: CapStoreDb,
  entry: LedgerEntry,
  content: CapabilityBindingContent,
): Promise<boolean> {
  const now = Date.now()
  await db.prisma.capabilityBinding.upsert({
    where: {
      globalId_providerId: {
        globalId: content.capabilityId,
        providerId: content.providerId,
      },
    },
    create: {
      id: content.id,
      globalId: content.capabilityId,
      providerId: content.providerId,
      status: 'prospect',
      confidence: 0.0,
      promotionHistoryJson: '[]',
      createdAt: entry.createdAt,
      updatedAt: now,
    },
    update: {
      updatedAt: now,
    },
  })
  return true
}

// ── Capability Taxonomy ──────────────────────────────────────────────────────

async function applyCapabilityTaxonomy(
  db: CapStoreDb,
  entry: LedgerEntry,
  content: CapabilityTaxonomyContent,
): Promise<boolean> {
  const now = Date.now()
  await db.prisma.capabilityTaxonomy.upsert({
    where: { id: content.id },
    create: {
      id: content.id,
      slug: `cloud_${content.id}`,
      name: content.platformCategory,
      description: null,
      category: content.platformCategory,
      tier: 0,
      tagsJson: '[]',
      interactionPattern: content.interactionPattern,
      messageTypesJson: content.messageTypesJson,
      capabilitiesJson: content.capabilitiesJson,
      constraintsJson: content.constraintsJson,
      authRequirementsJson: content.authRequirementsJson,
      discoveryHintsJson: content.discoveryHintsJson,
      nlpEntityTypesJson: content.nlpEntityTypesJson,
      nlpIntentPatternsJson: content.nlpIntentPatternsJson,
      entityHierarchyJson: content.entityHierarchyJson,
      syncCapabilitiesJson: content.syncCapabilitiesJson,
      createdAt: entry.createdAt,
      updatedAt: now,
    },
    update: {
      name: content.platformCategory,
      category: content.platformCategory,
      interactionPattern: content.interactionPattern,
      messageTypesJson: content.messageTypesJson,
      capabilitiesJson: content.capabilitiesJson,
      constraintsJson: content.constraintsJson,
      authRequirementsJson: content.authRequirementsJson,
      discoveryHintsJson: content.discoveryHintsJson,
      nlpEntityTypesJson: content.nlpEntityTypesJson,
      nlpIntentPatternsJson: content.nlpIntentPatternsJson,
      entityHierarchyJson: content.entityHierarchyJson,
      syncCapabilitiesJson: content.syncCapabilitiesJson,
      updatedAt: now,
    },
  })
  return true
}
