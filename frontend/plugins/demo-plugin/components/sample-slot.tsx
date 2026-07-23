import type { ComponentType } from 'react';

/**
 * demo-plugin — bespoke chat.composer renderer.
 * Registered at runtime via SDK `registerSlot('chat.composer', 'demo-plugin', Component)`.
 * Live-swaps into any surface without rebuild.
 */
export const DemoPluginComposer: ComponentType<Record<string, unknown>> = () => {
  return (
    <div style={{ padding: 12, fontFamily: 'ui-sans-serif, system-ui', background: '#fef3c7' }}>
      <strong>demo-plugin</strong> composer (bespoke override)
    </div>
  );
};

export default DemoPluginComposer;
