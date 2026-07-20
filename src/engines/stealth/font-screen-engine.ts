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

    const resolutions = COMMON_RESOLUTIONS
    let resolution: Resolution =
      resolutions[Math.floor(Math.random() * resolutions.length)] ?? resolutions[0]
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
