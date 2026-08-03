/**
 * storage/provider/index.ts — barrel for storage provider.
 * Process-singleton accessor for the storage layer.
 *
 * Impl is selected by VIVIM_STORAGE_PROVIDER env var:
 *  - 'memory' (default) — in-memory stores, lost on restart
 *  - 'prisma'            — Prisma-backed stores (see PrismaStorageProvider)
 *  - 'test'              — reserved for a future deterministic-seed provider
 */
export * from './storage-provider';
export { MemoryStorageProvider } from './memory-storage-provider';
export { PrismaStorageProvider } from './prisma-storage-provider';

import { MemoryStorageProvider } from './memory-storage-provider';
import { PrismaStorageProvider } from './prisma-storage-provider';
import type { StorageProvider } from './storage-provider';

let _provider: StorageProvider | null = null;

/**
 * Process-singleton accessor for the storage layer.
 * Impl is selected by VIVIM_STORAGE_PROVIDER env var.
 * Calling this multiple times returns the same instance.
 */
export function getStorageProvider(): StorageProvider {
  if (_provider) return _provider;

  const name = (process.env.VIVIM_STORAGE_PROVIDER ?? 'memory').toLowerCase();

  switch (name) {
    case 'memory':
      _provider = new MemoryStorageProvider();
      break;
    case 'prisma':
      _provider = new PrismaStorageProvider();
      break;
    case 'test':
      throw new Error(
        'VIVIM_STORAGE_PROVIDER=test is reserved for a future deterministic-seed provider. ' +
        'Use "memory" for now.'
      );
    default:
      throw new Error(
        `Unknown VIVIM_STORAGE_PROVIDER: "${name}". Valid values: memory, prisma, test.`
      );
  }

  return _provider as StorageProvider;
}

/** Test-only: reset the singleton. Used by unit tests to get a fresh provider. */
export function __resetStorageProviderForTests(): void {
  _provider = null;
}
