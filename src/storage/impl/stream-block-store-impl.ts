// src/storage/impl/stream-block-store-impl.ts
// StreamBlockStoreImpl — Prisma-backed StreamBlockStore (04-merged-engines.md §9).
// The persistence logic already lives in the StreamBlockStore engine (unit 3.8);
// this impl re-exposes it under the storage/impl surface for injectable wiring.

import { StreamBlockStore } from '../../engines/stream-block-store.js'
import type { StreamBlockStoreContract } from '../contracts/stream-block-store.js'

export class StreamBlockStoreImpl extends StreamBlockStore implements StreamBlockStoreContract {}
