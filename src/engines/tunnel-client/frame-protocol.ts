/**
 * VIVIM Tunnel Client — Frame Protocol
 *
 * Encode and decode tunnel protocol frames (JSON-over-WebSocket).
 * All frames follow the TunnelFrame structure defined in shared/types.
 */

import { ulid } from 'ulid'
import { PROTOCOL_VERSION } from '../../lib/tunnel-shared/constants.js'
import { TunnelProtocolError } from '../../lib/tunnel-shared/errors.js'
import { getLogger } from '../../lib/tunnel-shared/logger.js'
import type {
  AssignedFrame,
  ErrorFrame,
  HttpAbortFrame,
  HttpChunkFrame,
  HttpRequestFrame,
  HttpResponseFrame,
  PingFrame,
  PongFrame,
  StatusFrame,
  TunnelFrame,
} from '../../lib/tunnel-shared/types.js'

const log = getLogger('frame-protocol')

// ─── Frame Creation ──────────────────────────────────────────────

export function createHttpResponseFrame(
  requestId: string,
  status: number,
  headers: Record<string, string>,
  body: string | null,
  bodySize: number,
  chunked: boolean,
  duration: number,
): HttpResponseFrame {
  return {
    id: ulid(),
    type: 'http.response',
    timestamp: Date.now(),
    version: PROTOCOL_VERSION,
    requestId,
    status,
    headers,
    body,
    bodySize,
    chunked,
    duration,
  }
}

export function createHttpChunkFrame(
  requestId: string,
  chunkIndex: number,
  data: string,
  lastChunk: boolean,
): HttpChunkFrame {
  return {
    id: ulid(),
    type: 'http.chunk',
    timestamp: Date.now(),
    version: PROTOCOL_VERSION,
    requestId,
    chunkIndex,
    data,
    lastChunk,
  }
}

export function createHttpAbortFrame(
  requestId: string,
  reason: string,
  code: string,
): HttpAbortFrame {
  return {
    id: ulid(),
    type: 'http.abort',
    timestamp: Date.now(),
    version: PROTOCOL_VERSION,
    requestId,
    reason,
    code,
  }
}

export function createPingFrame(latencyHint?: number): PingFrame {
  return {
    id: ulid(),
    type: 'ping',
    timestamp: Date.now(),
    version: PROTOCOL_VERSION,
    latencyHint,
  }
}

export function createStatusFrame(
  localServer: { running: boolean; port: number; requestCount: number },
  p2pNode: { running: boolean; peerCount: number; relayed: boolean },
  system: { cpu: number; memory: number; uptime: number },
): StatusFrame {
  return {
    id: ulid(),
    type: 'status',
    timestamp: Date.now(),
    version: PROTOCOL_VERSION,
    localServer,
    p2pNode,
    system,
  }
}

// ─── Frame Encoding ──────────────────────────────────────────────

export function encodeFrame(frame: TunnelFrame): string {
  try {
    return JSON.stringify(frame)
  } catch (err) {
    throw new TunnelProtocolError(
      `Failed to encode frame: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err : undefined,
    )
  }
}

// ─── Frame Decoding ──────────────────────────────────────────────

type InboundFrame = HttpRequestFrame | PongFrame | AssignedFrame | ErrorFrame

export function decodeFrame(raw: string): InboundFrame {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>
  } catch (err) {
    throw new TunnelProtocolError(
      `Invalid JSON frame: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err : undefined,
    )
  }

  // Validate required fields
  if (!parsed.id || !parsed.type || !parsed.timestamp || !parsed.version) {
    throw new TunnelProtocolError(`Missing required fields in frame: ${raw.substring(0, 200)}`)
  }

  // Validate version
  if (parsed.version !== PROTOCOL_VERSION) {
    log.warn(
      { frameVersion: parsed.version, expectedVersion: PROTOCOL_VERSION },
      'Frame version mismatch',
    )
  }

  const type = parsed.type as string

  switch (type) {
    case 'http.request':
      return validateHttpRequestFrame(parsed)
    case 'pong':
      return validatePongFrame(parsed)
    case 'assigned':
      return validateAssignedFrame(parsed)
    case 'error':
      return validateErrorFrame(parsed)
    default:
      log.warn({ type }, 'Unknown frame type received, ignoring')
      return parsed as unknown as InboundFrame
  }
}

function validateHttpRequestFrame(parsed: Record<string, unknown>): HttpRequestFrame {
  const required = ['id', 'type', 'timestamp', 'version', 'method', 'path']
  for (const field of required) {
    if (parsed[field] === undefined) {
      throw new TunnelProtocolError(`Missing field "${field}" in http.request frame`)
    }
  }
  return {
    id: parsed.id as string,
    type: 'http.request',
    timestamp: parsed.timestamp as number,
    version: parsed.version as string,
    method: parsed.method as string,
    path: parsed.path as string,
    query: (parsed.query as Record<string, string>) ?? {},
    headers: (parsed.headers as Record<string, string>) ?? {},
    body: (parsed.body as string | null) ?? null,
    bodySize: (parsed.bodySize as number) ?? 0,
    remoteAddress: (parsed.remoteAddress as string) ?? '',
    protocol: (parsed.protocol as string) ?? 'https',
    host: (parsed.host as string) ?? '',
  }
}

function validatePongFrame(parsed: Record<string, unknown>): PongFrame {
  return {
    id: parsed.id as string,
    type: 'pong',
    timestamp: parsed.timestamp as number,
    version: parsed.version as string,
    serverTime: (parsed.serverTime as number) ?? Date.now(),
  }
}

function validateAssignedFrame(parsed: Record<string, unknown>): AssignedFrame {
  return {
    id: parsed.id as string,
    type: 'assigned',
    timestamp: parsed.timestamp as number,
    version: parsed.version as string,
    subdomain: parsed.subdomain as string,
    protocolVersion: parsed.protocolVersion as string,
    relayUrl: parsed.relayUrl as string,
    serverTime: parsed.serverTime as number,
  }
}

function validateErrorFrame(parsed: Record<string, unknown>): ErrorFrame {
  return {
    id: parsed.id as string,
    type: 'error',
    timestamp: parsed.timestamp as number,
    version: parsed.version as string,
    code: (parsed.code as string) ?? 'UNKNOWN',
    message: (parsed.message as string) ?? 'Unknown error',
    fatal: (parsed.fatal as boolean) ?? false,
  }
}
