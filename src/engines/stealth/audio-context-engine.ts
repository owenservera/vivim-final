// src/engines/stealth/audio-context-engine.ts
// Unit 12.3 — AudioContextEngine: audio fingerprint perturbation.

import type { StealthContext, StealthModule } from './stealth-module-engine.js'

export class AudioContextModule implements StealthModule {
  name = 'audio_context'
  detectionVector = 'AudioContext fingerprinting (oscillator + analyser node)'
  description = 'Adds noise to AudioContext output to prevent audio fingerprinting'
  priority = 12

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    const noiseLevel = (config.noiseLevel as number) ?? 0.0001

    const script = `
      (function() {
        var noiseLevel = ${noiseLevel};

        var origGetFloatFrequency = AnalyserNode.prototype.getFloatFrequencyData;
        AnalyserNode.prototype.getFloatFrequencyData = function(array) {
          origGetFloatFrequency.call(this, array);
          for (var i = 0; i < array.length; i++) {
            array[i] += (Math.random() - 0.5) * noiseLevel;
          }
        };

        var origGetByteFrequency = AnalyserNode.prototype.getByteFrequencyData;
        AnalyserNode.prototype.getByteFrequencyData = function(array) {
          origGetByteFrequency.call(this, array);
          for (var i = 0; i < array.length; i++) {
            array[i] = Math.max(0, Math.min(255, array[i] + (Math.random() - 0.5) * noiseLevel * 255));
          }
        };

        var origGetChannelData = AudioBuffer.prototype.getChannelData;
        AudioBuffer.prototype.getChannelData = function(channel) {
          var data = origGetChannelData.call(this, channel);
          for (var i = 0; i < data.length; i++) {
            data[i] += (Math.random() - 0.5) * noiseLevel;
          }
          return data;
        };
      })();
    `

    await ctx.cdp.send(ctx.slaveId, 'Page.addScriptToEvaluateOnNewDocument', { source: script })
  }
}
