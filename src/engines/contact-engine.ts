import { NotFoundError } from '../errors.js'
import type { CapabilityEventBus } from './capability-event-bus.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface Contact {
  id: string
  providerId: string
  accountId: string
  providerNativeId: string
  displayName: string
  username?: string
  avatarUrl?: string
  phoneNumber?: string
  email?: string
  isOnline: number
  statusText?: string
  lastSeenAt?: number
  relationship: string
  isFavorite: number
  isBlocked: number
  notes?: string
  metadataJson: string
  createdAt: number
  updatedAt: number
}

export interface ContactInput {
  providerId: string
  accountId: string
  providerNativeId: string
  displayName: string
  username?: string
  avatarUrl?: string
  phoneNumber?: string
  email?: string
  isOnline?: number
  statusText?: string
  lastSeenAt?: number
  relationship?: string
  isFavorite?: number
  isBlocked?: number
  notes?: string
  metadataJson?: string
}

export interface ContactIdentity {
  id: string
  canonicalContactId: string
  mergedContactId: string
  mergeConfidence: number
  mergeMethod: string
  isConfirmed: number
  createdAt: number
}

// ── Store Contract ──────────────────────────────────────────────────────

export interface ContactStore {
  createContact(input: ContactInput): Promise<Contact>
  getContactById(id: string): Promise<Contact | null>
  getContactByNativeId(
    providerId: string,
    accountId: string,
    providerNativeId: string,
  ): Promise<Contact | null>
  getContactsByAccount(accountId: string): Promise<Contact[]>
  searchContacts(query: string, accountId?: string): Promise<Contact[]>
  updateContact(id: string, updates: Partial<ContactInput>): Promise<Contact>
  deleteContact(id: string): Promise<void>
  mergeContacts(
    canonicalId: string,
    mergedId: string,
    method: string,
    confidence: number,
  ): Promise<ContactIdentity>
  getMergedContacts(contactId: string): Promise<ContactIdentity[]>
}

// ── Engine ──────────────────────────────────────────────────────────────

export class ContactEngine {
  constructor(
    private store: ContactStore,
    private eventBus?: CapabilityEventBus,
  ) {}

  async createContact(input: ContactInput): Promise<Contact> {
    const contact = await this.store.createContact(input)
    this.eventBus?.emit({ type: 'contact:created', contact } as never)
    return contact
  }

  async getContact(id: string): Promise<Contact> {
    const contact = await this.store.getContactById(id)
    if (!contact) throw new NotFoundError(`Contact not found: ${id}`)
    return contact
  }

  async getByNativeId(
    providerId: string,
    accountId: string,
    providerNativeId: string,
  ): Promise<Contact | null> {
    return this.store.getContactByNativeId(providerId, accountId, providerNativeId)
  }

  async listContacts(accountId: string): Promise<Contact[]> {
    return this.store.getContactsByAccount(accountId)
  }

  async searchContacts(query: string, accountId?: string): Promise<Contact[]> {
    return this.store.searchContacts(query, accountId)
  }

  async updateContact(id: string, updates: Partial<ContactInput>): Promise<Contact> {
    const contact = await this.store.updateContact(id, updates)
    this.eventBus?.emit({ type: 'contact:updated', contact } as never)
    return contact
  }

  async deleteContact(id: string): Promise<void> {
    await this.store.deleteContact(id)
    this.eventBus?.emit({ type: 'contact:deleted', contactId: id } as never)
  }

  async mergeContacts(
    canonicalId: string,
    mergedId: string,
    method: string,
    confidence: number,
  ): Promise<ContactIdentity> {
    return this.store.mergeContacts(canonicalId, mergedId, method, confidence)
  }

  async getMergedContacts(contactId: string): Promise<ContactIdentity[]> {
    return this.store.getMergedContacts(contactId)
  }
}
