// src/engines/stealth/cdp-artifact-cleaner.ts
// Unit 14.2 — CDPArtifactCleaner: remove CDP traces from page.

import type { StealthModule, StealthContext } from './stealth-module-engine.js'

export class CdpArtifactCleanerModule implements StealthModule {
  name = 'cdp_artifact_cleaner'
  detectionVector = 'CDP/WebDriver artifacts in page context (cdc_*, stack traces, performance entries)'
  description = 'Removes CDP-injected variables, cleans error stacks, filters performance entries'
  priority = 1

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    const removeCdcVars = (config.removeCdcVars as boolean) ?? true
    const patchErrorStack = (config.patchErrorStack as boolean) ?? true
    const filterPerfEntries = (config.filterPerfEntries as boolean) ?? true

    const script = `
      (function() {
        ${removeCdcVars ? `
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
        ` : ''}

        ${patchErrorStack ? `
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
        ` : ''}

        ${filterPerfEntries ? `
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
        ` : ''}
      })();
    `

    await ctx.cdp.send(ctx.slaveId, 'Page.addScriptToEvaluateOnNewDocument', { source: script })
  }
}
