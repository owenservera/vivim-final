// seeds/harness/login.module.ts
// Login harness module — handle login flows

import type {
  HarnessContext,
  HarnessModule,
  HarnessModuleResult,
} from '../../src/engines/harness-runtime.js'

const loginModule: HarnessModule = {
  name: 'login',
  version: 1,
  inputSchema: {
    action: 'wait_for_form|type_email|type_password|submit|detect_login_state',
    email: 'string',
    password: 'string',
    selector: 'string',
  },
  outputSchema: { ok: 'boolean', action: 'string', loggedIn: 'boolean', error: 'string' },
  preconditions: ['page_loaded'],
  postconditions: ['logged_in', 'login_failed'],

  async execute(input: Record<string, unknown>, ctx: HarnessContext): Promise<HarnessModuleResult> {
    const action = input.action as string
    const email = input.email as string | undefined
    const password = input.password as string | undefined

    try {
      switch (action) {
        case 'wait_for_form': {
          const emailSel = (input.selector as string) || 'input[type="email"], input[name="email"]'
          const el = await ctx.waitFor(emailSel, 10000)
          if (!el) return { ok: false, output: {}, error: 'Login form not found' }
          ctx.emitTelemetry({
            type: 'selector_hit',
            moduleId: 'login',
            data: { action: 'wait_for_form' },
            ts: Date.now(),
          })
          return { ok: true, output: { action: 'wait_for_form' } }
        }
        case 'type_email': {
          if (!email) return { ok: false, output: {}, error: 'email required' }
          const emailInput = await ctx.waitFor('input[type="email"], input[name="email"]', 5000)
          if (!emailInput) return { ok: false, output: {}, error: 'Email input not found' }
          ctx.emitTelemetry({
            type: 'dom_interaction',
            moduleId: 'login',
            data: { action: 'type_email' },
            ts: Date.now(),
          })
          return { ok: true, output: { action: 'type_email' } }
        }
        case 'type_password': {
          if (!password) return { ok: false, output: {}, error: 'password required' }
          const pwInput = await ctx.waitFor('input[type="password"], input[name="password"]', 5000)
          if (!pwInput) return { ok: false, output: {}, error: 'Password input not found' }
          ctx.emitTelemetry({
            type: 'dom_interaction',
            moduleId: 'login',
            data: { action: 'type_password' },
            ts: Date.now(),
          })
          return { ok: true, output: { action: 'type_password' } }
        }
        case 'submit': {
          const submitBtn = await ctx.waitFor('button[type="submit"], input[type="submit"]', 5000)
          if (!submitBtn) return { ok: false, output: {}, error: 'Submit button not found' }
          ctx.emitTelemetry({
            type: 'dom_interaction',
            moduleId: 'login',
            data: { action: 'submit' },
            ts: Date.now(),
          })
          return { ok: true, output: { action: 'submit' } }
        }
        case 'detect_login_state': {
          const pageState = await ctx.getPageState()
          const loggedIn = !pageState.url.includes('login') && !pageState.url.includes('auth')
          ctx.emitTelemetry({
            type: 'dom_interaction',
            moduleId: 'login',
            data: { action: 'detect_login_state', loggedIn },
            ts: Date.now(),
          })
          return { ok: true, output: { action: 'detect_login_state', loggedIn } }
        }
        default: {
          return { ok: false, output: {}, error: `Unknown action: ${action}` }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      ctx.emitTelemetry({
        type: 'error',
        moduleId: 'login',
        data: { action, message },
        ts: Date.now(),
      })
      return { ok: false, output: {}, error: message }
    }
  },
}

export default loginModule
