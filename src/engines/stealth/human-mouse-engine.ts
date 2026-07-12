// src/engines/stealth/human-mouse-engine.ts
// Unit 13.1 — HumanMouseEngine: bezier-curve mouse movement.

import type { StealthModule, StealthContext } from './stealth-module-engine.js'

export class HumanMouseModule implements StealthModule {
  name = 'human_mouse'
  detectionVector = 'Mouse movement biometrics (acceleration curves, click distribution)'
  description = 'Moves mouse along bezier curves with human-like acceleration and Gaussian click offset'
  priority = 20

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    const bezierPoints = (config.bezierPoints as number) ?? 25
    const speedMin = (config.speedMin as number) ?? 300
    const speedMax = (config.speedMax as number) ?? 800
    const clickOffsetRadius = (config.clickOffsetRadius as number) ?? 5
    const overshootProbability = (config.overshootProbability as number) ?? 0.15

    const script = `
      (function() {
        var BEZIER_POINTS = ${bezierPoints};
        var SPEED_MIN = ${speedMin};
        var SPEED_MAX = ${speedMax};
        var CLICK_OFFSET = ${clickOffsetRadius};
        var OVERSHOOT_PROB = ${overshootProbability};

        window.__vivimHumanMouse = {
          async moveTo(targetX, targetY) {
            var startX = window.__vivimMouseX || 0;
            var startY = window.__vivimMouseY || 0;
            var dist = Math.sqrt(Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2));
            var speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
            var durationMs = (dist / speed) * 1000;

            var cp1x = startX + (targetX - startX) * 0.3 + (Math.random() - 0.5) * dist * 0.3;
            var cp1y = startY + (targetY - startY) * 0.3 + (Math.random() - 0.5) * dist * 0.3;
            var cp2x = startX + (targetX - startX) * 0.7 + (Math.random() - 0.5) * dist * 0.3;
            var cp2y = startY + (targetY - startY) * 0.7 + (Math.random() - 0.5) * dist * 0.3;

            for (var i = 1; i <= BEZIER_POINTS; i++) {
              var t = i / BEZIER_POINTS;
              var ease = t * t * (3 - 2 * t);
              var mt = 1 - ease;
              var x = mt*mt*mt*startX + 3*mt*mt*ease*cp1x + 3*mt*ease*ease*cp2x + ease*ease*ease*targetX;
              var y = mt*mt*mt*startY + 3*mt*mt*ease*cp1y + 3*mt*ease*ease*cp2y + ease*ease*ease*targetY;

              window.__vivimMouseX = x;
              window.__vivimMouseY = y;

              document.dispatchEvent(new MouseEvent('mousemove', {
                clientX: x, clientY: y, bubbles: true
              }));

              await new Promise(function(r) { setTimeout(r, durationMs / BEZIER_POINTS); });
            }
          },

          async click(targetX, targetY) {
            var offset = function() {
              return (Math.random() - 0.5) * CLICK_OFFSET * 2;
            };
            var x = targetX + offset();
            var y = targetY + offset();

            await this.moveTo(x, y);

            document.dispatchEvent(new MouseEvent('mousedown', {
              clientX: x, clientY: y, button: 0, bubbles: true
            }));
            await new Promise(function(r) { setTimeout(r, 50 + Math.random() * 100); });
            document.dispatchEvent(new MouseEvent('mouseup', {
              clientX: x, clientY: y, button: 0, bubbles: true
            }));
            document.dispatchEvent(new MouseEvent('click', {
              clientX: x, clientY: y, button: 0, bubbles: true
            }));
          }
        };
      })();
    `

    await ctx.cdp.send(ctx.slaveId, 'Page.addScriptToEvaluateOnNewDocument', { source: script })
  }
}
