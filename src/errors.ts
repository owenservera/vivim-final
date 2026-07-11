// src/errors.ts
// Typed error hierarchy for the entire system.

export class CapStoreError extends Error {
  public readonly code: string
  public readonly details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'CapStoreError'
    this.code = code
    this.details = details
  }

  toJSON() {
    return { error: this.message, code: this.code, details: this.details }
  }
}

export class ValidationError extends CapStoreError {
  constructor(message: string, details?: unknown) {
    super('ValidationError', message, details)
  }
}

export class NotFoundError extends CapStoreError {
  constructor(message: string) {
    super('NotFoundError', message)
  }
}

export class ConflictError extends CapStoreError {
  constructor(message: string) {
    super('ConflictError', message)
  }
}

export class AuthRequired extends CapStoreError {
  constructor(message: string) {
    super('AuthRequired', message)
  }
}

// Governor-specific errors
export class SlaveNotRunningError extends CapStoreError {
  constructor(slaveId: string) {
    super('SlaveNotRunningError', `Slave ${slaveId} is not running`)
  }
}

export class SlaveBusyError extends CapStoreError {
  constructor(slaveId: string) {
    super('SlaveBusyError', `Slave ${slaveId} is busy`)
  }
}

export class CdpTimeoutError extends CapStoreError {
  constructor(method: string) {
    super('CdpTimeoutError', `CDP command ${method} timed out`)
  }
}

export class CircuitOpenError extends CapStoreError {
  constructor(slaveId: string) {
    super('CircuitOpenError', `Circuit breaker open for slave ${slaveId}`)
  }
}

export class CdpConnectionError extends CapStoreError {
  constructor(message: string) {
    super('CdpConnectionError', message)
  }
}

export class ChromeNotFoundError extends CapStoreError {
  constructor() {
    super('ChromeNotFoundError', 'Chrome binary not found')
  }
}

export class PortOccupiedError extends CapStoreError {
  constructor(range: string) {
    super('PortOccupiedError', `All ports in range ${range} occupied`)
  }
}

export class EngineError extends CapStoreError {
  constructor(message: string) {
    super('EngineError', message)
  }
}
