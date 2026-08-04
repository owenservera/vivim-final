// src/storage/impl/registration-store-impl.ts
// Prisma-backed RegistrationStore for RegistrationAuditor.

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

type PrismaLoose = any

export class RegistrationStoreImpl implements RegistrationStore {
  private db: PrismaLoose

  constructor(db: CapStoreDb) {
    this.db = db.loose
  }

  private get p() {
    return this.db.prisma
  }

  async createManifestVersion(input: ManifestVersionInput): Promise<ProviderManifestVersionRow> {
    const id = newId()
    const now = Date.now()
    const r = await this.p.providerManifestVersion.create({
      data: {
        id,
        provider_id: input.provider_id,
        manifest_file: input.manifest_file,
        version: input.version,
        hash: input.hash,
        content_json: input.content_json,
        change_summary: input.change_summary ?? null,
        actor: input.actor,
        created_at: now,
      },
    })
    return {
      id: r.id,
      provider_id: r.provider_id,
      manifest_file: r.manifest_file,
      version: r.version,
      hash: r.hash,
      content_json: r.content_json,
      change_summary: r.change_summary,
      actor: r.actor,
      created_at: r.created_at,
    }
  }

  async getLatestManifestVersion(
    providerId: string,
    file: string,
  ): Promise<ProviderManifestVersionRow | null> {
    const r = await this.p.providerManifestVersion.findFirst({
      where: { provider_id: providerId, manifest_file: file },
      orderBy: { version: 'desc' },
    })
    if (!r) return null
    return {
      id: r.id,
      provider_id: r.provider_id,
      manifest_file: r.manifest_file,
      version: r.version,
      hash: r.hash,
      content_json: r.content_json,
      change_summary: r.change_summary,
      actor: r.actor,
      created_at: r.created_at,
    }
  }

  async getManifestVersionHistory(
    providerId: string,
    limit?: number,
  ): Promise<ProviderManifestVersionRow[]> {
    const rows = await this.p.providerManifestVersion.findMany({
      where: { provider_id: providerId },
      orderBy: { created_at: 'desc' },
      take: limit ?? 50,
    })
    return (rows as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      provider_id: r.provider_id as string,
      manifest_file: r.manifest_file as string,
      version: r.version as number,
      hash: r.hash as string,
      content_json: r.content_json as string,
      change_summary: (r.change_summary as string) ?? null,
      actor: r.actor as string,
      created_at: r.created_at as number,
    }))
  }

  async createRegistrationEvent(input: RegistrationEventInput): Promise<RegistrationEventRow> {
    const id = newId()
    const now = Date.now()
    const r = await this.p.registrationEvent.create({
      data: {
        id,
        provider_id: input.provider_id,
        manifest_version_id: input.manifest_version_id ?? null,
        event_type: input.event_type,
        table_name: input.table_name,
        record_id: input.record_id ?? null,
        field_name: input.field_name ?? null,
        from_value: input.from_value ?? null,
        to_value: input.to_value ?? null,
        change_summary: input.change_summary ?? null,
        actor: input.actor,
        ts: now,
      },
    })
    return {
      id: r.id,
      provider_id: r.provider_id,
      manifest_version_id: r.manifest_version_id,
      event_type: r.event_type,
      table_name: r.table_name,
      record_id: r.record_id,
      field_name: r.field_name,
      from_value: r.from_value,
      to_value: r.to_value,
      change_summary: r.change_summary,
      actor: r.actor,
      ts: r.ts,
    }
  }

  async getRegistrationEvents(
    providerId: string,
    opts?: { limit?: number; since?: number },
  ): Promise<RegistrationEventRow[]> {
    const where: Record<string, unknown> = { provider_id: providerId }
    if (opts?.since !== undefined) {
      where.ts = { gte: opts.since }
    }
    const rows = await this.p.registrationEvent.findMany({
      where,
      orderBy: { ts: 'desc' },
      take: opts?.limit ?? 100,
    })
    return (rows as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      provider_id: r.provider_id as string,
      manifest_version_id: (r.manifest_version_id as string) ?? null,
      event_type: r.event_type as string,
      table_name: r.table_name as string,
      record_id: (r.record_id as string) ?? null,
      field_name: (r.field_name as string) ?? null,
      from_value: (r.from_value as string) ?? null,
      to_value: (r.to_value as string) ?? null,
      change_summary: (r.change_summary as string) ?? null,
      actor: r.actor as string,
      ts: r.ts as number,
    }))
  }

  async getRegistrationEventsByTable(
    table: string,
    opts?: { limit?: number },
  ): Promise<RegistrationEventRow[]> {
    const rows = await this.p.registrationEvent.findMany({
      where: { table_name: table },
      orderBy: { ts: 'desc' },
      take: opts?.limit ?? 100,
    })
    return (rows as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      provider_id: r.provider_id as string,
      manifest_version_id: (r.manifest_version_id as string) ?? null,
      event_type: r.event_type as string,
      table_name: r.table_name as string,
      record_id: (r.record_id as string) ?? null,
      field_name: (r.field_name as string) ?? null,
      from_value: (r.from_value as string) ?? null,
      to_value: (r.to_value as string) ?? null,
      change_summary: (r.change_summary as string) ?? null,
      actor: r.actor as string,
      ts: r.ts as number,
    }))
  }

  async createManifestDrift(drift: ManifestDriftInput): Promise<ManifestDriftRow> {
    const id = newId()
    const now = Date.now()
    const r = await this.p.manifestDrift.create({
      data: {
        id,
        provider_id: drift.provider_id,
        drift_type: drift.drift_type,
        table_name: drift.table_name ?? null,
        record_id: drift.record_id ?? null,
        seed_value: drift.seed_value ?? null,
        db_value: drift.db_value ?? null,
        resolved: 0,
        resolved_by_actor: null,
        resolved_at: null,
        detected_at: now,
      },
    })
    return {
      id: r.id,
      provider_id: r.provider_id,
      drift_type: r.drift_type,
      table_name: r.table_name,
      record_id: r.record_id,
      seed_value: r.seed_value,
      db_value: r.db_value,
      resolved: r.resolved,
      resolved_by_actor: r.resolved_by_actor,
      resolved_at: r.resolved_at,
      detected_at: r.detected_at,
    }
  }

  async getUnresolvedDrifts(providerId: string): Promise<ManifestDriftRow[]> {
    const rows = await this.p.manifestDrift.findMany({
      where: { provider_id: providerId, resolved: 0 },
      orderBy: { detected_at: 'desc' },
    })
    return (rows as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      provider_id: r.provider_id as string,
      drift_type: r.drift_type as string,
      table_name: (r.table_name as string) ?? null,
      record_id: (r.record_id as string) ?? null,
      seed_value: (r.seed_value as string) ?? null,
      db_value: (r.db_value as string) ?? null,
      resolved: r.resolved as number,
      resolved_by_actor: (r.resolved_by_actor as string) ?? null,
      resolved_at: (r.resolved_at as number) ?? null,
      detected_at: r.detected_at as number,
    }))
  }

  async resolveDrift(driftId: string, actor: string): Promise<void> {
    await this.p.manifestDrift.update({
      where: { id: driftId },
      data: { resolved: 1, resolved_by_actor: actor, resolved_at: Date.now() },
    })
  }

  async getDriftHistory(providerId: string, limit?: number): Promise<ManifestDriftRow[]> {
    const rows = await this.p.manifestDrift.findMany({
      where: { provider_id: providerId },
      orderBy: { detected_at: 'desc' },
      take: limit ?? 50,
    })
    return (rows as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      provider_id: r.provider_id as string,
      drift_type: r.drift_type as string,
      table_name: (r.table_name as string) ?? null,
      record_id: (r.record_id as string) ?? null,
      seed_value: (r.seed_value as string) ?? null,
      db_value: (r.db_value as string) ?? null,
      resolved: r.resolved as number,
      resolved_by_actor: (r.resolved_by_actor as string) ?? null,
      resolved_at: (r.resolved_at as number) ?? null,
      detected_at: r.detected_at as number,
    }))
  }
}
