// src/storage/prisma.ts
// PrismaClient singleton for vivim-final.
// Provides typed access to all tables via Prisma ORM.

import { PrismaClient } from '@prisma/client'

// Singleton pattern — one PrismaClient instance for the entire app
let client: PrismaClient | null = null

export function getPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
  }
  return client
}

export async function closePrisma(): Promise<void> {
  if (client) {
    await client.$disconnect()
    client = null
  }
}

// Re-export Prisma types for convenience
export type { PrismaClient } from '@prisma/client'
