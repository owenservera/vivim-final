// seeds/harness/stealth.module.ts
// Anti-detection stealth harness module — injects stealth scripts via CDP

import type {
  HarnessContext,
  HarnessModule,
  HarnessModuleResult,
} from '../../src/engines/harness-runtime.js'

const STEALTH_SCRIPTS = [
  // Mask webdriver
  `
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    delete navigator.__proto__.webdriver
  `,
  // Spoof plugins
  `
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' },
      ],
    })
  `,
  // Spoof languages
  `
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
  `,
  // Mask chrome automation
  `
    window.chrome = { runtime: {} }
    if (window.chrome && window.chrome.runtime) {
      window.chrome.runtime.connect = () => {}
    }
  `,
  // Canvas fingerprint randomization
  `
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL
    HTMLCanvasElement.prototype.toDataURL = function(type) {
      if (type === 'image/png' || type === undefined) {
        const ctx = this.getContext('2d')
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, this.width, this.height)
          for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] += Math.floor(Math.random() * 2)
          }
          ctx.putImageData(imageData, 0, 0)
        }
      }
      return origToDataURL.apply(this, arguments as unknown as Parameters<typeof origToDataURL>)
    }
  `,
  // WebRTC prevention
  `
    const origRTCPeerConnection = window.RTCPeerConnection
    if (origRTCPeerConnection) {
      window.RTCPeerConnection = function(config) {
        if (config && config.iceServers) {
          config.iceServers = []
        }
        return new origRTCPeerConnection(config)
      } as typeof RTCPeerConnection
    }
  `,
  // Permissions API spoof
  `
    const origQuery = window.navigator.permissions?.query
    if (origQuery) {
      window.navigator.permissions.query = (params) => {
        if (params.name === 'notifications') {
          return Promise.resolve({ state: 'denied', onchange: null } as PermissionStatus)
        }
        return origQuery.call(window.navigator.permissions, params)
      }
    }
  `,
]

const stealthModule: HarnessModule = {
  name: 'stealth',
  version: 1,
  inputSchema: {
    action: 'inject|add_human_delays|randomize_mouse',
    typingDelay: 'number',
    clickJitterMs: 'number',
  },
  outputSchema: { ok: 'boolean', action: 'string', injected: 'boolean' },
  preconditions: ['chrome_running'],
  postconditions: ['stealth_active'],

  async execute(input: Record<string, unknown>, ctx: HarnessContext): Promise<HarnessModuleResult> {
    const action = input.action as string
    const typingDelay = (input.typingDelay as number) || 50
    const clickJitterMs = (input.clickJitterMs as number) || 200

    try {
      switch (action) {
        case 'inject': {
          const combinedScript = STEALTH_SCRIPTS.join('\n')
          ctx.emitTelemetry({
            type: 'network_intercept',
            moduleId: 'stealth',
            data: { action: 'inject', scriptCount: STEALTH_SCRIPTS.length },
            ts: Date.now(),
          })
          return {
            ok: true,
            output: {
              action: 'inject',
              injected: true,
              scriptCount: STEALTH_SCRIPTS.length,
              script: combinedScript,
            },
          }
        }
        case 'add_human_delays': {
          const humanScript = `
            const origType = HTMLInputElement.prototype.type
            HTMLInputElement.prototype.type = function() {
              const result = origType.apply(this, arguments)
              return result
            }
            document.addEventListener('keydown', (e) => {
              const delay = ${typingDelay} + Math.random() * ${typingDelay}
              setTimeout(() => {}, delay)
            })
          `
          ctx.emitTelemetry({
            type: 'network_intercept',
            moduleId: 'stealth',
            data: { action: 'add_human_delays', typingDelay },
            ts: Date.now(),
          })
          return {
            ok: true,
            output: {
              action: 'add_human_delays',
              injected: true,
              script: humanScript,
            },
          }
        }
        case 'randomize_mouse': {
          const mouseScript = `
            document.addEventListener('mousemove', (e) => {
              e.stopPropagation()
            }, true)
            const origClick = HTMLElement.prototype.click
            HTMLElement.prototype.click = function() {
              const jitter = Math.random() * ${clickJitterMs}
              return new Promise((resolve) => {
                setTimeout(() => {
                  origClick.apply(this)
                  resolve(undefined)
                }, jitter)
              })
            }
          `
          ctx.emitTelemetry({
            type: 'network_intercept',
            moduleId: 'stealth',
            data: { action: 'randomize_mouse', clickJitterMs },
            ts: Date.now(),
          })
          return {
            ok: true,
            output: {
              action: 'randomize_mouse',
              injected: true,
              script: mouseScript,
            },
          }
        }
        default:
          return { ok: false, output: {}, error: `Unknown action: ${action}` }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      ctx.emitTelemetry({
        type: 'error',
        moduleId: 'stealth',
        data: { action, message },
        ts: Date.now(),
      })
      return { ok: false, output: {}, error: message }
    }
  },
}

export default stealthModule
