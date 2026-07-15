// web/ui/src/sdk/hooks.ts
// Typed hooks over the workspace SDK (Unit 37.1). Thin wrappers — all fetch
// logic lives in CapStoreClient / the react-sdk adapter.

import { useCallback, useEffect, useState } from "react"
import { useCapStore } from "./CapStoreProvider"

export interface AsyncState<T> {
  data: T
  loading: boolean
  error: Error | null
  reload: () => void
}

export function useCapabilities(surface?: string): AsyncState<unknown[]> {
  const sdk = useCapStore()
  const [data, setData] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const reload = useCallback(() => {
    setLoading(true)
    sdk
      .capabilities(surface)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [sdk, surface])
  useEffect(() => {
    reload()
  }, [reload])
  return { data, loading, error, reload }
}

export function useConversation(id: string): AsyncState<unknown | null> {
  const sdk = useCapStore()
  const [data, setData] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const reload = useCallback(() => {
    if (!id) return
    setLoading(true)
    sdk
      .conversation(id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [sdk, id])
  useEffect(() => {
    reload()
  }, [reload])
  return { data, loading, error, reload }
}

export function useProvider(id: string): AsyncState<unknown | null> {
  const sdk = useCapStore()
  const [data, setData] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const reload = useCallback(() => {
    if (!id) return
    setLoading(true)
    sdk
      .provider(id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [sdk, id])
  useEffect(() => {
    reload()
  }, [reload])
  return { data, loading, error, reload }
}

export function useInterpret() {
  const sdk = useCapStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const run = useCallback(
    async (text: string): Promise<unknown> => {
      setLoading(true)
      setError(null)
      try {
        return await sdk.interpret(text)
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        setError(err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [sdk],
  )
  return { run, loading, error }
}
