// src/engines/browser-automation/harness-actions.ts
// BrowserHarnessActions — implements the recipe-compiler's extended browser
// actions on behalf of ChromeGovernor.executeHarnessPlan. Every CDP call goes
// through the passed ChromeGovernor (Governor Canon). Keeps the governor switch
// lean and the logic shared with the capability handlers.

import { EngineError } from '../../errors.js'
import type { ChromeGovernor } from '../chrome-governor.js'

type ActionParams = Record<string, unknown>

export class BrowserHarnessActions {
  constructor(private governor: ChromeGovernor) {}

  async runAction(slaveId: string, action: string, params: ActionParams): Promise<void> {
    switch (action) {
      case 'hover': {
        const s = String(params.selector ?? 'a')
        await this.governor.evaluate(
          slaveId,
          `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e){var r=e.getBoundingClientRect();e.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));}})()`,
        )
        return
      }
      case 'select': {
        const s = String(params.selector ?? 'select')
        const byLabel = params.label != null ? String(params.label) : null
        const expr = byLabel
          ? `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e){var o=[...e.options].find(o=>o.text===${JSON.stringify(byLabel)});if(o)e.value=o.value;e.dispatchEvent(new Event('change',{bubbles:true}));}})()`
          : `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e){e.value=${JSON.stringify(String(params.value ?? ''))};e.dispatchEvent(new Event('change',{bubbles:true}));}})()`
        await this.governor.evaluate(slaveId, expr)
        return
      }
      case 'press': {
        const key = String(params.key ?? 'Enter')
        await this.governor.cdp.send(slaveId, 'Input.dispatchKeyEvent', { type: 'keyDown', key })
        await this.governor.cdp.send(slaveId, 'Input.dispatchKeyEvent', { type: 'keyUp', key })
        return
      }
      case 'upload': {
        const s = String(params.selector ?? 'input[type=file]')
        await this.governor.evaluate(
          slaveId,
          `(()=>{var e=document.querySelector(${JSON.stringify(s)});if(e){e.setAttribute('data-vivim-files',${JSON.stringify(JSON.stringify(params.files ?? []))});e.dispatchEvent(new Event('change',{bubbles:true}));}})()`,
        )
        return
      }
      case 'wait_selector': {
        const deadline =
          Date.now() + (typeof params.timeoutMs === 'number' ? params.timeoutMs : 5000)
        const s = String(params.selector ?? 'body')
        while (Date.now() < deadline) {
          const found = (await this.governor.evaluate(
            slaveId,
            `!!document.querySelector(${JSON.stringify(s)})`,
          )) as boolean
          if (found) return
          await new Promise((r) => setTimeout(r, 200))
        }
        return
      }
      case 'wait_text': {
        const deadline =
          Date.now() + (typeof params.timeoutMs === 'number' ? params.timeoutMs : 5000)
        const t = String(params.text ?? '')
        while (Date.now() < deadline) {
          const found = (await this.governor.evaluate(
            slaveId,
            `document.body.innerText.includes(${JSON.stringify(t)})`,
          )) as boolean
          if (found) return
          await new Promise((r) => setTimeout(r, 200))
        }
        return
      }
      case 'screenshot': {
        const region = params.region as { x: number; y: number; w: number; h: number } | undefined
        await this.governor.captureScreenshot(slaveId, region)
        return
      }
      case 'assert': {
        const cond = String(params.condition ?? 'true')
        const ok = (await this.governor.evaluate(slaveId, cond)) as boolean
        if (!ok) throw new EngineError(`assert failed: ${cond}`)
        return
      }
      case 'mock_request': {
        await this.governor.evaluate(
          slaveId,
          `window.__mock=${JSON.stringify({ url: params.urlPattern, body: params.body, status: params.status ?? 200 })}`,
        )
        return
      }
      case 'cookie_set': {
        await this.governor.evaluate(
          slaveId,
          `document.cookie=${JSON.stringify(`${params.name}=${params.value};path=${params.path ?? '/'}`)}`,
        )
        return
      }
      case 'observe': {
        const what = String(params.what ?? 'dom')
        await this.governor.enableDomains(slaveId, ['DOM', 'Runtime', 'Network', 'Log'])
        // observe produces an event; the value is captured via captureScreenshot for 'screenshot'
        if (what === 'screenshot') await this.governor.captureScreenshot(slaveId)
        return
      }
    }
  }
}
