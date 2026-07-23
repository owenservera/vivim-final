import type { ComponentType } from 'react';

/**
 * SamplePluginGlowSend — bespoke chat.send renderer.
 *
 * Registered at runtime via SDK `registerSlot('chat.send', 'sample-plugin', Component)`.
 * Live-swaps into any surface whose resolver returns the 'sample-plugin' slug
 * for chat.send — no rebuild, no page reload (invariant 7).
 */
export const SamplePluginGlowSend: ComponentType<Record<string, unknown>> = () => {
  return (
    <button
      style={{
        padding: '10px 16px',
        border: 'none',
        borderRadius: 8,
        background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
        color: 'white',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 4px 12px -2px rgba(239, 68, 68, 0.5)',
      }}
    >
      Send → (sample-plugin)
    </button>
  );
};

export default SamplePluginGlowSend;
