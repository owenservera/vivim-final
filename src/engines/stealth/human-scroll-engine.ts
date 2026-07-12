// src/engines/stealth/human-scroll-engine.ts
// Unit 13.3 — HumanScrollEngine: natural scroll velocity curves.

import type { StealthModule, StealthContext } from './stealth-module-engine.js'

export class HumanScrollModule implements StealthModule {
  name = 'human_scroll'
  detectionVector = 'Scroll velocity analysis (acceleration patterns, event frequency)'
  description = 'Scrolls with human-like velocity curves (ease-in, plateau, ease-out)'
  priority = 22

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    const minSteps = (config.minSteps as number) ?? 5
    const maxSteps = (config.maxSteps as number) ?? 15
    const stepDelayMinMs = (config.stepDelayMinMs as number) ?? 16
    const stepDelayMaxMs = (config.stepDelayMaxMs as number) ?? 50
    const overshootProbability = (config.overshootProbability as number) ?? 0.2
    const pauseAtEndMs = (config.pauseAtEndMs as number) ?? 200

    // Expose human scroll API
    const script = `
      (function() {
        window.__vivimHumanScroll = {
          async scroll(direction, totalPixels) {
            var steps = ${minSteps} + Math.floor(Math.random() * (${maxSteps} - ${minSteps}));
            var actualTotal = totalPixels;
            var correction = 0;
            if (Math.random() < ${overshootProbability}) {
              actualTotal = totalPixels * (1 + Math.random() * 0.15);
              correction = totalPixels - actualTotal;
            }

            var stepSize = actualTotal / steps;
            var axis = (direction === 'up' || direction === 'down') ? 'Y' : 'X';
            var sign = (direction === 'down' || direction === 'right') ? 1 : -1;

            for (var i = 0; i < steps; i++) {
              var progress = i / steps;
              var ease;
              if (progress < 0.2) ease = progress * 2.5;
              else if (progress > 0.8) ease = (1 - progress) * 2.5;
              else ease = 1;

              var thisStep = stepSize * ease;
              var delta = sign * thisStep;

              window.scrollBy(
                axis === 'X' ? delta : 0,
                axis === 'Y' ? delta : 0
              );

              var delay = ${stepDelayMinMs} + Math.random() * (${stepDelayMaxMs} - ${stepDelayMinMs});
              delay /= ease || 0.5;
              await new Promise(function(r) { setTimeout(r, delay); });
            }

            if (correction !== 0) {
              window.scrollBy(
                axis === 'X' ? -correction * sign : 0,
                axis === 'Y' ? -correction * sign : 0
              );
            }

            await new Promise(function(r) { setTimeout(r, ${pauseAtEndMs}); });
          }
        };
      })();
    `

    await ctx.cdp.send(ctx.slaveId, 'Page.addScriptToEvaluateOnNewDocument', { source: script })
  }
}
