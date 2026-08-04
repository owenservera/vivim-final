// src/storage/impl/contact-store-impl.ts
// Prisma-backed ContactStore — CRUD + merge for Contact + ContactIdentity.

import { newId } from '../../ids.js'
import { type CapStoreDb, type PrismaLoose } from '../db.js'

// ── Domain types ────────────────────────────────────────────────────────────

export interface ContactRow {
  id: string
  providerId: string
  accountId: string
  providerNativeId: string
  displayName: string
  username: string | null
  avatarUrl: string | null
  phoneNumber: string | null
  email: string | null
  isOnline: number
  statusText: string | null
  lastSeenAt: number | null
  relationship: string | null
  isFavorite: number
  isBlocked: number
  notes: string | null
  metadataJson: string | null
  createdAt: number
  updatedAt: number
}

export interface ContactIdentityRow {
  id: string
  canonicalContactId: string
  mergedContactId: string
  mergeConfidence: number
  mergeMethod: string
  isConfirmed: number
  createdAt: number
}

// ── Store implementation ────────────────────────────────────────────────────

export class ContactStoreImpl {
  constructor(private readonly db: CapStoreDb) {}

  async getContactById(id: string): Promise<ContactRow | null> {
    const row = await this.db.loose.contact.findUnique({ where: { id } })
    return row ? this.toRow(row) : null
  }

  async getContactsByAccount(accountId: string): Promise<ContactRow[]> {
    const rows = await this.db.loose.contact.findMany({
      where: { accountId },
      orderBy: { updatedAt: 'desc' },
    })
    return rows.map((r: Record<string, unknown>) => this.toRow(r))
  }

  async getContactByNativeId(providerId: string, accountId: string, providerNativeId: string): Promise<ContactRow | null> {
    const row = await this.db.loose.contact.findFirst({
      where: { providerId, accountId, providerNativeId },
    })
    return row ? this.toRow(row) : null
  }

  async searchContacts(query: string, accountId?: string): Promise<ContactRow[]> {
    const where: Record<string, unknown> = {
      OR: [
        { displayName: { contains: query } },
        { username: { contains: query } },
        { email: { contains: query } },
        { phoneNumber: { contains: query } },
      ],
    }
    if (accountId) where.accountId = accountId
    const rows = await this.db.loose.contact.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })
    return rows.map((r: Record<string, unknown>) => this.toRow(r))
  }

  async createContact(input: {
    providerId: string
    accountId: string
    providerNativeId: string
    displayName: string
    username?: string
    avatarUrl?: string
    phoneNumber?: string
    email?: string
    relationship?: string
    notes?: string
    metadataJson?: string
  }): Promise<ContactRow> {
    const now = Date.now()
    const row = await this.db.loose.contact.create({
      data: {
        id: newId(),
        providerId: input.providerId,
        accountId: input.accountId,
        providerNativeId: input.providerNativeId,
        displayName: input.displayName,
        username: input.username ?? null,
        avatarUrl: input.avatarUrl ?? null,
        phoneNumber: input.phoneNumber ?? null,
        email: input.email ?? null,
        isOnline: 0,
        statusText: null,
        lastSeenAt: null,
        relationship: input.relationship ?? null,
        isFavorite: 0,
        isBlocked: 0,
        notes: input.notes ?? null,
        metadataJson: input.metadataJson ?? null,
        createdAt: now,
        updatedAt: now,
      },
    })
    return this.toRow(row)
  }

  async updateContact(id: string, updates: Record<string, unknown>): Promise<ContactRow> {
    const now = Date.now()
    const allowed = [
      'displayName', 'username', 'avatarUrl', 'phoneNumber', 'email',
      'isOnline', 'statusText', 'lastSeenAt', 'relationship', 'isFavorite',
      'isBlocked', 'notes', 'metadataJson',
    ]
    const data: Record<string, unknown> = { updatedAt: now }
    for (const key of allowed) {
      if (key in updates) data[key] = updates[key]
    }
    const row = await this.db.loose.contact.update({ where: { id }, data })
    return this.toRow(row)
  }

  async deleteContact(id: string): Promise<void> {
    await this.db.loose.contact.delete({ where: { id } })
  }

  async mergeContacts(
    canonicalId: string,
    mergedId: string,
    method: string,
    confidence: number,
  ): Promise<ContactIdentityRow> {
    const row = await this.db.loose.contactIdentity.create({
      data: {
        id: newId(),
        canonicalContactId: canonicalId,
        mergedContactId: mergedId,
        mergeConfidence: confidence,
        mergeMethod: method,
        isConfirmed: 0,
        createdAt: Date.now(),
      },
    })
    return this.toIdentityRow(row)
  }

  async getMergedContacts(contactId: string): Promise<ContactIdentityRow[]> {
    const rows = await this.db.loose.contactIdentity.findMany({
      where: {
        OR: [
          { canonicalContactId: contactId },
          { mergedContactId: contactId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r: Record<string, unknown>) => this.toIdentityRow(r))
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private toRow(r: Record<string, unknown>): ContactRow {
    return {
      id: r.id,
      providerId: r.providerId,
      accountId: r.accountId,
      providerNativeId: r.providerNativeId,
      displayName: r.displayName,
      username: r.username,
      avatarUrl: r.avatarUrl,
      phoneNumber: r.phoneNumber,
      email: r.email,
      isOnline: r.isOnline,
      statusText: r.statusText,
      lastSeenAt: r.lastSeenAt,
      relationship: r.relationship,
      isFavorite: r.isFavorite,
      isBlocked: r.isBlocked,
      notes: r.notes,
      metadataJson: r.metadataJson,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  }

  private toIdentityRow(r: Record<string, unknown>): ContactIdentityRow {
    return {
      id: r.id,
      canonicalContactId: r.canonicalContactId,
      mergedContactId: r.mergedContactId,
      mergeConfidence: r.mergeConfidence,
      mergeMethod: r.mergeMethod,
      isConfirmed: r.isConfirmed,
      createdAt: r.createdAt,
    }
  }
}
