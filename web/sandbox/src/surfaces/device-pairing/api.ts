// web/sandbox/src/surfaces/device-pairing/api.ts
// Typed client + pure logic for the device-pairing UX surface (Unit 36.4).

export type DeviceStatus = 'pending' | 'paired' | 'revoked'

export interface DevicePeer {
  id: string
  deviceId: string
  name: string
  status: DeviceStatus
  lastSyncAt: number | null
}

export interface PairingChallenge {
  deviceId: string
  pairingCode: string
}

export interface DevicePairingApi {
  baseUrl: string
  pair(deviceId: string, name: string): Promise<PairingChallenge>
  confirm(deviceId: string, code: string): Promise<{ ok: boolean }>
  list(): Promise<DevicePeer[]>
  revoke(deviceId: string): Promise<{ ok: boolean }>
}

export function createDevicePairingApi(baseUrl = ""): DevicePairingApi {
  async function getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`)
    if (!res.ok) throw new Error(`pairing api ${path} failed: ${res.status}`)
    return (await res.json()) as T
  }
  return {
    baseUrl,
    pair(deviceId: string, name: string) {
      return getJson<PairingChallenge>(
        `/api/sync/pair?deviceId=${encodeURIComponent(deviceId)}&name=${encodeURIComponent(name)}`,
      )
    },
    async confirm(deviceId: string, code: string) {
      const res = await fetch(`${baseUrl}/api/sync/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId, code }),
      })
      if (!res.ok) throw new Error(`confirm failed: ${res.status}`)
      return (await res.json()) as { ok: boolean }
    },
    list() {
      return getJson<{ peers: DevicePeer[] }>(`/api/sync/peers`).then((r) => r.peers)
    },
    async revoke(deviceId: string) {
      const res = await fetch(`${baseUrl}/api/sync/revoke`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId }),
      })
      if (!res.ok) throw new Error(`revoke failed: ${res.status}`)
      return (await res.json()) as { ok: boolean }
    },
  }
}

// Pure reducer: keep only paired devices, newest sync first.
export function selectPaired(peers: DevicePeer[]): DevicePeer[] {
  return peers
    .filter((p) => p.status === "paired")
    .sort((a, b) => (b.lastSyncAt ?? 0) - (a.lastSyncAt ?? 0))
}

// Pure reducer: pending (awaiting code entry) devices.
export function selectPending(peers: DevicePeer[]): DevicePeer[] {
  return peers.filter((p) => p.status === "pending")
}
