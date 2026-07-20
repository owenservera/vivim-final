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

  async apply(config: Record<string, unknown>, _ctx: StealthContext): Promise<void> {
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
      const char = text[i]
      if (char === undefined) continue

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
