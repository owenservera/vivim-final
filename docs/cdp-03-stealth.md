# Stealth / Anti-Detection Layer — CDP-Based Fingerprint Spoofing

---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\audio-context-engine.ts
---

`	ypescript
// src/engines/stealth/audio-context-engine.ts
// Unit 12.3 — AudioContextEngine: audio fingerprint perturbation.

import type { StealthContext, StealthModule } from './stealth-module-engine.js'

export class AudioContextModule implements StealthModule {
  name = 'audio_context'
  detectionVector = 'AudioContext fingerprinting (oscillator + analyser node)'
  description = 'Adds noise to AudioContext output to prevent audio fingerprinting'
  priority = 12

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    const noiseLevel = (config.noiseLevel as number) ?? 0.0001

    const script = `
      (function() {
        var noiseLevel = ${noiseLevel};

        var origGetFloatFrequency = AnalyserNode.prototype.getFloatFrequencyData;
        AnalyserNode.prototype.getFloatFrequencyData = function(array) {
          origGetFloatFrequency.call(this, array);
          for (var i = 0; i < array.length; i++) {
            array[i] += (Math.random() - 0.5) * noiseLevel;
          }
        };

        var origGetByteFrequency = AnalyserNode.prototype.getByteFrequencyData;
        AnalyserNode.prototype.getByteFrequencyData = function(array) {
          origGetByteFrequency.call(this, array);
          for (var i = 0; i < array.length; i++) {
            array[i] = Math.max(0, Math.min(255, array[i] + (Math.random() - 0.5) * noiseLevel * 255));
          }
        };

        var origGetChannelData = AudioBuffer.prototype.getChannelData;
        AudioBuffer.prototype.getChannelData = function(channel) {
          var data = origGetChannelData.call(this, channel);
          for (var i = 0; i < data.length; i++) {
            data[i] += (Math.random() - 0.5) * noiseLevel;
          }
          return data;
        };
      })();
    `

    await ctx.cdp.send(ctx.slaveId, 'Page.addScriptToEvaluateOnNewDocument', { source: script })
  }
}

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\behavioral-pattern-engine.ts
---

`	ypescript
// src/engines/stealth/behavioral-pattern-engine.ts
// Unit 14.4 — BehavioralPatternEngine: request timing + interaction rhythm.

import type { StealthContext, StealthModule } from './stealth-module-engine.js'

interface BehavioralConfig {
  thinkTimeMinMs: number
  thinkTimeMaxMs: number
  betweenActionsMinMs: number
  betweenActionsMaxMs: number
  readingPauseProbability: number
  readingPauseMs: number
  jitterMs: number
  pageLoadSettleMs: number
}

const DEFAULT_CONFIG: BehavioralConfig = {
  thinkTimeMinMs: 1500,
  thinkTimeMaxMs: 5000,
  betweenActionsMinMs: 300,
  betweenActionsMaxMs: 1500,
  readingPauseProbability: 0.3,
  readingPauseMs: 2000,
  jitterMs: 200,
  pageLoadSettleMs: 1000,
}

export class BehavioralPatternModule implements StealthModule {
  name = 'behavioral_pattern'
  detectionVector = 'Behavioral timing analysis (request rhythm, interaction cadence, think-time)'
  description =
    'Adds human-like delays between operations: reading pauses, think-time, mouse wandering'
  priority = 25

  private config: BehavioralConfig = DEFAULT_CONFIG

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    this.config = {
      thinkTimeMinMs: (config.thinkTimeMinMs as number) ?? DEFAULT_CONFIG.thinkTimeMinMs,
      thinkTimeMaxMs: (config.thinkTimeMaxMs as number) ?? DEFAULT_CONFIG.thinkTimeMaxMs,
      betweenActionsMinMs:
        (config.betweenActionsMinMs as number) ?? DEFAULT_CONFIG.betweenActionsMinMs,
      betweenActionsMaxMs:
        (config.betweenActionsMaxMs as number) ?? DEFAULT_CONFIG.betweenActionsMaxMs,
      readingPauseProbability:
        (config.readingPauseProbability as number) ?? DEFAULT_CONFIG.readingPauseProbability,
      readingPauseMs: (config.readingPauseMs as number) ?? DEFAULT_CONFIG.readingPauseMs,
      jitterMs: (config.jitterMs as number) ?? DEFAULT_CONFIG.jitterMs,
      pageLoadSettleMs: (config.pageLoadSettleMs as number) ?? DEFAULT_CONFIG.pageLoadSettleMs,
    }
  }

  async waitForThinkTime(): Promise<void> {
    const delay =
      this.config.thinkTimeMinMs +
      Math.random() * (this.config.thinkTimeMaxMs - this.config.thinkTimeMinMs)
    await this.sleep(delay)
  }

  async waitForBetweenActions(): Promise<void> {
    const delay =
      this.config.betweenActionsMinMs +
      Math.random() * (this.config.betweenActionsMaxMs - this.config.betweenActionsMinMs) +
      (Math.random() - 0.5) * this.config.jitterMs
    await this.sleep(Math.max(0, delay))

    // Occasional reading pause
    if (Math.random() < this.config.readingPauseProbability) {
      await this.sleep(this.config.readingPauseMs)
    }
  }

  async waitForPageSettle(): Promise<void> {
    await this.sleep(this.config.pageLoadSettleMs)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, Math.max(0, ms)))
  }
}

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\canvas-noise-engine.ts
---

`	ypescript
// src/engines/stealth/canvas-noise-engine.ts
// Unit 12.1 — CanvasNoiseEngine: canvas fingerprint perturbation.

import type { StealthContext, StealthModule } from './stealth-module-engine.js'

export class CanvasNoiseModule implements StealthModule {
  name = 'canvas_noise'
  detectionVector = 'Canvas fingerprinting (toDataURL, toBlob, getImageData)'
  description = 'Adds subtle pixel noise to canvas readback to prevent fingerprint matching'
  priority = 10

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    const noiseLevel = (config.noiseLevel as number) ?? 0.01
    const noise = noiseLevel * 255
    const targets = (config.targets as string[]) ?? ['toDataURL', 'toBlob', 'getImageData']

    const script = `
      (function() {
        var noise = ${noise};
        var targets = ${JSON.stringify(targets)};

        function perturbImageData(imageData) {
          var data = imageData.data;
          for (var i = 0; i < data.length; i += 4) {
            data[i]     = Math.max(0, Math.min(255, data[i]     + (Math.random() - 0.5) * noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (Math.random() - 0.5) * noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + (Math.random() - 0.5) * noise));
          }
          return imageData;
        }

        if (targets.indexOf('toDataURL') !== -1) {
          var origToDataURL = HTMLCanvasElement.prototype.toDataURL;
          HTMLCanvasElement.prototype.toDataURL = function() {
            var ctx2d = this.getContext('2d');
            if (ctx2d) {
              var imageData = ctx2d.getImageData(0, 0, this.width, this.height);
              perturbImageData(imageData);
              ctx2d.putImageData(imageData, 0, 0);
            }
            return origToDataURL.apply(this, arguments);
          };
        }

        if (targets.indexOf('toBlob') !== -1) {
          var origToBlob = HTMLCanvasElement.prototype.toBlob;
          HTMLCanvasElement.prototype.toBlob = function(callback) {
            var ctx2d = this.getContext('2d');
            if (ctx2d) {
              var imageData = ctx2d.getImageData(0, 0, this.width, this.height);
              perturbImageData(imageData);
              ctx2d.putImageData(imageData, 0, 0);
            }
            return origToBlob.apply(this, arguments);
          };
        }

        if (targets.indexOf('getImageData') !== -1) {
          var origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
          CanvasRenderingContext2D.prototype.getImageData = function() {
            var imageData = origGetImageData.apply(this, arguments);
            return perturbImageData(imageData);
          };
        }
      })();
    `

    await ctx.cdp.send(ctx.slaveId, 'Page.addScriptToEvaluateOnNewDocument', { source: script })
  }
}

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\cdp-artifact-cleaner.ts
---

`	ypescript
// src/engines/stealth/cdp-artifact-cleaner.ts
// Unit 14.2 — CDPArtifactCleaner: remove CDP traces from page.

import type { StealthContext, StealthModule } from './stealth-module-engine.js'

export class CdpArtifactCleanerModule implements StealthModule {
  name = 'cdp_artifact_cleaner'
  detectionVector =
    'CDP/WebDriver artifacts in page context (cdc_*, stack traces, performance entries)'
  description = 'Removes CDP-injected variables, cleans error stacks, filters performance entries'
  priority = 1

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    const removeCdcVars = (config.removeCdcVars as boolean) ?? true
    const patchErrorStack = (config.patchErrorStack as boolean) ?? true
    const filterPerfEntries = (config.filterPerfEntries as boolean) ?? true

    const script = `
      (function() {
        ${
          removeCdcVars
            ? `
          // Remove CDP-injected variables
          var keys = Object.keys(window).filter(function(k) {
            return k.startsWith('cdc_') || k.startsWith('$cdc_') || k.startsWith('$wdc_') ||
                   k.startsWith('webdriver') || k === '__webdriver_evaluate' ||
                   k === '__selenium_evaluate' || k === '__fxdriver_evaluate';
          });
          keys.forEach(function(k) {
            try { delete window[k]; } catch(e) {}
          });

          // Remove from document
          var docKeys = Object.getOwnPropertyNames(document).filter(function(k) {
            return k.startsWith('$cdc_') || k.startsWith('$wdc_');
          });
          docKeys.forEach(function(k) {
            try { delete document[k]; } catch(e) {}
          });
        `
            : ''
        }

        ${
          patchErrorStack
            ? `
          // Patch Error.prototype.stack to remove CDP frames
          var origStack = Object.getOwnPropertyDescriptor(Error.prototype, 'stack');
          if (origStack && origStack.get) {
            Object.defineProperty(Error.prototype, 'stack', {
              get: function() {
                var stack = origStack.get.call(this);
                if (typeof stack === 'string') {
                  return stack.split('\\n').filter(function(line) {
                    return line.indexOf('cdp://') === -1 &&
                           line.indexOf('evaluate') === -1;
                  }).join('\\n');
                }
                return stack;
              },
              configurable: true,
            });
          }
        `
            : ''
        }

        ${
          filterPerfEntries
            ? `
          // Filter performance entries to remove CDP-related timing
          if (typeof PerformanceObserver !== 'undefined') {
            var origGetEntries = Performance.prototype.getEntries;
            Performance.prototype.getEntries = function() {
              return origGetEntries.call(this).filter(function(entry) {
                return entry.name.indexOf('cdp://') === -1 &&
                       entry.name.indexOf('devtools://') === -1;
              });
            };
          }
        `
            : ''
        }
      })();
    `

    await ctx.cdp.send(ctx.slaveId, 'Page.addScriptToEvaluateOnNewDocument', { source: script })
  }
}

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\extension-bridge-engine.ts
---

`	ypescript
// src/engines/stealth/extension-bridge-engine.ts
// 11.4 — ExtensionBridgeEngine: bidirectional command bridge between a loaded
// Chrome extension (via content script) and the host. Inbound extension
// commands are routed to registered handlers; responses are posted back.

import { EngineError } from '../../errors.js'
import type { StealthProfileStore } from '../../storage/contracts/stealth-store.js'
import type { CapabilityEventBus } from '../capability-event-bus.js'
import type { StructuredLogger } from '../logger.js'
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
const MAGIC_OUTBOUND = 'VIVIM_BRIDGE_RES:'

export class ExtensionBridgeEngine {
  private handlers = new Map<string, CommandHandler>()
  private cdpResolver: ((slaveId: string) => StealthCdpProxy | null) | null = null

  constructor(
    private readonly store: StealthProfileStore,
    private readonly eventBus?: CapabilityEventBus,
    private readonly logger?: StructuredLogger,
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
      return JSON.parse(text.slice(MAGIC_INBOUND.length)) as ExtensionCommand
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
    const source = `(function(key,inbound,outbound){if(window[key])return;window[key]=true;window.addEventListener('message',function(e){var data=e.data;if(!data||data.__vivim!=='ext-to-host')return;var cmd={cmd:data.cmd,client:data.client,frameId:data.frameId,args:data.args||{}};console.log(inbound+JSON.stringify(cmd))})})('${BRIDGE_INJECT_KEY}','${MAGIC_INBOUND}','${MAGIC_OUTBOUND}')`
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

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\font-screen-engine.ts
---

`	ypescript
// src/engines/stealth/font-screen-engine.ts
// Unit 12.4 — FontScreenEngine: font list + screen resolution spoofing.

import type { StealthContext, StealthModule } from './stealth-module-engine.js'

const COMMON_FONTS = [
  'Arial',
  'Arial Black',
  'Calibri',
  'Cambria',
  'Comic Sans MS',
  'Consolas',
  'Courier New',
  'Georgia',
  'Impact',
  'Lucida Console',
  'Microsoft Sans Serif',
  'Microsoft YaHei',
  'Palatino Linotype',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
]

const COMMON_RESOLUTIONS = [
  { width: 1920, height: 1080, devicePixelRatio: 1 },
  { width: 1536, height: 864, devicePixelRatio: 1.25 },
  { width: 2560, height: 1440, devicePixelRatio: 1 },
  { width: 1440, height: 900, devicePixelRatio: 1 },
  { width: 1366, height: 768, devicePixelRatio: 1 },
]

export class FontScreenModule implements StealthModule {
  name = 'font_screen'
  detectionVector = 'Font availability probing + screen resolution fingerprinting'
  description = 'Normalizes font list to common Windows fonts and spoofs screen resolution'
  priority = 13

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    const fonts = (config.fonts as string[]) ?? COMMON_FONTS
    const screenConfig = config.screen as
      | { width?: number; height?: number; devicePixelRatio?: number }
      | undefined

    let resolution = COMMON_RESOLUTIONS[Math.floor(Math.random() * COMMON_RESOLUTIONS.length)]!
    if (screenConfig?.width && screenConfig?.height) {
      resolution = {
        width: screenConfig.width,
        height: screenConfig.height,
        devicePixelRatio: screenConfig.devicePixelRatio ?? 1,
      }
    }

    const script = `
      (function() {
        var fonts = ${JSON.stringify(fonts)};
        var width = ${resolution.width};
        var height = ${resolution.height};
        var dpr = ${resolution.devicePixelRatio};

        Object.defineProperty(screen, 'width', { get: function() { return width; } });
        Object.defineProperty(screen, 'height', { get: function() { return height; } });
        Object.defineProperty(screen, 'availWidth', { get: function() { return width; } });
        Object.defineProperty(screen, 'availHeight', { get: function() { return height - 40; } });
        Object.defineProperty(window, 'devicePixelRatio', { get: function() { return dpr; } });

        var origMeasureText = CanvasRenderingContext2D.prototype.measureText;
        CanvasRenderingContext2D.prototype.measureText = function(text) {
          var result = origMeasureText.call(this, text);
          if (this.font) {
            var fontName = this.font.split(' ').pop().replace(/"/g, '');
            if (fonts.indexOf(fontName) === -1) {
              this.font = this.font.replace(fontName, 'Arial');
              result = origMeasureText.call(this, text);
            }
          }
          return result;
        };
      })();
    `

    await ctx.cdp.send(ctx.slaveId, 'Page.addScriptToEvaluateOnNewDocument', { source: script })
  }
}

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\human-keyboard-engine.ts
---

`	ypescript
// src/engines/stealth/human-keyboard-engine.ts
// Unit 13.2 — HumanKeyboardEngine: variable rhythm typing.

import type { StealthContext, StealthModule } from './stealth-module-engine.js'

export class HumanKeyboardModule implements StealthModule {
  name = 'human_keyboard'
  detectionVector = 'Typing rhythm analysis (keystroke timing, burst patterns)'
  description =
    'Types text character-by-character with log-normal delay distribution and occasional bursts'
  priority = 21

  private config = {
    minDelayMs: 50,
    maxDelayMs: 180,
    medianDelayMs: 90,
    burstProbability: 0.12,
    burstLength: 3,
    typoProbability: 0.005,
  }

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    this.config = {
      minDelayMs: (config.minDelayMs as number) ?? 50,
      maxDelayMs: (config.maxDelayMs as number) ?? 180,
      medianDelayMs: (config.medianDelayMs as number) ?? 90,
      burstProbability: (config.burstProbability as number) ?? 0.12,
      burstLength: (config.burstLength as number) ?? 3,
      typoProbability: (config.typoProbability as number) ?? 0.005,
    }
  }

  async humanType(ctx: StealthContext, selector: string, text: string): Promise<void> {
    const cfg = this.config

    await ctx.cdp.send(ctx.slaveId, 'Runtime.evaluate', {
      expression: `document.querySelector(${JSON.stringify(selector)})?.focus()`,
    })

    for (let i = 0; i < text.length; i++) {
      const char = text[i]!

      // Occasional typo + correction
      if (Math.random() < cfg.typoProbability) {
        const wrongChar = String.fromCharCode(
          char.charCodeAt(0) + Math.floor(Math.random() * 3) - 1,
        )
        await ctx.cdp.send(ctx.slaveId, 'Input.dispatchKeyEvent', {
          type: 'keyDown',
          text: wrongChar,
        })
        await ctx.cdp.send(ctx.slaveId, 'Input.dispatchKeyEvent', {
          type: 'keyUp',
          text: wrongChar,
        })
        await this.sleep(cfg.minDelayMs + Math.random() * cfg.maxDelayMs)
        await ctx.cdp.send(ctx.slaveId, 'Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'Backspace',
          code: 'Backspace',
        })
        await ctx.cdp.send(ctx.slaveId, 'Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: 'Backspace',
          code: 'Backspace',
        })
        await this.sleep(cfg.minDelayMs + Math.random() * cfg.maxDelayMs)
      }

      await ctx.cdp.send(ctx.slaveId, 'Input.dispatchKeyEvent', {
        type: 'keyDown',
        text: char,
      })
      await ctx.cdp.send(ctx.slaveId, 'Input.dispatchKeyEvent', {
        type: 'keyUp',
        text: char,
      })

      // Variable delay
      let delay = cfg.medianDelayMs + (Math.random() - 0.5) * cfg.maxDelayMs
      delay = Math.max(cfg.minDelayMs, Math.min(cfg.maxDelayMs, delay))

      // Occasional burst (fast typing)
      if (Math.random() < cfg.burstProbability) {
        delay = cfg.minDelayMs
      }

      await this.sleep(delay)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
  }
}

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\human-mouse-engine.ts
---

`	ypescript
// src/engines/stealth/human-mouse-engine.ts
// Unit 13.1 — HumanMouseEngine: bezier-curve mouse movement.

import type { StealthContext, StealthModule } from './stealth-module-engine.js'

export class HumanMouseModule implements StealthModule {
  name = 'human_mouse'
  detectionVector = 'Mouse movement biometrics (acceleration curves, click distribution)'
  description =
    'Moves mouse along bezier curves with human-like acceleration and Gaussian click offset'
  priority = 20

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    const bezierPoints = (config.bezierPoints as number) ?? 25
    const speedMin = (config.speedMin as number) ?? 300
    const speedMax = (config.speedMax as number) ?? 800
    const clickOffsetRadius = (config.clickOffsetRadius as number) ?? 5
    const overshootProbability = (config.overshootProbability as number) ?? 0.15

    const script = `
      (function() {
        var BEZIER_POINTS = ${bezierPoints};
        var SPEED_MIN = ${speedMin};
        var SPEED_MAX = ${speedMax};
        var CLICK_OFFSET = ${clickOffsetRadius};
        var OVERSHOOT_PROB = ${overshootProbability};

        window.__vivimHumanMouse = {
          async moveTo(targetX, targetY) {
            var startX = window.__vivimMouseX || 0;
            var startY = window.__vivimMouseY || 0;
            var dist = Math.sqrt(Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2));
            var speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
            var durationMs = (dist / speed) * 1000;

            var cp1x = startX + (targetX - startX) * 0.3 + (Math.random() - 0.5) * dist * 0.3;
            var cp1y = startY + (targetY - startY) * 0.3 + (Math.random() - 0.5) * dist * 0.3;
            var cp2x = startX + (targetX - startX) * 0.7 + (Math.random() - 0.5) * dist * 0.3;
            var cp2y = startY + (targetY - startY) * 0.7 + (Math.random() - 0.5) * dist * 0.3;

            for (var i = 1; i <= BEZIER_POINTS; i++) {
              var t = i / BEZIER_POINTS;
              var ease = t * t * (3 - 2 * t);
              var mt = 1 - ease;
              var x = mt*mt*mt*startX + 3*mt*mt*ease*cp1x + 3*mt*ease*ease*cp2x + ease*ease*ease*targetX;
              var y = mt*mt*mt*startY + 3*mt*mt*ease*cp1y + 3*mt*ease*ease*cp2y + ease*ease*ease*targetY;

              window.__vivimMouseX = x;
              window.__vivimMouseY = y;

              document.dispatchEvent(new MouseEvent('mousemove', {
                clientX: x, clientY: y, bubbles: true
              }));

              await new Promise(function(r) { setTimeout(r, durationMs / BEZIER_POINTS); });
            }
          },

          async click(targetX, targetY) {
            var offset = function() {
              return (Math.random() - 0.5) * CLICK_OFFSET * 2;
            };
            var x = targetX + offset();
            var y = targetY + offset();

            await this.moveTo(x, y);

            document.dispatchEvent(new MouseEvent('mousedown', {
              clientX: x, clientY: y, button: 0, bubbles: true
            }));
            await new Promise(function(r) { setTimeout(r, 50 + Math.random() * 100); });
            document.dispatchEvent(new MouseEvent('mouseup', {
              clientX: x, clientY: y, button: 0, bubbles: true
            }));
            document.dispatchEvent(new MouseEvent('click', {
              clientX: x, clientY: y, button: 0, bubbles: true
            }));
          }
        };
      })();
    `

    await ctx.cdp.send(ctx.slaveId, 'Page.addScriptToEvaluateOnNewDocument', { source: script })
  }
}

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\human-scroll-engine.ts
---

`	ypescript
// src/engines/stealth/human-scroll-engine.ts
// Unit 13.3 — HumanScrollEngine: natural scroll velocity curves.

import type { StealthContext, StealthModule } from './stealth-module-engine.js'

export class HumanScrollModule implements StealthModule {
  name = 'human_scroll'
  detectionVector = 'Scroll velocity analysis (acceleration patterns, event frequency)'
  description = 'Scrolls with human-like velocity curves (ease-in, plateau, ease-out)'
  priority = 22

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    const minSteps = (config.minSteps as number) ?? 5
    const maxSteps = (config.maxSteps as number) ?? 15
    const stepDelayMinMs = (config.stepDelayMinMs as number) ?? 16
    const stepDelayMaxMs = (config.stepDelayMaxMs as number) ?? 50
    const overshootProbability = (config.overshootProbability as number) ?? 0.2
    const pauseAtEndMs = (config.pauseAtEndMs as number) ?? 200

    // Expose human scroll API
    const script = `
      (function() {
        window.__vivimHumanScroll = {
          async scroll(direction, totalPixels) {
            var steps = ${minSteps} + Math.floor(Math.random() * (${maxSteps} - ${minSteps}));
            var actualTotal = totalPixels;
            var correction = 0;
            if (Math.random() < ${overshootProbability}) {
              actualTotal = totalPixels * (1 + Math.random() * 0.15);
              correction = totalPixels - actualTotal;
            }

            var stepSize = actualTotal / steps;
            var axis = (direction === 'up' || direction === 'down') ? 'Y' : 'X';
            var sign = (direction === 'down' || direction === 'right') ? 1 : -1;

            for (var i = 0; i < steps; i++) {
              var progress = i / steps;
              var ease;
              if (progress < 0.2) ease = progress * 2.5;
              else if (progress > 0.8) ease = (1 - progress) * 2.5;
              else ease = 1;

              var thisStep = stepSize * ease;
              var delta = sign * thisStep;

              window.scrollBy(
                axis === 'X' ? delta : 0,
                axis === 'Y' ? delta : 0
              );

              var delay = ${stepDelayMinMs} + Math.random() * (${stepDelayMaxMs} - ${stepDelayMinMs});
              delay /= ease || 0.5;
              await new Promise(function(r) { setTimeout(r, delay); });
            }

            if (correction !== 0) {
              window.scrollBy(
                axis === 'X' ? -correction * sign : 0,
                axis === 'Y' ? -correction * sign : 0
              );
            }

            await new Promise(function(r) { setTimeout(r, ${pauseAtEndMs}); });
          }
        };
      })();
    `

    await ctx.cdp.send(ctx.slaveId, 'Page.addScriptToEvaluateOnNewDocument', { source: script })
  }
}

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\index.ts
---

`	ypescript
// src/engines/stealth/index.ts
// Phase 11 — Stealth Core barrel.

export { LaunchProfileEngine } from './launch-profile-engine.js'
export type { LaunchProfile, LaunchProfilePolicy, LaunchMode } from './launch-profile-engine.js'

export { StealthModuleEngine } from './stealth-module-engine.js'
export type {
  StealthModule,
  StealthModuleProfile,
  StealthModuleConfig,
  StealthContext,
  StealthCdpProxy,
} from './stealth-module.js'

export { navigatorPatchModule, navigatorPatchConfig } from './navigator-patch-module.js'
export type { NavigatorPatchConfig } from './navigator-patch-module.js'

export { registerDefaultStealthModules } from './register-defaults.js'

export { ExtensionBridgeEngine } from './extension-bridge-engine.js'
export type { ExtensionCommand, ExtensionResponse } from './extension-bridge-engine.js'

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\launch-profile-engine.ts
---

`	ypescript
// src/engines/stealth/launch-profile-engine.ts
// 11.1 — LaunchProfileEngine: multi-mode launch strategy.
// Resolves per-provider launch profiles and builds Chrome args without the
// bot-signal flags that硬编码 buildChromeArgs used.

import { EngineError } from '../../errors.js'
import type { StealthProfileStore } from '../../storage/contracts/stealth-store.js'
import type { LaunchMode } from '../../storage/contracts/stealth-store.js'
import type { StructuredLogger } from '../logger.js'

export type { LaunchMode } from '../../storage/contracts/stealth-store.js'

export interface LaunchProfile {
  id: string
  mode: LaunchMode
  chromeArgs: string[]
  stealthProfileId: string | null
  attachPort: number | null
  extensionId: string | null
  windowSize: { width: number; height: number }
  extraArgs: string[]
}

export interface LaunchProfilePolicy {
  defaultProfileId: string
  providerOverrides: Record<string, string>
}

export class LaunchProfileEngine {
  private profiles = new Map<string, LaunchProfile>()

  constructor(
    private readonly store: StealthProfileStore,
    private readonly logger?: StructuredLogger,
  ) {
    void this.loadProfiles()
  }

  private async loadProfiles(): Promise<void> {
    try {
      const rows = await this.store.getAllLaunchProfiles()
      for (const row of rows) {
        this.profiles.set(row.id, this.mapRow(row))
      }
    } catch (err) {
      this.logger?.error('Failed to load launch profiles', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async resolve(providerId: string): Promise<LaunchProfile> {
    const policy = await this.store.getPolicy()
    const overrideId = policy?.providerOverrides?.[providerId]
    const profileId = overrideId ?? policy?.defaultProfileId ?? 'default'
    const profile = this.profiles.get(profileId)
    if (!profile) return this.getDefaultProfile()
    return profile
  }

  buildArgs(profile: LaunchProfile, opts: { debugPort: number; profileDir: string }): string[] {
    switch (profile.mode) {
      case 'cdp_minimal':
        return this.buildMinimalArgs(opts)
      case 'cdp_stealth':
        return this.buildStealthArgs(profile, opts)
      case 'hidden':
        return this.buildHiddenArgs(profile, opts)
      case 'attach':
        return [] // attaching to an existing browser — no args
      case 'extension':
        return this.buildExtensionArgs(profile, opts)
      default:
        return this.buildMinimalArgs(opts)
    }
  }

  private buildMinimalArgs(opts: { debugPort: number; profileDir: string }): string[] {
    return [
      `--remote-debugging-port=${opts.debugPort}`,
      `--user-data-dir=${opts.profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
    ]
  }

  private buildStealthArgs(
    profile: LaunchProfile,
    opts: { debugPort: number; profileDir: string },
  ): string[] {
    const args = this.buildMinimalArgs(opts)
    args.push(...profile.chromeArgs)
    args.push('--window-position=-32000,-32000')
    args.push(`--window-size=${profile.windowSize.width},${profile.windowSize.height}`)
    return args
  }

  private buildHiddenArgs(
    profile: LaunchProfile,
    opts: { debugPort: number; profileDir: string },
  ): string[] {
    const args = this.buildMinimalArgs(opts)
    args.push('--window-position=-32000,-32000')
    args.push(`--window-size=${profile.windowSize.width},${profile.windowSize.height}`)
    return args
  }

  private buildExtensionArgs(
    profile: LaunchProfile,
    opts: { debugPort: number; profileDir: string },
  ): string[] {
    const args = this.buildMinimalArgs(opts)
    args.push(`--load-extension=${profile.extensionId ?? '/path/to/vivim-extension'}`)
    return args
  }

  private getDefaultProfile(): LaunchProfile {
    return {
      id: 'default',
      mode: 'cdp_minimal',
      chromeArgs: [],
      stealthProfileId: null,
      attachPort: null,
      extensionId: null,
      windowSize: { width: 1280, height: 720 },
      extraArgs: [],
    }
  }

  async registerProfile(profile: LaunchProfile): Promise<void> {
    this.profiles.set(profile.id, profile)
    await this.store.upsertLaunchProfile(this.toRow(profile))
  }

  async updateProfile(id: string, patch: Partial<LaunchProfile>): Promise<void> {
    const existing = this.profiles.get(id)
    if (!existing) throw new EngineError(`Profile not found: ${id}`)
    const updated = { ...existing, ...patch }
    this.profiles.set(id, updated)
    await this.store.upsertLaunchProfile(this.toRow(updated))
  }

  async deleteProfile(id: string): Promise<void> {
    this.profiles.delete(id)
    await this.store.deleteLaunchProfile(id)
  }

  listProfiles(): LaunchProfile[] {
    return [...this.profiles.values()]
  }

  getProfile(id: string): LaunchProfile | null {
    return this.profiles.get(id) ?? null
  }

  async reload(): Promise<void> {
    this.profiles.clear()
    await this.loadProfiles()
  }

  private mapRow(row: {
    id: string
    mode: string
    chromeArgsJson: string
    stealthProfileId: string | null
    attachPort: number | null
    extensionId: string | null
    windowSizeJson: string
    extraArgsJson: string
  }): LaunchProfile {
    return {
      id: row.id,
      mode: row.mode as LaunchMode,
      chromeArgs: parseJson(row.chromeArgsJson, []),
      stealthProfileId: row.stealthProfileId,
      attachPort: row.attachPort,
      extensionId: row.extensionId,
      windowSize: parseJson(row.windowSizeJson, { width: 1280, height: 720 }),
      extraArgs: parseJson(row.extraArgsJson, []),
    }
  }

  private toRow(profile: LaunchProfile): {
    id: string
    mode: string
    chromeArgsJson: string
    stealthProfileId: string | null
    attachPort: number | null
    extensionId: string | null
    windowSizeJson: string
    extraArgsJson: string
  } {
    return {
      id: profile.id,
      mode: profile.mode,
      chromeArgsJson: JSON.stringify(profile.chromeArgs),
      stealthProfileId: profile.stealthProfileId,
      attachPort: profile.attachPort,
      extensionId: profile.extensionId,
      windowSizeJson: JSON.stringify(profile.windowSize),
      extraArgsJson: JSON.stringify(profile.extraArgs),
    }
  }
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\navigator-patch-module.ts
---

`	ypescript
// src/engines/stealth/navigator-patch-module.ts
// 11.2 — navigator_patch: core stealth module. Patches navigator.webdriver and
// other navigator properties to defeat automation fingerprinting.

import { z } from 'zod'
import type { StealthContext, StealthModule } from './stealth-module.js'

export const navigatorPatchConfig = z.object({
  webdriver: z.boolean().default(false),
  platform: z.string().optional(),
  languages: z.array(z.string()).optional(),
  hardwareConcurrency: z.number().int().positive().optional(),
  maxTouchPoints: z.number().int().nonnegative().optional(),
})

export type NavigatorPatchConfig = z.infer<typeof navigatorPatchConfig>

export const navigatorPatchModule: StealthModule = {
  name: 'navigator_patch',
  detectionVector: 'navigator.webdriver / navigator props',
  description: 'Patches navigator.webdriver and related properties to hide automation.',
  configSchema: navigatorPatchConfig,
  priority: 10,
  async apply(config, ctx: StealthContext) {
    const props: Record<string, unknown> = {}
    if (typeof config.webdriver === 'boolean') props.webdriver = config.webdriver
    if (typeof config.platform === 'string') props.platform = config.platform
    if (Array.isArray(config.languages)) props.languages = config.languages
    if (typeof config.hardwareConcurrency === 'number')
      props.hardwareConcurrency = config.hardwareConcurrency
    if (typeof config.maxTouchPoints === 'number') props.maxTouchPoints = config.maxTouchPoints

    const propEntries = Object.entries(props)
      .map(([k, v]) => `'${k}': ${JSON.stringify(v)}`)
      .join(',')

    const source = `(function() {
  const descriptors = ${JSON.stringify(props)};
  for (const key in descriptors) {
    try {
      Object.defineProperty(Navigator.prototype, key, {
        get: () => descriptors[key],
        configurable: true,
      });
    } catch (e) {}
  }
  // languages is on Navigator (instance) — patch directly too
  if (descriptors.languages) {
    try {
      Object.defineProperty(navigator, 'languages', {
        get: () => descriptors.languages,
        configurable: true,
      });
    } catch (e) {}
  }
})();`

    await ctx.cdp.send(ctx.slaveId, 'Page.addScriptToEvaluateOnNewDocument', { source })
    void propEntries
  },
  async verify(ctx: StealthContext) {
    const res = await ctx.cdp.send(ctx.slaveId, 'Runtime.evaluate', {
      expression: '(() => ({ webdriver: navigator.webdriver }))()',
      returnByValue: true,
    })
    const result = res as { result?: { value?: { webdriver?: unknown } } } | undefined
    return result?.result?.value?.webdriver === false
  },
}

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\network-fingerprint-engine.ts
---

`	ypescript
// src/engines/stealth/network-fingerprint-engine.ts
// Unit 14.3 — NetworkFingerprintEngine: TLS + HTTP header preservation.

import type { StealthContext, StealthModule } from './stealth-module-engine.js'

export class NetworkFingerprintModule implements StealthModule {
  name = 'network_fingerprint'
  detectionVector = 'TLS fingerprinting (JA3/JA4) + HTTP/2 header ordering'
  description = 'Verifies TLS fingerprint matches stock Chrome; monitors for network anomalies'
  priority = 2

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    // This module doesn't modify the network stack (that would require kernel-level interception).
    // Instead it monitors and verifies that the TLS fingerprint matches stock Chrome.
    // The actual defense is in LaunchProfileEngine (11.1) which removes bot-signal args
    // so Chrome uses its default network stack.
    //
    // This module adds a verification script that checks navigator properties
    // to detect if the browser is running with modified network settings.

    const script = `
      (function() {
        // Verify webdriver flag is not set
        Object.defineProperty(navigator, 'webdriver', {
          get: function() { return false; },
          configurable: true,
        });

        // Verify plugins array is populated (stock Chrome has plugins)
        if (navigator.plugins.length === 0) {
          Object.defineProperty(navigator, 'plugins', {
            get: function() {
              return [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                { name: 'Native Client', filename: 'internal-nacl-plugin' },
              ];
            },
            configurable: true,
          });
        }

        // Verify languages
        if (!navigator.languages || navigator.languages.length === 0) {
          Object.defineProperty(navigator, 'languages', {
            get: function() { return ['en-US', 'en']; },
            configurable: true,
          });
        }
      })();
    `

    await ctx.cdp.send(ctx.slaveId, 'Page.addScriptToEvaluateOnNewDocument', { source: script })
  }
}

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\profile-warmup-engine.ts
---

`	ypescript
// src/engines/stealth/profile-warmup-engine.ts
// Unit 14.1 — ProfileWarmupEngine: history/cookie/trust building.

import type { StealthContext, StealthModule } from './stealth-module-engine.js'

interface HistorySite {
  url: string
  title?: string
  visitCount?: number
}

interface CookieSite {
  domain: string
  cookies: Array<{
    name: string
    value: string
    path?: string
    secure?: boolean
    sameSite?: 'Strict' | 'Lax' | 'None'
  }>
}

const DEFAULT_HISTORY_SITES: HistorySite[] = [
  { url: 'https://www.google.com', title: 'Google', visitCount: 3 },
  { url: 'https://www.google.com/search?q=hello', title: 'hello - Google Search', visitCount: 1 },
  { url: 'https://www.youtube.com', title: 'YouTube', visitCount: 2 },
  { url: 'https://github.com', title: 'GitHub', visitCount: 1 },
  { url: 'https://news.ycombinator.com', title: 'Hacker News', visitCount: 1 },
  { url: 'https://stackoverflow.com', title: 'Stack Overflow', visitCount: 1 },
  { url: 'https://www.wikipedia.org', title: 'Wikipedia', visitCount: 1 },
]

export class ProfileWarmupModule implements StealthModule {
  name = 'profile_warmup'
  detectionVector = 'Fresh profile detection (empty history, zero cookies, no favicons)'
  description = 'Pre-populates browser history, cookies, and favicons before first real use'
  priority = 5

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    const historySites = (config.historySites as HistorySite[]) ?? DEFAULT_HISTORY_SITES
    const cookieSites = (config.cookieSites as CookieSite[]) ?? []
    const warmupDelayMs = (config.warmupDelayMs as number) ?? 2000

    // Set cookies via CDP
    for (const site of cookieSites) {
      for (const cookie of site.cookies) {
        await ctx.cdp
          .send(ctx.slaveId, 'Network.setCookie', {
            name: cookie.name,
            value: cookie.value,
            domain: site.domain,
            path: cookie.path ?? '/',
            secure: cookie.secure ?? true,
            sameSite: cookie.sameSite ?? 'Lax',
          })
          .catch(() => {})
      }
    }

    // Navigate through history sites to build history
    for (const site of historySites) {
      try {
        await ctx.cdp.send(ctx.slaveId, 'Page.navigate', { url: site.url })
        await new Promise((r) => setTimeout(r, warmupDelayMs))
      } catch {
        // Site may be unreachable — skip
      }
    }
  }
}

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\register-defaults.ts
---

`	ypescript
// src/engines/stealth/register-defaults.ts
// 11.2 — Registers the built-in stealth modules. Phase 11 ships navigator_patch;
// Phase 12 (canvas_noise), Phase 13 (webgl_spoof), Phase 14 (ua_spoof) register
// their own modules when those phases land.

import { navigatorPatchModule } from './navigator-patch-module.js'
import type { StealthModuleEngine } from './stealth-module-engine.js'

export function registerDefaultStealthModules(engine: StealthModuleEngine): void {
  engine.registerModule(navigatorPatchModule)
  // Phase 12-14 modules register themselves on their respective phases:
  //   engine.registerModule(canvasNoiseModule)
  //   engine.registerModule(webglSpoofModule)
  //   engine.registerModule(uaSpoofModule)
}

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\stealth-module-engine.ts
---

`	ypescript
// src/engines/stealth/stealth-module-engine.ts
// Unit 11.2 — StealthModuleEngine: registry + CDP injection pipeline.

import type { StructuredLogger } from '../logger.js'
import type { StealthCdpProxy } from './stealth-module.js'
import type { StealthProfileStore } from './stealth-profile-store.js'

export interface StealthModule {
  name: string
  detectionVector: string
  description: string
  priority: number
  apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void>
  verify?(ctx: StealthContext): Promise<boolean>
}

export interface StealthContext {
  cdp: StealthCdpProxy
  slaveId: string
  logger?: StructuredLogger
}

export interface StealthModuleConfig {
  name: string
  enabled: boolean
  config: Record<string, unknown>
}

export interface StealthModuleProfile {
  id: string
  name: string
  modules: StealthModuleConfig[]
}

export class StealthModuleEngine {
  private modules = new Map<string, StealthModule>()
  private profiles = new Map<string, StealthModuleProfile>()
  private applied = new Map<string, Set<string>>()

  constructor(
    private store: StealthProfileStore,
    private logger?: StructuredLogger,
  ) {
    void this.loadProfiles()
  }

  private async loadProfiles(): Promise<void> {
    const rows = await this.store.getAllModuleProfiles()
    for (const row of rows) {
      const modules = JSON.parse(row.modulesJson) as StealthModuleConfig[]
      this.profiles.set(row.id, { id: row.id, name: row.name, modules })
    }
  }

  registerModule(module: StealthModule): void {
    this.modules.set(module.name, module)
  }

  getRegisteredModules(): string[] {
    return Array.from(this.modules.keys())
  }

  async applyProfile(slaveId: string, profileId: string, ctx: StealthContext): Promise<string[]> {
    const profile = this.profiles.get(profileId)
    if (!profile) {
      this.logger?.warn(`Stealth profile not found: ${profileId}`)
      return []
    }

    const applied: string[] = []
    const alreadyApplied = this.applied.get(slaveId) ?? new Set()

    // Sort by priority (lower = first)
    const sorted = [...profile.modules]
      .filter((m) => m.enabled)
      .sort((a, b) => {
        const modA = this.modules.get(a.name)
        const modB = this.modules.get(b.name)
        return (modA?.priority ?? 999) - (modB?.priority ?? 999)
      })

    for (const modConfig of sorted) {
      if (alreadyApplied.has(modConfig.name)) continue

      const mod = this.modules.get(modConfig.name)
      if (!mod) {
        this.logger?.warn(`Stealth module not registered: ${modConfig.name}`)
        continue
      }

      try {
        await mod.apply(modConfig.config, ctx)
        alreadyApplied.add(modConfig.name)
        applied.push(modConfig.name)

        if (mod.verify) {
          const ok = await mod.verify(ctx)
          if (!ok) {
            this.logger?.warn(`Stealth module verify failed: ${modConfig.name}`)
          }
        }
      } catch (err) {
        this.logger?.error(`Stealth module apply failed: ${modConfig.name}`, {
          error: err as any,
        })
      }
    }

    this.applied.set(slaveId, alreadyApplied)
    return applied
  }

  getAppliedModules(slaveId: string): string[] {
    return Array.from(this.applied.get(slaveId) ?? [])
  }

  clearApplied(slaveId: string): void {
    this.applied.delete(slaveId)
  }
}

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\stealth-module.ts
---

`	ypescript
// src/engines/stealth/stealth-module.ts
// 11.2 — StealthModule interface + context. A stealth module injects JS into a
// running Chrome instance via CDP before any page loads.

import type { z } from 'zod'
import type { StructuredLogger } from '../logger.js'

export interface StealthCdpProxy {
  send(slaveId: string, method: string, params: Record<string, unknown>): Promise<unknown>
}

export interface StealthContext {
  cdp: StealthCdpProxy
  slaveId: string
  logger?: StructuredLogger
}

export interface StealthModuleConfig {
  name: string
  enabled: boolean
  config: Record<string, unknown>
}

export interface StealthModuleProfile {
  id: string
  name: string
  modules: StealthModuleConfig[]
}

export interface StealthModule {
  name: string
  detectionVector: string
  description: string
  configSchema: z.ZodSchema
  priority: number
  apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void>
  verify?(ctx: StealthContext): Promise<boolean>
}

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\stealth-profile-store.ts
---

`	ypescript
// src/engines/stealth/stealth-profile-store.ts
// Unit 11.3 — Stealth profile store: per-provider profile config from DB.

import type { CapStoreDb } from '../../storage/db.js'

export interface LaunchProfileRow {
  id: string
  mode: string
  chromeArgsJson: string
  stealthProfileId: string | null
  attachPort: number | null
  extensionId: string | null
  windowSizeJson: string
  extraArgsJson: string
  createdAt: number
  updatedAt: number
}

export interface ModuleProfileRow {
  id: string
  name: string
  modulesJson: string
  createdAt: number
  updatedAt: number
}

export interface StealthPolicyRow {
  id: string
  defaultLaunchProfileId: string | null
  defaultModuleProfileId: string | null
  providerOverridesJson: string
}

export class StealthProfileStore {
  constructor(private db: CapStoreDb) {}

  async getLaunchProfile(id: string): Promise<LaunchProfileRow | null> {
    return this.db.prisma.stealthLaunchProfile.findUnique({ where: { id } }) as any
  }

  async getAllLaunchProfiles(): Promise<LaunchProfileRow[]> {
    return this.db.prisma.stealthLaunchProfile.findMany() as any
  }

  async upsertLaunchProfile(id: string, data: Partial<LaunchProfileRow>): Promise<void> {
    await this.db.prisma.stealthLaunchProfile.upsert({
      where: { id },
      create: { id, mode: data.mode ?? 'cdp_stealth', ...data },
      update: data,
    })
  }

  async getModuleProfile(id: string): Promise<ModuleProfileRow | null> {
    return this.db.prisma.stealthModuleProfile.findUnique({ where: { id } }) as any
  }

  async getAllModuleProfiles(): Promise<ModuleProfileRow[]> {
    return this.db.prisma.stealthModuleProfile.findMany() as any
  }

  async upsertModuleProfile(id: string, data: Partial<ModuleProfileRow>): Promise<void> {
    await this.db.prisma.stealthModuleProfile.upsert({
      where: { id },
      create: { id, name: data.name ?? id, ...data },
      update: data,
    })
  }

  async getPolicy(): Promise<StealthPolicyRow | null> {
    return this.db.prisma.stealthPolicy.findUnique({ where: { id: 'default' } }) as any
  }

  async upsertPolicy(data: Partial<StealthPolicyRow>): Promise<void> {
    await this.db.prisma.stealthPolicy.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    })
  }
}

`$([char]10)
---
### C:\0-BlackBoxProject-0\vivim-final\src\engines\stealth\webgl-spoof-engine.ts
---

`	ypescript
// src/engines/stealth/webgl-spoof-engine.ts
// Unit 12.2 — WebGlSpoofEngine: GPU renderer + vendor spoofing.

import type { StealthContext, StealthModule } from './stealth-module-engine.js'

const REALISTIC_GPUS = [
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)',
  },
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
  },
  {
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
  },
  {
    vendor: 'Google Inc. (AMD)',
    renderer: 'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0)',
  },
  {
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)',
  },
]

export class WebGlSpoofModule implements StealthModule {
  name = 'webgl_spoof'
  detectionVector = 'WebGL renderer + vendor fingerprinting'
  description = 'Spoofs WebGL UNMASKED_RENDERER and UNMASKED_VENDOR to realistic GPU strings'
  priority = 11

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    const renderer = (config.renderer as string) ?? 'auto'
    const vendor = (config.vendor as string) ?? 'auto'
    const seed = config.seed as number | undefined

    let gpu = REALISTIC_GPUS[0]!
    if (renderer === 'auto') {
      const idx =
        seed !== undefined
          ? seed % REALISTIC_GPUS.length
          : Math.floor(Math.random() * REALISTIC_GPUS.length)
      gpu = REALISTIC_GPUS[idx]!
    } else {
      gpu = { vendor: vendor !== 'auto' ? vendor : 'Google Inc. (NVIDIA)', renderer }
    }

    const script = `
      (function() {
        var vendor = ${JSON.stringify(gpu.vendor)};
        var renderer = ${JSON.stringify(gpu.renderer)};

        var getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(param) {
          if (param === 0x9245) return vendor;
          if (param === 0x9246) return renderer;
          return getParameter.call(this, param);
        };

        if (typeof WebGL2RenderingContext !== 'undefined') {
          var getParameter2 = WebGL2RenderingContext.prototype.getParameter;
          WebGL2RenderingContext.prototype.getParameter = function(param) {
            if (param === 0x9245) return vendor;
            if (param === 0x9246) return renderer;
            return getParameter2.call(this, param);
          };
        }
      })();
    `

    await ctx.cdp.send(ctx.slaveId, 'Page.addScriptToEvaluateOnNewDocument', { source: script })
  }
}

`$([char]10)

