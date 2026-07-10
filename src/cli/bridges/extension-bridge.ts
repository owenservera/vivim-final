// src/cli/bridges/extension-bridge.ts
// Native messaging bridge for Chrome extension

export class ExtensionBridge {
  private port: unknown

  connect(): void {
    // Native messaging connection — implementation depends on Chrome extension runtime
    // This is a stub for the CLI bridge contract
  }

  async send(message: unknown): Promise<unknown> {
    // Send message via native messaging port
    return { status: 'ok', data: message }
  }

  disconnect(): void {
    this.port = null
  }
}
