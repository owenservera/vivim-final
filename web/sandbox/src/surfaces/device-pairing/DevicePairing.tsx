// web/sandbox/src/surfaces/device-pairing/DevicePairing.tsx
// Settings surface for linking + authorizing devices (Unit 36.4).

import { useCallback, useEffect, useState } from "react"
import {
  createDevicePairingApi,
  selectPaired,
  selectPending,
  type DevicePeer,
} from "./api"

export interface DevicePairingProps {
  baseUrl?: string
  deviceId: string
  deviceName: string
}

export function DevicePairing({ baseUrl = "", deviceId, deviceName }: DevicePairingProps) {
  const api = createDevicePairingApi(baseUrl)
  const [peers, setPeers] = useState<DevicePeer[]>([])
  const [code, setCode] = useState("")
  const [challenge, setChallenge] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setPeers(await api.list())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [api])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function startPairing() {
    setError(null)
    try {
      const c = await api.pair(deviceId, deviceName)
      setChallenge(c.pairingCode)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function confirm() {
    setError(null)
    try {
      await api.confirm(deviceId, code)
      setCode("")
      setChallenge(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function revoke(pid: string) {
    setError(null)
    try {
      await api.revoke(pid)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const paired = selectPaired(peers)
  const pending = selectPending(peers)

  return (
    <section aria-label="Device pairing">
      <h2>Device Pairing</h2>
      {error && <p role="alert">{error}</p>}

      <div>
        <button type="button" onClick={startPairing}>
          Generate pairing code
        </button>
        {challenge && (
          <p>
            Code: <strong>{challenge}</strong> — enter it on the other device.
          </p>
        )}
      </div>

      <div>
        <label>
          Enter code from other device:{" "}
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" />
        </label>
        <button type="button" onClick={confirm} disabled={!code}>
          Confirm
        </button>
      </div>

      {pending.length > 0 && (
        <div>
          <h3>Pending</h3>
          <ul>
            {pending.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3>Paired devices</h3>
        <ul>
          {paired.map((p) => (
            <li key={p.id}>
              {p.name}{" "}
              <button type="button" onClick={() => revoke(p.deviceId)}>
                Revoke
              </button>
            </li>
          ))}
          {paired.length === 0 && <li>No paired devices</li>}
        </ul>
      </div>
    </section>
  )
}
