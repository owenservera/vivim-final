// src/engines/stealth/extension-bridge-engine.ts
// 11.4 — ExtensionBridgeEngine: bidirectional command bridge between a loaded
// Chrome extension (via content script) and the host. Inbound extension
// commands are routed to registered handlers; responses are posted back.

import { EngineError } from '../../errors.js'
import type { Logger } from '../../lib/logger.js'
import type { StealthProfileStore } from '../../storage/contracts/stealth-store.js'
import type { CapabilityEventBus } from '../capability-event-bus.js'
import type { StealthCdpProxy } from './stealth-module.js'

export interface ExtensionCommand {
  cmd: string
  client: string
  frameId?: number
  args: Record<string, unknown>
}

export interface ExtensionResponse {
  client: string
  success: boolean
  payload?: unknown
  error?: string
}

type CommandHandler = (
  args: Record<string, unknown>,
  meta: { client: string; frameId?: number },
) => Promise<unknown>

const BRIDGE_INJECT_KEY = '__vivimBridgeInstalled'
const MAGIC_INBOUND = 'VIVIM_BRIDGE_CMD:'
const _MAGIC_OUTBOUND = 'VIVIM_BRIDGE_RES:'

export class ExtensionBridgeEngine {
  private handlers = new Map<string, CommandHandler>()
  private cdpResolver: ((slaveId: string) => StealthCdpProxy | null) | null = null

  constructor(
    private readonly store: StealthProfileStore,
    private readonly eventBus?: CapabilityEventBus,
    private readonly logger?: Logger,
  ) {}

  setCdpResolver(resolver: (slaveId: string) => StealthCdpProxy | null): void {
    this.cdpResolver = resolver
  }

  registerHandler(cmd: string, handler: CommandHandler): void {
    this.handlers.set(cmd, handler)
  }

  unregisterHandler(cmd: string): void {
    this.handlers.delete(cmd)
  }

  listHandlers(): string[] {
    return [...this.handlers.keys()]
  }

  /** Process a command from the extension and return a response. */
  async handleCommand(command: ExtensionCommand): Promise<ExtensionResponse> {
    const handler = this.handlers.get(command.cmd)
    if (!handler) {
      return { client: command.client, success: false, error: `No handler for cmd: ${command.cmd}` }
    }
    try {
      const payload = await handler(command.args, {
        client: command.client,
        frameId: command.frameId,
      })
      this.eventBus?.emit({
        type: 'extension:command_handled',
        cmd: command.cmd,
        client: command.client,
      } as never)
      return { client: command.client, success: true, payload }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this.logger?.error(`Extension command failed: ${command.cmd}`, {
        client: command.client,
        error: errMsg,
      })
      return {
        client: command.client,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  /** Parse a console line emitted by the injected bridge script. */
  parseConsoleMessage(text: string): ExtensionCommand | null {
    if (!text.startsWith(MAGIC_INBOUND)) return null
    try {
      return JSON.parse(
        text.slice(MAGIC_INBOUND.length),
        null as ExtensionCommand,
      ) as ExtensionCommand
    } catch {
      return null
    }
  }

  /** Deliver a response back to the extension in this slave's page. */
  async sendResponse(slaveId: string, response: ExtensionResponse): Promise<void> {
    const cdp = this.resolveCdp(slaveId)
    const payload = JSON.stringify(response)
    const source = `function(out){window.postMessage({__vivim:'host-to-ext',...out},'*')}(${payload})`
    await cdp.send(slaveId, 'Runtime.evaluate', { expression: source })
  }

  /** Full inbound path: parse console text, handle, send response. */
  async receiveConsole(slaveId: string, text: string): Promise<ExtensionResponse | null> {
    const command = this.parseConsoleMessage(text)
    if (!command) return null
    const response = await this.handleCommand(command)
    await this.sendResponse(slaveId, response)
    return response
  }

  /** Inject the bridge listener into the page. */
  async applyBridge(slaveId: string): Promise<void> {
    const cdp = this.resolveCdp(slaveId)
    const source = `(function(){
      if(window[${JSON.stringify(BRIDGE_INJECT_KEY)}])return;
      window[${JSON.stringify(BRIDGE_INJECT_KEY)}]=true;
      window.addEventListener('message',function(e){
        if(e.data&&e.data.__vivim==='ext-to-host'){
          console.log(${JSON.stringify(MAGIC_INBOUND)}+JSON.stringify(e.data.cmd));
        }
      });
    })()`
    await cdp.send(slaveId, 'Page.addScriptToEvaluateOnNewDocument', { source })
  }

  private resolveCdp(slaveId: string): StealthCdpProxy {
    const cdp = this.cdpResolver?.(slaveId) ?? null
    if (!cdp) {
      throw new EngineError(`No CDP resolver wired for slave: ${slaveId}`)
    }
    return cdp
  }
}
