import { defineComponent, publish, registerSlot } from '../../../src/sdk/canvas';
import { DemoPluginComposer } from '../components/sample-slot';
import sampleDef from '../components/sample-def.json';

/**
 * demo-plugin — SDK entry point. Called by the plugin loader on install.
 * Mirrors plugin-router.ts tarball lifecycle:
 *   install → verify → register → seed components → activate.
 */
export async function activate(): Promise<void> {
  // 1. Publish the CanvasDefinition row (no build step).
  const def = defineComponent(sampleDef);
  await publish(def);

  // 2. Register the bespoke UIComponentRegistry slot (live hot-swap).
  registerSlot('chat.composer', 'demo-plugin', DemoPluginComposer, {
    sandbox: ['cap:message:compose'],
  });

  // [audit] removed: console.log('[demo-plugin] plugin activated: def=${def.slug}, slot=chat.composer');
}

// Auto-activate when run directly.
if (require.main === module) {
  activate().catch((err) => {
    // [audit] removed: console.error('[demo-plugin] activation failed:', err);
    process.exit(1);
  });
}
