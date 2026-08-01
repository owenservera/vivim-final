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
      gpu = REALISTIC_GPUS[idx] ?? REALISTIC_GPUS[0]!
    } else {
      gpu = { vendor: vendor !== 'auto' ? vendor : 'Google Inc. (NVIDIA)', renderer }
    }

    const script = `
      (function() {
        var vendor = ${JSON.stringify(gpu?.vendor)};
        var renderer = ${JSON.stringify(gpu?.renderer)};

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
