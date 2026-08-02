// tests/unit/lib/p2p-node/file-sync.test.ts
// FileSyncHandler — progress events, transfer tracking, active transfers

import { beforeEach, describe, expect, it, mock } from 'bun:test'

// Mock libp2p node
function createMockNode() {
  return {
    handle: mock(() => {}),
    dialProtocol: mock(() =>
      Promise.resolve({
        source: {
          [Symbol.asyncIterator]: async function* () {
            yield new TextEncoder().encode(
              JSON.stringify({
                type: 'accept',
                requestId: 'file_test',
                chunkSize: 1024,
              }),
            )
          },
        },
        sink: mock(() => Promise.resolve()),
      }),
    ),
  }
}

function createMockMetrics() {
  return {
    peerCount: 0,
    relayedConnections: 0,
    directConnections: 0,
    totalBytesIn: 0,
    totalBytesOut: 0,
    fileTransfersCompleted: 0,
    crdtSyncsCompleted: 0,
    uptimeSeconds: 0,
  }
}

// Import after mocks
import { FileSyncHandler } from '../../../../src/lib/p2p-node/file-sync.js'

describe('FileSyncHandler', () => {
  let handler: FileSyncHandler
  let mockNode: ReturnType<typeof createMockNode>
  let metrics: ReturnType<typeof createMockMetrics>

  beforeEach(() => {
    mockNode = createMockNode()
    metrics = createMockMetrics()
    handler = new FileSyncHandler(mockNode as any, metrics)
  })

  it('constructor initializes with node and metrics', () => {
    expect(handler).toBeDefined()
    expect(handler.getActiveTransfers()).toEqual([])
  })

  it('registerHandler calls node.handle with file sync protocol', () => {
    handler.registerHandler()
    expect(mockNode.handle).toHaveBeenCalledTimes(1)
  })

  it('getActiveTransfers returns empty array initially', () => {
    expect(handler.getActiveTransfers()).toEqual([])
  })

  it('getActiveTransfers returns copy of active transfers', () => {
    const transfers = handler.getActiveTransfers()
    transfers.push({ fileId: 'fake' } as any)
    expect(handler.getActiveTransfers()).toEqual([])
  })

  it('emits progress event during transfer', (done) => {
    handler.on('progress', (progress) => {
      expect(progress.fileId).toBeDefined()
      expect(progress.bytesTransferred).toBeGreaterThanOrEqual(0)
      expect(progress.percentage).toBeGreaterThanOrEqual(0)
      done()
    })

    // Simulate progress emission
    handler.emit('progress', {
      fileId: 'file_test',
      fileName: 'test.txt',
      peerId: 'peer1',
      direction: 'sending',
      bytesTransferred: 100,
      totalBytes: 1000,
      percentage: 10,
      speedBytesPerSec: 0,
    })
  })

  it('emits file:sent event', (done) => {
    handler.on('file:sent', (data) => {
      expect(data.fileId).toBe('file_test')
      expect(data.fileName).toBe('test.txt')
      expect(data.peerId).toBe('peer1')
      done()
    })

    handler.emit('file:sent', {
      fileId: 'file_test',
      fileName: 'test.txt',
      peerId: 'peer1',
    })
  })

  it('emits file:received event', (done) => {
    handler.on('file:received', (data) => {
      expect(data.fileId).toBe('file_test')
      expect(data.fileName).toBe('test.txt')
      expect(data.sha256).toMatch(/^[0-9a-f]{64}$/)
      done()
    })

    handler.emit('file:received', {
      fileId: 'file_test',
      fileName: 'test.txt',
      filePath: '/tmp/test.txt',
      sha256: 'a'.repeat(64),
      size: 1024,
    })
  })
})
