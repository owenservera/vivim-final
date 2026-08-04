// src/engines/entity-container-engine.ts
// EntityContainerEngine — manages organizational containers (servers, workspaces, channels)

import { newId } from '../ids.js'
import type { CapabilityEventBus } from './capability-event-bus.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface Container {
  id: string
  providerId: string
  accountId: string
  parentContainerId?: string
  containerType: string
  providerNativeId: string
  name: string
  description?: string
  iconUrl?: string
  metadataJson: string
  sortOrder: number
  isCollapsed: number
  isMuted: number
  isSynced: number
  lastSyncedAt?: number
  syncCursorJson: string
  unreadCount: number
  mentionCount: number
  isArchived: number
  createdAt: number
  updatedAt: number
}

export interface ContainerInput {
  providerId: string
  accountId: string
  parentContainerId?: string
  containerType: string
  providerNativeId: string
  name: string
  description?: string
  iconUrl?: string
  metadataJson?: string
  sortOrder?: number
  isCollapsed?: number
  isMuted?: number
  isSynced?: number
  lastSyncedAt?: number
  syncCursorJson?: string
  unreadCount?: number
  mentionCount?: number
  isArchived?: number
}

export interface ContainerMembership {
  id: string
  containerId: string
  userRole: string
  joinedAt?: number
  lastActiveAt?: number
  isFavorite: number
  notificationPreference: string
  metadataJson: string
  createdAt: number
  updatedAt: number
}

export interface ContainerMembershipInput {
  containerId: string
  userRole?: string
  joinedAt?: number
  isFavorite?: number
  notificationPreference?: string
}

// ── Store Contract ──────────────────────────────────────────────────────

export interface EntityContainerStore {
  createContainer(input: ContainerInput): Promise<Container>
  getContainerById(id: string): Promise<Container | null>
  getContainersByType(type: string): Promise<Container[]>
  getContainersByProvider(providerId: string, accountId: string): Promise<Container[]>
  updateContainer(id: string, updates: Partial<ContainerInput>): Promise<Container>
  deleteContainer(id: string): Promise<void>
  addMembership(input: ContainerMembershipInput): Promise<ContainerMembership>
  getMemberships(containerId: string): Promise<ContainerMembership[]>
  removeMembership(containerId: string, userRole: string): Promise<void>
}

// ── Engine ──────────────────────────────────────────────────────────────

export class EntityContainerEngine {
  constructor(
    private store: EntityContainerStore,
    private eventBus?: CapabilityEventBus,
  ) {}

  async createContainer(input: ContainerInput): Promise<Container> {
    const container = await this.store.createContainer(input)
    this.eventBus?.emit({ type: 'container:created', container } as never)
    return container
  }

  async getContainer(id: string): Promise<Container> {
    const container = await this.store.getContainerById(id)
    if (!container) throw new Error(`Container not found: ${id}`)
    return container
  }

  async listContainers(type?: string, providerId?: string, accountId?: string): Promise<Container[]> {
    if (type) return this.store.getContainersByType(type)
    if (providerId && accountId) return this.store.getContainersByProvider(providerId, accountId)
    return []
  }

  async updateContainer(id: string, updates: Partial<ContainerInput>): Promise<Container> {
    const container = await this.store.updateContainer(id, updates)
    this.eventBus?.emit({ type: 'container:updated', container } as never)
    return container
  }

  async deleteContainer(id: string): Promise<void> {
    await this.store.deleteContainer(id)
    this.eventBus?.emit({ type: 'container:deleted', containerId: id } as never)
  }

  async addMember(input: ContainerMembershipInput): Promise<ContainerMembership> {
    return this.store.addMembership(input)
  }

  async getMembers(containerId: string): Promise<ContainerMembership[]> {
    return this.store.getMemberships(containerId)
  }

  async removeMember(containerId: string, userRole: string): Promise<void> {
    await this.store.removeMembership(containerId, userRole)
  }
}
