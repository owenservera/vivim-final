// sdk/src/react-sdk.ts
// Framework-agnostic workspace SDK adapter (Unit 37.1).
//
// Thin wrapper over CapStoreClient exposing the data surface the React hooks
// consume. Kept free of React so it is unit-testable without a renderer; the
// `web/ui/src/sdk/` bindings delegate to this.

import type { CapStoreClient } from './client.js'

export interface CapStoreSdk {
  capabilities(surface?: string): Promise<unknown[]>
  interpret(text: string): Promise<unknown>
  conversation(id: string): Promise<unknown>
  provider(id: string): Promise<unknown>
  client: CapStoreClient
}

export function createCapStoreSdk(client: CapStoreClient): CapStoreSdk {
  return {
    client,
    capabilities(surface?: string) {
      return client.capabilities(surface ? { surface } : undefined)
    },
    interpret(text: string) {
      return client.interpret(text)
    },
    conversation(id: string) {
      return client.getConversation(id)
    },
    provider(id: string) {
      return client.provider(id)
    },
  }
}
