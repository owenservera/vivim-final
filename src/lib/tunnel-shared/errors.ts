/**
 * VIVIM Tunnel + P2P — Typed Error Hierarchy
 */

export class VivimError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
  ) {
    super(message)
    this.name = 'VivimError'
  }
}

// ─── Tunnel Errors ───────────────────────────────────────────────

export class TunnelError extends VivimError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, cause)
    this.name = 'TunnelError'
  }
}

export class TunnelConnectionError extends TunnelError {
  constructor(message: string, cause?: Error) {
    super(message, 'TUNNEL_CONNECTION_ERROR', cause)
  }
}

export class TunnelAuthError extends TunnelError {
  constructor(message: string, cause?: Error) {
    super(message, 'TUNNEL_AUTH_ERROR', cause)
  }
}

export class TunnelTimeoutError extends TunnelError {
  constructor(message: string, cause?: Error) {
    super(message, 'TUNNEL_TIMEOUT_ERROR', cause)
  }
}

export class TunnelProtocolError extends TunnelError {
  constructor(message: string, cause?: Error) {
    super(message, 'TUNNEL_PROTOCOL_ERROR', cause)
  }
}

export class TunnelSubdomainError extends TunnelError {
  constructor(message: string, cause?: Error) {
    super(message, 'TUNNEL_SUBDOMAIN_ERROR', cause)
  }
}

// ─── P2P Errors ──────────────────────────────────────────────────

export class P2PError extends VivimError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, cause)
    this.name = 'P2PError'
  }
}

export class P2PConnectionError extends P2PError {
  constructor(message: string, cause?: Error) {
    super(message, 'P2P_CONNECTION_ERROR', cause)
  }
}

export class P2PDiscoveryError extends P2PError {
  constructor(message: string, cause?: Error) {
    super(message, 'P2P_DISCOVERY_ERROR', cause)
  }
}

export class P2PFileTransferError extends P2PError {
  constructor(message: string, cause?: Error) {
    super(message, 'P2P_FILE_TRANSFER_ERROR', cause)
  }
}

export class P2PCRTDSyncError extends P2PError {
  constructor(message: string, cause?: Error) {
    super(message, 'P2P_CRDT_SYNC_ERROR', cause)
  }
}

// ─── Local Server Errors ─────────────────────────────────────────

export class LocalServerError extends VivimError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, cause)
    this.name = 'LocalServerError'
  }
}

export class LocalServerStartError extends LocalServerError {
  constructor(message: string, cause?: Error) {
    super(message, 'LOCAL_SERVER_START_ERROR', cause)
  }
}

export class LocalServerRequestError extends LocalServerError {
  constructor(message: string, cause?: Error) {
    super(message, 'LOCAL_SERVER_REQUEST_ERROR', cause)
  }
}

// ─── Orchestrator Errors ─────────────────────────────────────────

export class OrchestratorError extends VivimError {
  constructor(message: string, code: string, cause?: Error) {
    super(message, code, cause)
    this.name = 'OrchestratorError'
  }
}

export class ServiceCrashError extends OrchestratorError {
  public readonly serviceName: string
  public readonly attempt: number

  constructor(serviceName: string, attempt: number, cause?: Error) {
    super(`Service "${serviceName}" crashed (attempt ${attempt})`, 'SERVICE_CRASH_ERROR', cause)
    this.serviceName = serviceName
    this.attempt = attempt
    this.name = 'ServiceCrashError'
  }
}

export class ConfigError extends OrchestratorError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIG_ERROR', cause)
  }
}
