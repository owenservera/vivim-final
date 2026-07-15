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
    } catch (e) { /* best-effort: property may already be defined as non-configurable */ }
  }
  // languages is on Navigator (instance) — patch directly too
  if (descriptors.languages) {
    try {
      Object.defineProperty(navigator, 'languages', {
        get: () => descriptors.languages,
        configurable: true,
      });
    } catch (e) { /* best-effort: property may already be defined as non-configurable */ }
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
