/**
 * VIVIM Tunnel Client — Types
 */

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
  TunnelConfig,
  TunnelFrame,
  TunnelMetrics,
} from '../../lib/tunnel-shared/types.js'

// Re-export shared types for convenience
export type {
  TunnelFrame,
  HttpRequestFrame,
  HttpResponseFrame,
  HttpChunkFrame,
  HttpAbortFrame,
  PingFrame,
  PongFrame,
  AssignedFrame,
  ErrorFrame,
  StatusFrame,
  TunnelConfig,
  TunnelMetrics,
}

export type TunnelConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface TunnelClientEvents {
  connected: (subdomain: string) => void
  disconnected: (reason: string, code: number) => void
  stateChanged: (state: TunnelConnectionState) => void
  requestReceived: (frame: HttpRequestFrame) => void
  responseSent: (frame: HttpResponseFrame) => void
  error: (error: Error) => void
}

export interface PendingRequest {
  id: string
  frame: HttpRequestFrame
  receivedAt: number
  timeout: ReturnType<typeof setTimeout>
}
