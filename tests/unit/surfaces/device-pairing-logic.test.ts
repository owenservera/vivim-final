import { describe, expect, it } from 'bun:test'
import {
  type DevicePeer,
  selectPaired,
  selectPending,
} from '../../../web/sandbox/src/surfaces/device-pairing/api'

const peers: DevicePeer[] = [
  { id: '1', deviceId: 'a', name: 'A', status: 'paired', lastSyncAt: 100 },
  { id: '2', deviceId: 'b', name: 'B', status: 'pending', lastSyncAt: null },
  { id: '3', deviceId: 'c', name: 'C', status: 'paired', lastSyncAt: 200 },
  { id: '4', deviceId: 'd', name: 'D', status: 'revoked', lastSyncAt: 50 },
]

describe('device-pairing reducers (36.4)', () => {
  it('selectPaired keeps only paired, newest sync first', () => {
    const out = selectPaired(peers)
    expect(out.map((p) => p.deviceId)).toEqual(['c', 'a'])
  })
  it('selectPending keeps awaiting devices', () => {
    const out = selectPending(peers)
    expect(out.map((p) => p.deviceId)).toEqual(['b'])
  })
})
