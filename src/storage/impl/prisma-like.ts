// src/storage/impl/prisma-like.ts
// Minimal structural type for the Prisma client surface used by the *-impl stores.
// Using a structural type (instead of importing `PrismaClient`) keeps the impl
// files decoupled from the generated Prisma client and avoids `any` leaks while
// still satisfying strict mode.

export interface PrismaClientLike {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>
  manifestChange: {
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>
  }
  telemetryCycleRun: {
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>
  }
  providerCapability: {
    upsert(args: {
      where: Record<string, unknown>
      create: Record<string, unknown>
      update: Record<string, unknown>
    }): Promise<Record<string, unknown>>
  }
  [model: string]: unknown
}
