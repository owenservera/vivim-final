import type { KernelStore } from '../../src/storage/contracts/kernel-store.js'

let idCounter = 0
function nextId(): string {
  return `mock-${++idCounter}`
}

export function createMockKernelStore(): KernelStore {
  return {
    batchInsertSpans: async () => {},
    querySpans: async () => [],
    queryRecentSpans: async () => [],
    querySpansByEngine: async () => [],
    insertProvenanceNode: async () => nextId(),
    queryProvenanceByTrace: async () => [],
    queryProvenanceByEngine: async () => [],
    queryProvenanceByKind: async () => [],
    saveTopology: async () => {},
    getLastTopology: async () => null,
    upsertEngine: async () => {},
    upsertStore: async () => {},
    upsertCapability: async () => {},
    getEngine: async () => null,
    listEngines: async () => [],
    insertEvent: async () => {},
    queryRecentEvents: async () => [],
  }
}
