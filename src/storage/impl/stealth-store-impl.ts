// src/storage/impl/stealth-store-impl.ts
// 11.3 — StealthProfile store implementations.
// InMemoryStealthStore (default, no DB required) and PrismaStealthStore
// (DB-backed; requires the stealth_launch_profile / stealth_module_profile /
// stealth_policy tables from the Phase 11 Prisma migration).

import type {
  LaunchProfileRow,
  ModuleProfileRow,
  StealthPolicyRow,
  StealthProfileStore,
} from '../contracts/stealth-store.js'

export class InMemoryStealthStore implements StealthProfileStore {
  private launch = new Map<string, LaunchProfileRow>()
  private module = new Map<string, ModuleProfileRow>()
  private policy: StealthPolicyRow | null = null

  async getAllLaunchProfiles(): Promise<LaunchProfileRow[]> {
    return [...this.launch.values()]
  }
  async getLaunchProfile(id: string): Promise<LaunchProfileRow | null> {
    return this.launch.get(id) ?? null
  }
  async upsertLaunchProfile(id: string, data: Partial<LaunchProfileRow>): Promise<void> {
    const existing = this.launch.get(id)
    this.launch.set(id, {
      ...(existing ?? ({} as LaunchProfileRow)),
      id,
      ...data,
    } as LaunchProfileRow)
  }
  async deleteLaunchProfile(id: string): Promise<void> {
    this.launch.delete(id)
  }

  async getAllModuleProfiles(): Promise<ModuleProfileRow[]> {
    return [...this.module.values()]
  }
  async getModuleProfile(id: string): Promise<ModuleProfileRow | null> {
    return this.module.get(id) ?? null
  }
  async upsertModuleProfile(id: string, data: Partial<ModuleProfileRow>): Promise<void> {
    const existing = this.module.get(id)
    this.module.set(id, {
      ...(existing ?? ({} as ModuleProfileRow)),
      id,
      ...data,
    } as ModuleProfileRow)
  }
  async deleteModuleProfile(id: string): Promise<void> {
    this.module.delete(id)
  }

  async getPolicy(): Promise<StealthPolicyRow | null> {
    return this.policy
  }
  async upsertPolicy(data: Partial<StealthPolicyRow>): Promise<void> {
    this.policy = {
      ...(this.policy ?? {
        id: 'default',
        defaultLaunchProfileId: null,
        defaultModuleProfileId: null,
        providerOverridesJson: '{}',
      }),
      ...data,
    } as StealthPolicyRow
  }
}

// DB-backed implementation. Requires the Phase 11 Prisma tables to exist.
// The prisma client type is structurally accessed to avoid a hard import cycle.
interface StealthPrismaClient {
  stealthLaunchProfile: {
    findMany(): Promise<unknown[]>
    findUnique(args: { where: { id: string } }): Promise<unknown | null>
    upsert(args: {
      where: { id: string }
      create: Record<string, unknown>
      update: Record<string, unknown>
    }): Promise<unknown>
    delete(args: { where: { id: string } }): Promise<unknown>
  }
  stealthModuleProfile: {
    findMany(): Promise<unknown[]>
    findUnique(args: { where: { id: string } }): Promise<unknown | null>
    upsert(args: {
      where: { id: string }
      create: Record<string, unknown>
      update: Record<string, unknown>
    }): Promise<unknown>
    delete(args: { where: { id: string } }): Promise<unknown>
  }
  stealthPolicy: {
    findUnique(args: { where: { id: string } }): Promise<unknown | null>
    upsert(args: {
      where: { id: string }
      create: Record<string, unknown>
      update: Record<string, unknown>
    }): Promise<unknown>
  }
}

export class PrismaStealthStore implements StealthProfileStore {
  constructor(private readonly prisma: StealthPrismaClient) {}

  async getAllLaunchProfiles(): Promise<LaunchProfileRow[]> {
    const rows = (await this.prisma.stealthLaunchProfile.findMany()) as Array<
      Record<string, unknown>
    >
    return rows.map(mapLaunchRow)
  }
  async getLaunchProfile(id: string): Promise<LaunchProfileRow | null> {
    const row = (await this.prisma.stealthLaunchProfile.findUnique({ where: { id } })) as Record<
      string,
      unknown
    > | null
    return row ? mapLaunchRow(row) : null
  }
  async upsertLaunchProfile(id: string, data: Partial<LaunchProfileRow>): Promise<void> {
    const now = Date.now()
    await this.prisma.stealthLaunchProfile.upsert({
      where: { id },
      create: { id, ...data, createdAt: now, updatedAt: now } as Record<string, unknown>,
      update: { ...data, updatedAt: now },
    })
  }
  async deleteLaunchProfile(id: string): Promise<void> {
    await this.prisma.stealthLaunchProfile.delete({ where: { id } })
  }

  async getAllModuleProfiles(): Promise<ModuleProfileRow[]> {
    const rows = (await this.prisma.stealthModuleProfile.findMany()) as Array<
      Record<string, unknown>
    >
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      modulesJson: String(r.modulesJson),
      createdAt: (r.createdAt as number) ?? 0,
      updatedAt: (r.updatedAt as number) ?? 0,
    }))
  }
  async getModuleProfile(id: string): Promise<ModuleProfileRow | null> {
    const row = (await this.prisma.stealthModuleProfile.findUnique({ where: { id } })) as Record<
      string,
      unknown
    > | null
    return row
      ? {
          id: String(row.id),
          name: String(row.name),
          modulesJson: String(row.modulesJson),
          createdAt: (row.createdAt as number) ?? 0,
          updatedAt: (row.updatedAt as number) ?? 0,
        }
      : null
  }
  async upsertModuleProfile(id: string, data: Partial<ModuleProfileRow>): Promise<void> {
    const now = Date.now()
    await this.prisma.stealthModuleProfile.upsert({
      where: { id },
      create: { id, ...data, createdAt: now, updatedAt: now } as Record<string, unknown>,
      update: { ...data, updatedAt: now },
    })
  }
  async deleteModuleProfile(id: string): Promise<void> {
    await this.prisma.stealthModuleProfile.delete({ where: { id } })
  }

  async getPolicy(): Promise<StealthPolicyRow | null> {
    const row = (await this.prisma.stealthPolicy.findUnique({
      where: { id: 'default' },
    })) as Record<string, unknown> | null
    if (!row) return null
    return {
      id: String(row.id),
      defaultLaunchProfileId: (row.defaultLaunchProfileId as string | null) ?? null,
      defaultModuleProfileId: (row.defaultModuleProfileId as string | null) ?? null,
      providerOverridesJson: String(row.providerOverridesJson ?? '{}'),
    }
  }
  async upsertPolicy(data: Partial<StealthPolicyRow>): Promise<void> {
    const _existing = await this.getPolicy()
    await this.prisma.stealthPolicy.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        defaultLaunchProfileId: data.defaultLaunchProfileId ?? null,
        defaultModuleProfileId: data.defaultModuleProfileId ?? null,
        providerOverridesJson: data.providerOverridesJson ?? '{}',
      },
      update: {
        ...(data as Record<string, unknown>),
      },
    })
  }
}

function mapLaunchRow(row: Record<string, unknown>): LaunchProfileRow {
  return {
    id: String(row.id),
    mode: String(row.mode),
    chromeArgsJson: String(row.chromeArgsJson ?? '[]'),
    stealthProfileId: (row.stealthProfileId as string | null) ?? null,
    attachPort: (row.attachPort as number | null) ?? null,
    extensionId: (row.extensionId as string | null) ?? null,
    windowSizeJson: String(row.windowSizeJson ?? '{"width":1280,"height":720}'),
    extraArgsJson: String(row.extraArgsJson ?? '[]'),
    createdAt: (row.createdAt as number) ?? 0,
    updatedAt: (row.updatedAt as number) ?? 0,
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
