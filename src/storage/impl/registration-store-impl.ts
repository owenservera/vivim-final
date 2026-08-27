// src/storage/impl/registration-store-impl.ts
// Prisma-backed RegistrationStore for RegistrationAuditor.

import type { Prisma } from '@prisma/client'
import { newId } from '../../ids.js'
import type {
  ManifestDriftInput,
  ManifestDriftRow,
  ManifestVersionInput,
  ProviderManifestVersionRow,
  RegistrationEventInput,
  RegistrationEventRow,
} from '../../schema/types.js'
import type { RegistrationStore } from '../contracts/registration-store.js'
import type { CapStoreDb } from '../db.js'
import type { PrismaClient } from '../prisma.js'

export class RegistrationStoreImpl implements RegistrationStore {
  private db: PrismaClient

  constructor(db: CapStoreDb) {
    this.db = db.prisma
  }

  private get p() {
    return this.db
  }

  async createManifestVersion(input: ManifestVersionInput): Promise<ProviderManifestVersionRow> {
    const id = newId()
    const now = BigInt(Date.now())
    const r = await this.p.providerManifestVersion.create({
      data: {
        id,
        providerId: input.provider_id,
        manifestFile: input.manifest_file,
        version: input.version,
        hash: input.hash,
        contentJson: input.content_json,
        changeSummary: input.change_summary ?? null,
        actor: input.actor,
        createdAt: now,
      },
    })
    return {
      id: r.id,
      provider_id: r.providerId,
      manifest_file: r.manifestFile,
      version: r.version,
      hash: r.hash,
      content_json: r.contentJson,
      change_summary: r.changeSummary,
      actor: r.actor,
      created_at: Number(r.createdAt),
    }
  }

  async getLatestManifestVersion(
    providerId: string,
    file: string,
  ): Promise<ProviderManifestVersionRow | null> {
    const r = await this.p.providerManifestVersion.findFirst({
      where: { providerId, manifestFile: file },
      orderBy: { version: 'desc' },
    })
    if (!r) return null
    return {
      id: r.id,
      provider_id: r.providerId,
      manifest_file: r.manifestFile,
      version: r.version,
      hash: r.hash,
      content_json: r.contentJson,
      change_summary: r.changeSummary,
      actor: r.actor,
      created_at: Number(r.createdAt),
    }
  }

  async getManifestVersionHistory(
    providerId: string,
    limit?: number,
  ): Promise<ProviderManifestVersionRow[]> {
    const rows = await this.p.providerManifestVersion.findMany({
      where: { providerId },
      orderBy: { createdAt: 'desc' },
      take: limit ?? 50,
    })
    return rows.map((r) => ({
      id: r.id,
      provider_id: r.providerId,
      manifest_file: r.manifestFile,
      version: r.version,
      hash: r.hash,
      content_json: r.contentJson,
      change_summary: r.changeSummary,
      actor: r.actor,
      created_at: Number(r.createdAt),
    }))
  }

  async createRegistrationEvent(input: RegistrationEventInput): Promise<RegistrationEventRow> {
    const id = newId()
    const now = BigInt(Date.now())
    const r = await this.p.registrationEvent.create({
      data: {
        id,
        providerId: input.provider_id,
        manifestVersionId: input.manifest_version_id ?? null,
        eventType: input.event_type,
        tableName: input.table_name,
        recordId: input.record_id ?? null,
        fieldName: input.field_name ?? null,
        fromValue: input.from_value ?? null,
        toValue: input.to_value ?? null,
        changeSummary: input.change_summary ?? null,
        actor: input.actor,
        ts: now,
      },
    })
    return {
      id: r.id,
      provider_id: r.providerId,
      manifest_version_id: r.manifestVersionId,
      event_type: r.eventType,
      table_name: r.tableName,
      record_id: r.recordId,
      field_name: r.fieldName,
      from_value: r.fromValue,
      to_value: r.toValue,
      change_summary: r.changeSummary,
      actor: r.actor,
      ts: Number(r.ts),
    }
  }

  async getRegistrationEvents(
    providerId: string,
    opts?: { limit?: number; since?: number },
  ): Promise<RegistrationEventRow[]> {
    const where: Prisma.RegistrationEventWhereInput = { providerId }
    if (opts?.since !== undefined) {
      where.ts = { gte: opts.since }
    }
    const rows = await this.p.registrationEvent.findMany({
      where,
      orderBy: { ts: 'desc' },
      take: opts?.limit ?? 100,
    })
    return rows.map((r) => ({
      id: r.id,
      provider_id: r.providerId,
      manifest_version_id: r.manifestVersionId,
      event_type: r.eventType,
      table_name: r.tableName,
      record_id: r.recordId,
      field_name: r.fieldName,
      from_value: r.fromValue,
      to_value: r.toValue,
      change_summary: r.changeSummary,
      actor: r.actor,
      ts: Number(r.ts),
    }))
  }

  async getRegistrationEventsByTable(
    table: string,
    opts?: { limit?: number },
  ): Promise<RegistrationEventRow[]> {
    const rows = await this.p.registrationEvent.findMany({
      where: { tableName: table },
      orderBy: { ts: 'desc' },
      take: opts?.limit ?? 100,
    })
    return rows.map((r) => ({
      id: r.id,
      provider_id: r.providerId,
      manifest_version_id: r.manifestVersionId,
      event_type: r.eventType,
      table_name: r.tableName,
      record_id: r.recordId,
      field_name: r.fieldName,
      from_value: r.fromValue,
      to_value: r.toValue,
      change_summary: r.changeSummary,
      actor: r.actor,
      ts: Number(r.ts),
    }))
  }

  async createManifestDrift(drift: ManifestDriftInput): Promise<ManifestDriftRow> {
    const id = newId()
    const now = BigInt(Date.now())
    const r = await this.p.manifestDrift.create({
      data: {
        id,
        providerId: drift.provider_id,
        driftType: drift.drift_type,
        tableName: drift.table_name ?? null,
        recordId: drift.record_id ?? null,
        seedValue: drift.seed_value ?? null,
        dbValue: drift.db_value ?? null,
        resolved: 0,
        resolvedByActor: null,
        resolvedAt: null,
        detectedAt: now,
      },
    })
    return {
      id: r.id,
      provider_id: r.providerId,
      drift_type: r.driftType,
      table_name: r.tableName,
      record_id: r.recordId,
      seed_value: r.seedValue,
      db_value: r.dbValue,
      resolved: r.resolved,
      resolved_by_actor: r.resolvedByActor,
      resolved_at: r.resolvedAt !== null ? Number(r.resolvedAt) : null,
      detected_at: Number(r.detectedAt),
    }
  }

  async getUnresolvedDrifts(providerId: string): Promise<ManifestDriftRow[]> {
    const rows = await this.p.manifestDrift.findMany({
      where: { providerId, resolved: 0 },
      orderBy: { detectedAt: 'desc' },
    })
    return rows.map((r) => ({
      id: r.id,
      provider_id: r.providerId,
      drift_type: r.driftType,
      table_name: r.tableName,
      record_id: r.recordId,
      seed_value: r.seedValue,
      db_value: r.dbValue,
      resolved: r.resolved,
      resolved_by_actor: r.resolvedByActor,
      resolved_at: r.resolvedAt !== null ? Number(r.resolvedAt) : null,
      detected_at: Number(r.detectedAt),
    }))
  }

  async resolveDrift(driftId: string, actor: string): Promise<void> {
    await this.p.manifestDrift.update({
      where: { id: driftId },
      data: { resolved: 1, resolvedByActor: actor, resolvedAt: BigInt(Date.now()) },
    })
  }

  async getDriftHistory(providerId: string, limit?: number): Promise<ManifestDriftRow[]> {
    const rows = await this.p.manifestDrift.findMany({
      where: { providerId },
      orderBy: { detectedAt: 'desc' },
      take: limit ?? 50,
    })
    return rows.map((r) => ({
      id: r.id,
      provider_id: r.providerId,
      drift_type: r.driftType,
      table_name: r.tableName,
      record_id: r.recordId,
      seed_value: r.seedValue,
      db_value: r.dbValue,
      resolved: r.resolved,
      resolved_by_actor: r.resolvedByActor,
      resolved_at: r.resolvedAt !== null ? Number(r.resolvedAt) : null,
      detected_at: Number(r.detectedAt),
    }))
  }
}
