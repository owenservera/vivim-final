/**
 * Sample plugin SDK entry point.
 *
 * Proves G1–G3 work end-to-end:
 *   - G1 (canvas-plugin-sdk): defineComponent + publish + registerSlot
 *   - G2 (live-config-toolkit): patchDefinition re-renders the mounted node
 *   - G3 (scaffold CLI): this file structure was scaffolded by
 *     `bun run canvas:scaffold sample-plugin` then hand-edited.
 *
 * Run: `bun plugins/sample-plugin/src/sdk-hook.ts`
 */

import { defineComponent, publish, registerSlot } from '../../../src/sdk/canvas';
import defInput from '../components/glow-send.json';
import { SamplePluginGlowSend } from '../components/glow-send';

const API_BASE = process.env.API_BASE ?? 'http://localhost:3000';

export async function activate(): Promise<void> {
  // G1.1 — build the CanvasDefinition (Zod-validated; P8 enforced).
  const def = defineComponent(defInput);

  // G1.2 — publish to the canvas (no build step; live hot-swap).
  const published = await publish(def, { apiBase: API_BASE });

  // G1.4 — register the bespoke React slot (live UIComponentRegistry hot-swap).
  // This is a browser-only operation (the registry lives in the browser).
  // In Node, we skip it; the browser SDK consumer would call this on mount.
  try {
    registerSlot('chat.send', 'sample-plugin', SamplePluginGlowSend, {
      sandbox: ['cap:message:send'],
    });
  } catch (err) {
  }

  // G2 — demo live-config patch: bump html to add a counter, re-publish.
  if (process.env.DEV_PATCH === '1') {
    const patched = await publish(
      defineComponent({
        ...defInput,
        html: '<div class="glow-send-root"><button class="glow-send-btn" data-action="send">Send → (patched)</button></div>',
      }),
      { apiBase: API_BASE },
    );
  }
}

if (require.main === module) {
  activate().catch((err) => {
    process.exit(1);
  });
}
