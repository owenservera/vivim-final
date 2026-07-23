// src/engines/composer-typing.ts
// Provider-specific composer typing strategies (Unit 2.3).
// Each provider exposes a different composer element; typing must match the
// element type so the provider's input handlers fire correctly.

import type { CDPTransport } from './chrome-governor.js'
import { humanizedClick } from './humanized-interaction.js'

export type ComposerType = 'textarea' | 'contenteditable' | 'quill' | 'codemirror'

/**
 * Type `text` into the composer element addressed by `selector` using the
 * strategy appropriate for `composerType`. Dispatches the synthetic DOM events
 * each framework listens for (React controlled inputs, contenteditable, Quill).
 */
export async function typeMessage(
  transport: CDPTransport,
  slaveId: string,
  selector: string,
  text: string,
  composerType: ComposerType,
): Promise<void> {
  const safeSelector = JSON.stringify(selector)
  const safeText = JSON.stringify(text)

  let expression: string

  switch (composerType) {
    case 'textarea':
      expression = `(() => {
        const el = document.querySelector(${safeSelector});
        if (!el) throw new EngineError('Composer not found: ' + ${safeSelector});
        el.focus();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        setter?.call(el, ${safeText});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })()`
      break

    case 'contenteditable':
      expression = `(() => {
        const el = document.querySelector(${safeSelector});
        if (!el) throw new EngineError('Composer not found: ' + ${safeSelector});
        el.focus();
        el.textContent = '';
        document.execCommand('insertText', false, ${safeText});
      })()`
      break

    case 'quill':
      expression = `(() => {
        const el = document.querySelector(${safeSelector});
        if (!el) throw new EngineError('Composer not found: ' + ${safeSelector});
        const quill = el.__quill || el.closest('.ql-container')?.__quill;
        if (quill) {
          quill.setContents([]);
          quill.insertText(0, ${safeText});
        } else {
          el.focus();
          el.textContent = ${safeText};
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()`
      break

    case 'codemirror':
      expression = `(() => {
        const el = document.querySelector(${safeSelector});
        if (!el) throw new EngineError('Composer not found: ' + ${safeSelector});
        const cm = el.closest('.CodeMirror')?.CodeMirror;
        if (cm) {
          cm.setValue(${safeText});
        } else {
          el.focus();
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          setter?.call(el, ${safeText});
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()`
      break

    default:
      expression = `(() => {
        const el = document.querySelector(${safeSelector});
        if (!el) throw new EngineError('Composer not found: ' + ${safeSelector});
        el.focus();
        el.value = ${safeText};
        el.dispatchEvent(new Event('input', { bubbles: true }));
      })()`
  }

  await transport.send(slaveId, 'Runtime.evaluate', { expression })
}

/**
 * Submit the composer. Prefers clicking a discrete send button when one is
 * known, otherwise dispatches an Enter key event (works for most providers).
 */
export async function submitMessage(
  transport: CDPTransport,
  slaveId: string,
  sendSelector?: string,
  key = 'Enter',
): Promise<void> {
  if (sendSelector) {
    const safeSelector = JSON.stringify(sendSelector)
    // Get element position for humanized click
    const posResult = await transport.send(slaveId, 'Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${safeSelector});
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      })()`,
      returnByValue: true,
    })
    const pos = (posResult as { result?: { value?: { x: number; y: number } } })?.result?.value
    if (pos) {
      await humanizedClick(transport, slaveId, pos.x, pos.y)
    } else {
      // Fallback to direct click if position can't be determined
      await transport.send(slaveId, 'Runtime.evaluate', {
        expression: `document.querySelector(${safeSelector})?.click()`,
      })
    }
    return
  }

  await transport.send(slaveId, 'Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code: key === 'Enter' ? 'Enter' : key,
  })
  await transport.send(slaveId, 'Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code: key === 'Enter' ? 'Enter' : key,
  })
}
