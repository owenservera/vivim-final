// src/engines/stealth/canvas-noise-engine.ts
// Unit 12.1 — CanvasNoiseEngine: canvas fingerprint perturbation.

import type { StealthModule, StealthContext } from './stealth-module-engine.js'

export class CanvasNoiseModule implements StealthModule {
  name = 'canvas_noise'
  detectionVector = 'Canvas fingerprinting (toDataURL, toBlob, getImageData)'
  description = 'Adds subtle pixel noise to canvas readback to prevent fingerprint matching'
  priority = 10

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    const noiseLevel = (config.noiseLevel as number) ?? 0.01
    const noise = noiseLevel * 255
    const targets = (config.targets as string[]) ?? ['toDataURL', 'toBlob', 'getImageData']

    const script = `
      (function() {
        var noise = ${noise};
        var targets = ${JSON.stringify(targets)};

        function perturbImageData(imageData) {
          var data = imageData.data;
          for (var i = 0; i < data.length; i += 4) {
            data[i]     = Math.max(0, Math.min(255, data[i]     + (Math.random() - 0.5) * noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (Math.random() - 0.5) * noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + (Math.random() - 0.5) * noise));
          }
          return imageData;
        }

        if (targets.indexOf('toDataURL') !== -1) {
          var origToDataURL = HTMLCanvasElement.prototype.toDataURL;
          HTMLCanvasElement.prototype.toDataURL = function() {
            var ctx2d = this.getContext('2d');
            if (ctx2d) {
              var imageData = ctx2d.getImageData(0, 0, this.width, this.height);
              perturbImageData(imageData);
              ctx2d.putImageData(imageData, 0, 0);
            }
            return origToDataURL.apply(this, arguments);
          };
        }

        if (targets.indexOf('toBlob') !== -1) {
          var origToBlob = HTMLCanvasElement.prototype.toBlob;
          HTMLCanvasElement.prototype.toBlob = function(callback) {
            var ctx2d = this.getContext('2d');
            if (ctx2d) {
              var imageData = ctx2d.getImageData(0, 0, this.width, this.height);
              perturbImageData(imageData);
              ctx2d.putImageData(imageData, 0, 0);
            }
            return origToBlob.apply(this, arguments);
          };
        }

        if (targets.indexOf('getImageData') !== -1) {
          var origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
          CanvasRenderingContext2D.prototype.getImageData = function() {
            var imageData = origGetImageData.apply(this, arguments);
            return perturbImageData(imageData);
          };
        }
      })();
    `

    await ctx.cdp.send(ctx.slaveId, 'Page.addScriptToEvaluateOnNewDocument', { source: script })
  }
}
