// web/ui/src/sdk/CapStoreProvider.tsx
// React context + provider for the vivim workspace SDK (Unit 37.1).

import { createContext, useContext, type ReactNode } from "react"
import { CapStoreClient } from "../../../../sdk/src/client.js"
import { createCapStoreSdk, type CapStoreSdk } from "../../../../sdk/src/react-sdk.js"

const CapStoreContext = createContext<CapStoreSdk | null>(null)

export function CapStoreProvider({
  client,
  children,
}: {
  client: CapStoreClient
  children: ReactNode
}) {
  return (
    <CapStoreContext.Provider value={createCapStoreSdk(client)}>
      {children}
    </CapStoreContext.Provider>
  )
}

export function useCapStore(): CapStoreSdk {
  const sdk = useContext(CapStoreContext)
  if (!sdk) throw new Error("useCapStore must be used within a <CapStoreProvider>")
  return sdk
}
