// src/automation/automation-router.ts
// REST API for frontend UI automation.
// The agent calls these endpoints to drive the browser — user sees it live.

import { z } from 'zod'
import { errorResponse, json } from '../server/response.js'
import { parseRequestBody } from '../server/validate.js'
import { type ElementSelector, UIAutomator } from './ui-automator.js'

const NavigateSchema = z.object({ url: z.string().min(1), port: z.number().int().optional() })
const ClickSchema = z.object({
  selector: z.custom<ElementSelector>(),
  port: z.number().int().optional(),
})
const TypeSchema = z.object({
  selector: z.custom<ElementSelector>(),
  text: z.string(),
  delay: z.number().optional(),
  port: z.number().int().optional(),
})
const ClearSchema = z.object({
  selector: z.custom<ElementSelector>(),
  port: z.number().int().optional(),
})
const PressSchema = z.object({
  key: z.string().min(1),
  modifiers: z
    .object({
      ctrl: z.boolean().optional(),
      shift: z.boolean().optional(),
      alt: z.boolean().optional(),
    })
    .optional(),
  port: z.number().int().optional(),
})

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
        const parsed = await parseRequestBody(req, NavigateSchema)
        if (!parsed.success) return parsed.response
        const auto = await getAutomator(parsed.data.port)
        const result = await auto.navigate(parsed.data.url)
        return json(result)
      }

      // POST /api/automate/click — click an element
      if (pathname === '/api/automate/click' && method === 'POST') {
        const parsed = await parseRequestBody(req, ClickSchema)
        if (!parsed.success) return parsed.response
        const auto = await getAutomator(parsed.data.port)
        const result = await auto.click(parsed.data.selector)
        return json(result)
      }

      // POST /api/automate/type — type text into an element
      if (pathname === '/api/automate/type' && method === 'POST') {
        const parsed = await parseRequestBody(req, TypeSchema)
        if (!parsed.success) return parsed.response
        const auto = await getAutomator(parsed.data.port)
        const result = await auto.type(parsed.data.selector, parsed.data.text, {
          delay: parsed.data.delay,
        })
        return json(result)
      }

      // POST /api/automate/clear — clear an input
      if (pathname === '/api/automate/clear' && method === 'POST') {
        const parsed = await parseRequestBody(req, ClearSchema)
        if (!parsed.success) return parsed.response
        const auto = await getAutomator(parsed.data.port)
        const result = await auto.clear(parsed.data.selector)
        return json(result)
      }

      // POST /api/automate/press — press a key
      if (pathname === '/api/automate/press' && method === 'POST') {
        const parsed = await parseRequestBody(req, PressSchema)
        if (!parsed.success) return parsed.response
        const auto = await getAutomator(parsed.data.port)
        const result = await auto.pressKey(parsed.data.key, parsed.data.modifiers)
        return json(result)
      }

      // GET /api/automate/text — get element text
      if (pathname === '/api/automate/text' && method === 'GET') {
        const portParam = url.searchParams.get('port')
        const selector = Object.fromEntries(url.searchParams) as unknown as ElementSelector
        const port = portParam ? Number.parseInt(portParam, 10) : undefined
        const auto = await getAutomator(port)
        const text = await auto.getText(selector)
        return json({ ok: true, text })
      }

      // GET /api/automate/value — get input value
      if (pathname === '/api/automate/value' && method === 'GET') {
        const portParam = url.searchParams.get('port')
        const selector = Object.fromEntries(url.searchParams) as unknown as ElementSelector
        const port = portParam ? Number.parseInt(portParam, 10) : undefined
        const auto = await getAutomator(port)
        const value = await auto.getValue(selector)
        return json({ ok: true, value })
      }

      // GET /api/automate/exists — check if element exists
      if (pathname === '/api/automate/exists' && method === 'GET') {
        const portParam = url.searchParams.get('port')
        const selector = Object.fromEntries(url.searchParams) as unknown as ElementSelector
        const port = portParam ? Number.parseInt(portParam, 10) : undefined
        const auto = await getAutomator(port)
        const exists = await auto.exists(selector)
        return json({ ok: true, exists })
      }

      // GET /api/automate/screenshot — take screenshot
      if (pathname === '/api/automate/screenshot' && method === 'GET') {
        const portParam = url.searchParams.get('port')
        const port = portParam ? Number.parseInt(portParam, 10) : undefined
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
          // [audit] log the error with context here
          automator = null
        }
        return json({ ok: true, detail: 'Automator reset' })
      }

      return errorResponse('Not found', 'NotFound', 404)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal error'
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
