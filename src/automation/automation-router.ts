// src/automation/automation-router.ts
// REST API for frontend UI automation.
// The agent calls these endpoints to drive the browser — user sees it live.

import { errorResponse, json } from '../server/response.js'
import { type ElementSelector, UIAutomator } from './ui-automator.js'

let automator: UIAutomator | null = null

async function getAutomator(port?: number): Promise<UIAutomator> {
  if (!automator) {
    automator = new UIAutomator({ port: port ?? 9222 })
    await automator.connect()
  }
  return automator
}

export function createAutomationRouter() {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    const { pathname } = url
    const method = req.method

    try {
      // POST /api/automate/navigate — navigate to URL
      if (pathname === '/api/automate/navigate' && method === 'POST') {
        const body = (await req.json()) as { url: string; port?: number }
        if (!body.url) return errorResponse('url required', 'ValidationError', 400)
        const auto = await getAutomator(body.port)
        const result = await auto.navigate(body.url)
        return json(result)
      }

      // POST /api/automate/click — click an element
      if (pathname === '/api/automate/click' && method === 'POST') {
        const body = (await req.json()) as { selector: ElementSelector; port?: number }
        if (!body.selector) return errorResponse('selector required', 'ValidationError', 400)
        const auto = await getAutomator(body.port)
        const result = await auto.click(body.selector)
        return json(result)
      }

      // POST /api/automate/type — type text into an element
      if (pathname === '/api/automate/type' && method === 'POST') {
        const body = (await req.json()) as {
          selector: ElementSelector
          text: string
          delay?: number
          port?: number
        }
        if (!body.selector || body.text === undefined)
          return errorResponse('selector and text required', 'ValidationError', 400)
        const auto = await getAutomator(body.port)
        const result = await auto.type(body.selector, body.text, { delay: body.delay })
        return json(result)
      }

      // POST /api/automate/clear — clear an input
      if (pathname === '/api/automate/clear' && method === 'POST') {
        const body = (await req.json()) as { selector: ElementSelector; port?: number }
        if (!body.selector) return errorResponse('selector required', 'ValidationError', 400)
        const auto = await getAutomator(body.port)
        const result = await auto.clear(body.selector)
        return json(result)
      }

      // POST /api/automate/press — press a key
      if (pathname === '/api/automate/press' && method === 'POST') {
        const body = (await req.json()) as {
          key: string
          modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean }
          port?: number
        }
        if (!body.key) return errorResponse('key required', 'ValidationError', 400)
        const auto = await getAutomator(body.port)
        const result = await auto.pressKey(body.key, body.modifiers)
        return json(result)
      }

      // GET /api/automate/text — get element text
      if (pathname === '/api/automate/text' && method === 'GET') {
        const portParam = url.searchParams.get('port')
        const selector = Object.fromEntries(url.searchParams) as unknown as ElementSelector
        const port = portParam ? Number.parseInt(portParam) : undefined
        const auto = await getAutomator(port)
        const text = await auto.getText(selector)
        return json({ ok: true, text })
      }

      // GET /api/automate/value — get input value
      if (pathname === '/api/automate/value' && method === 'GET') {
        const portParam = url.searchParams.get('port')
        const selector = Object.fromEntries(url.searchParams) as unknown as ElementSelector
        const port = portParam ? Number.parseInt(portParam) : undefined
        const auto = await getAutomator(port)
        const value = await auto.getValue(selector)
        return json({ ok: true, value })
      }

      // GET /api/automate/exists — check if element exists
      if (pathname === '/api/automate/exists' && method === 'GET') {
        const portParam = url.searchParams.get('port')
        const selector = Object.fromEntries(url.searchParams) as unknown as ElementSelector
        const port = portParam ? Number.parseInt(portParam) : undefined
        const auto = await getAutomator(port)
        const exists = await auto.exists(selector)
        return json({ ok: true, exists })
      }

      // GET /api/automate/screenshot — take screenshot
      if (pathname === '/api/automate/screenshot' && method === 'GET') {
        const portParam = url.searchParams.get('port')
        const port = portParam ? Number.parseInt(portParam) : undefined
        const auto = await getAutomator(port)
        const data = await auto.screenshot()
        return json({ ok: true, screenshot: data })
      }

      // GET /api/automate/page — get page content
      if (pathname === '/api/automate/page' && method === 'GET') {
        const auto = await getAutomator()
        const content = await auto.getPageContent()
        const title = await auto.getPageTitle()
        const url = await auto.getCurrentUrl()
        return json({ ok: true, title, url, content: content.slice(0, 5000) })
      }

      // POST /api/automate/reset — disconnect and reconnect
      if (pathname === '/api/automate/reset' && method === 'POST') {
        if (automator) {
          await automator.disconnect().catch(() => {})
          automator = null
        }
        return json({ ok: true, detail: 'Automator reset' })
      }

      return errorResponse('Not found', 'NotFoundError', 404)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal error'
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
