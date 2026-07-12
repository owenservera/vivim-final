// src/storage/store-factory.ts
// Unit 8.2 — Database abstraction: store factory with backend selection.

import type { CapStoreDb } from './db.js'

export type StoreBackend = 'sqlite' | 'postgres' | 'mysql'

export interface StoreFactoryOptions {
  backend: StoreBackend
  db: CapStoreDb
}

export class StoreFactory {
  private backend: StoreBackend

  constructor(private opts: StoreFactoryOptions) {
    this.backend = opts.backend
  }

  getBackend(): StoreBackend {
    return this.backend
  }

  getDb(): CapStoreDb {
    return this.opts.db
  }

  isPostgres(): boolean {
    return this.backend === 'postgres'
  }

  isSQLite(): boolean {
    return this.backend === 'sqlite'
  }
}
