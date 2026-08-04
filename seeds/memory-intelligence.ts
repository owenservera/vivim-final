// seeds/memory-intelligence.ts
// Seed data for the Memory Intelligence subsystem.
//
// Populates the database with initial data for:
//   - 5 entities (React, TypeScript, PostgreSQL, Docker, Vitest)
//   - 3 topics (Frontend Development, Backend Architecture, Testing)
//   - 2 projects (Main Web App, API Service)
//   - 5 user preferences (theme, default_provider, etc.)
//
// Usage:
//   import { seedMemoryIntelligence } from './memory-intelligence.js'
//   await seedMemoryIntelligence(db)
//
// Or from the admin seed endpoint:
//   POST /api/admin/seed  →  triggers seedMemoryIntelligence(db)

import { newId } from '../src/ids.js'
import type { CapStoreDb } from '../src/storage/db.js'

// ── Seed data definitions ──────────────────────────────────────────────────

const SEED_ENTITIES = [
  {
    name: 'React',
    type: 'technology',
    description: 'A JavaScript library for building user interfaces with component-based architecture and virtual DOM',
    confidence: 0.95,
  },
  {
    name: 'TypeScript',
    type: 'technology',
    description: 'A typed superset of JavaScript that compiles to plain JavaScript, providing static type checking',
    confidence: 0.95,
  },
  {
    name: 'PostgreSQL',
    type: 'technology',
    description: 'An advanced open-source relational database system with support for JSON, full-text search, and extensions',
    confidence: 0.9,
  },
  {
    name: 'Docker',
    type: 'technology',
    description: 'A platform for containerizing applications, enabling consistent environments across development and production',
    confidence: 0.9,
  },
  {
    name: 'Vitest',
    type: 'technology',
    description: 'A blazing-fast Vite-native unit test framework with TypeScript support, ESM, and out-of-the-box coverage',
    confidence: 0.85,
  },
]

const SEED_TOPICS = [
  {
    name: 'Frontend Development',
    description: 'Building user interfaces, component architecture, state management, and client-side rendering',
    color: '#3B82F6', // blue
  },
  {
    name: 'Backend Architecture',
    description: 'Server-side design, database modeling, API design, authentication, and infrastructure',
    color: '#10B981', // green
  },
  {
    name: 'Testing',
    description: 'Unit testing, integration testing, end-to-end testing, test-driven development, and quality assurance',
    color: '#F59E0B', // amber
  },
]

const SEED_PROJECTS = [
  {
    name: 'Main Web App',
    description: 'The primary web application built with React and TypeScript, serving as the main user-facing product',
    status: 'active',
  },
  {
    name: 'API Service',
    description: 'The backend API service providing REST and WebSocket endpoints, powered by PostgreSQL and Docker',
    status: 'active',
  },
]

const SEED_PREFERENCES = [
  {
    userId: 'default',
    key: 'theme',
    value: 'dark',
    confidence: 0.9,
  },
  {
    userId: 'default',
    key: 'default_provider',
    value: 'openai',
    confidence: 0.8,
  },
  {
    userId: 'default',
    key: 'code_style',
    value: 'typescript-strict',
    confidence: 0.85,
  },
  {
    userId: 'default',
    key: 'test_framework',
    value: 'vitest',
    confidence: 0.9,
  },
  {
    userId: 'default',
    key: 'editor_preference',
    value: 'vscode',
    confidence: 0.7,
  },
]

// ── Seed function ──────────────────────────────────────────────────────────

export interface SeedResult {
  entities: { created: number; skipped: number }
  topics: { created: number; skipped: number }
  projects: { created: number; skipped: number }
  preferences: { created: number; skipped: number }
}

/**
 * Seeds the Memory Intelligence tables with initial data.
 * Uses upsert semantics — existing records are skipped rather than overwritten.
 */
export async function seedMemoryIntelligence(db: CapStoreDb): Promise<SeedResult> {
  const result: SeedResult = {
    entities: { created: 0, skipped: 0 },
    topics: { created: 0, skipped: 0 },
    projects: { created: 0, skipped: 0 },
    preferences: { created: 0, skipped: 0 },
  }

  const now = Date.now()

  // ── Seed entities ──────────────────────────────────────────────────────
  for (const entity of SEED_ENTITIES) {
    try {
      // Check if entity already exists (by unique name+type constraint)
      const existing = await db.prisma.entity.findFirst({
        where: { name: entity.name, type: entity.type },
      })
      if (existing) {
        result.entities.skipped++
        continue
      }

      await db.prisma.entity.create({
        data: {
          id: newId(),
          name: entity.name,
          type: entity.type,
          description: entity.description,
          confidence: entity.confidence,
          mentionCount: 0,
          firstSeenAt: now,
          lastSeenAt: now,
          createdAt: now,
          updatedAt: now,
        },
      })
      result.entities.created++
    } catch (err) {
      // Unique constraint violation — skip
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Unique constraint') || msg.includes('UNIQUE')) {
        result.entities.skipped++
      } else {
        throw err
      }
    }
  }

  // ── Seed topics ────────────────────────────────────────────────────────
  for (const topic of SEED_TOPICS) {
    try {
      const existing = await db.prisma.topic.findFirst({
        where: { name: topic.name },
      })
      if (existing) {
        result.topics.skipped++
        continue
      }

      await db.prisma.topic.create({
        data: {
          id: newId(),
          name: topic.name,
          description: topic.description,
          color: topic.color,
          conversationCount: 0,
          createdAt: now,
          updatedAt: now,
        },
      })
      result.topics.created++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Unique constraint') || msg.includes('UNIQUE')) {
        result.topics.skipped++
      } else {
        throw err
      }
    }
  }

  // ── Seed projects ──────────────────────────────────────────────────────
  for (const project of SEED_PROJECTS) {
    try {
      const existing = await db.prisma.project.findFirst({
        where: { name: project.name },
      })
      if (existing) {
        result.projects.skipped++
        continue
      }

      await db.prisma.project.create({
        data: {
          id: newId(),
          name: project.name,
          description: project.description,
          status: project.status,
          conversationCount: 0,
          createdAt: now,
          updatedAt: now,
        },
      })
      result.projects.created++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Unique constraint') || msg.includes('UNIQUE')) {
        result.projects.skipped++
      } else {
        throw err
      }
    }
  }

  // ── Seed user preferences ──────────────────────────────────────────────
  for (const pref of SEED_PREFERENCES) {
    try {
      // Use upsert to handle the unique (userId, key) constraint
      await db.prisma.userPreference.upsert({
        where: {
          userId_key: { userId: pref.userId, key: pref.key },
        },
        create: {
          id: newId(),
          userId: pref.userId,
          key: pref.key,
          value: pref.value,
          learnedAt: now,
          confidence: pref.confidence,
        },
        update: {
          // Don't update existing preferences — they may have been changed by the user
        },
      })
      result.preferences.created++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Unique constraint') || msg.includes('UNIQUE')) {
        result.preferences.skipped++
      } else {
        throw err
      }
    }
  }

  return result
}

// ── Standalone runner ──────────────────────────────────────────────────────
// Can be run directly: bun run seeds/memory-intelligence.ts

if (import.meta.main) {
  const { getDb, configurePrisma } = await import('../src/storage/db.js')
  const db = getDb()

  try {
    await configurePrisma(db)
    console.log('[seed] Seeding memory intelligence tables...')
    const result = await seedMemoryIntelligence(db)
    console.log('[seed] Results:', JSON.stringify(result, null, 2))
  } catch (err) {
    console.error('[seed] Error:', err)
    process.exit(1)
  } finally {
    await db.close()
  }
}
