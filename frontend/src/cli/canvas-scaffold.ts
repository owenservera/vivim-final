#!/usr/bin/env bun
/**
 * cli/canvas-scaffold.ts (G3)
 * --------------------------------------------------------------------
 * `vivim canvas scaffold <name>` — boots a `.vivim-plugin` skeleton:
 *   manifest.json + components/ (one CanvasDefinition stub + one
 *   UIComponentRegistry stub) + sdk-hook.ts. The output mirrors the
 *   plugin-router.ts tarball format so `POST /api/plugins/install`
 *   can ingest it.
 *
 * Run: `bun run canvas:scaffold <name>`
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

async function main() {
  const name = process.argv[2];
  if (!name) {
    console.error('Usage: bun run canvas:scaffold <name>');
    process.exit(1);
  }

  const root = resolve(process.cwd(), 'plugins', name);
  await mkdir(join(root, 'components'), { recursive: true });
  await mkdir(join(root, 'src'), { recursive: true });

  // manifest.json — describes the plugin for plugin-router.ts.
  const manifest = {
    name,
    version: '0.1.0',
    description: `Vivim canvas plugin: ${name}`,
    author: 'system',
    components: [
      { kind: 'canvas-definition', slug: `${name}.sample-def`, path: 'components/sample-def.json' },
      { kind: 'ui-component-registry', slot: 'chat.composer', slug: name, path: 'components/sample-slot.tsx' },
    ],
    sdkHook: 'src/sdk-hook.ts',
  };
  await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // components/sample-def.json — a CanvasDefinition row.
  const sampleDef = {
    slug: `${name}.sample-def`,
    name: `${name} Sample Component`,
    description: `A sample CanvasDefinition published by the ${name} plugin.`,
    category: 'plugin',
    html: `<div class="${name}-root">
  <h3>${name}</h3>
  <p>This component was scaffolded by <code>vivim canvas scaffold ${name}</code>.</p>
  <button data-action="ping">Ping</button>
</div>`,
    css: `.${name}-root {
  font-family: ui-sans-serif, system-ui, sans-serif;
  padding: 16px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 8px;
  color: #1f2937;
}
.${name}-root h3 { margin: 0 0 8px; font-size: 16px; }
.${name}-root p { margin: 0 0 12px; font-size: 13px; color: #4b5563; }
.${name}-root button {
  padding: 4px 12px;
  border: 1px solid #1f2937;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}`,
    sandbox: {
      allowCapabilities: ['cap:canvas:ping'],
      allowNetwork: false,
      budgetMs: 5000,
      allowInlineScript: false,
    },
    tags: ['scaffold', name],
  };
  await writeFile(join(root, 'components', 'sample-def.json'), JSON.stringify(sampleDef, null, 2));

  // components/sample-slot.tsx — a UIComponentRegistry entry.
  const sampleSlot = `import type { ComponentType } from 'react';

/**
 * ${name} — bespoke chat.composer renderer.
 * Registered at runtime via SDK \`registerSlot('chat.composer', '${name}', Component)\`.
 * Live-swaps into any surface without rebuild.
 */
export const ${pascal(name)}Composer: ComponentType<Record<string, unknown>> = () => {
  return (
    <div style={{ padding: 12, fontFamily: 'ui-sans-serif, system-ui', background: '#fef3c7' }}>
      <strong>${name}</strong> composer (bespoke override)
    </div>
  );
};

export default ${pascal(name)}Composer;
`;
  await writeFile(join(root, 'components', 'sample-slot.tsx'), sampleSlot);

  // src/sdk-hook.ts — the SDK entry point the plugin author edits.
  const sdkHook = `import { defineComponent, publish, registerSlot } from '../../../src/sdk/canvas';
import { ${pascal(name)}Composer } from '../components/sample-slot';
import sampleDef from '../components/sample-def.json';

/**
 * ${name} — SDK entry point. Called by the plugin loader on install.
 * Mirrors plugin-router.ts tarball lifecycle:
 *   install → verify → register → seed components → activate.
 */
export async function activate(): Promise<void> {
  // 1. Publish the CanvasDefinition row (no build step).
  const def = defineComponent(sampleDef);
  await publish(def);

  // 2. Register the bespoke UIComponentRegistry slot (live hot-swap).
  registerSlot('chat.composer', '${name}', ${pascal(name)}Composer, {
    sandbox: ['cap:message:compose'],
  });

  console.log('[${name}] plugin activated: def=${'${'}def.slug}, slot=chat.composer');
}

// Auto-activate when run directly.
if (require.main === module) {
  activate().catch((err) => {
    console.error('[${name}] activation failed:', err);
    process.exit(1);
  });
}
`;
  await writeFile(join(root, 'src', 'sdk-hook.ts'), sdkHook);

  // README.md
  const readme = `# ${name}

A Vivim Universal Canvas plugin scaffolded by \`vivim canvas scaffold\`.

## Structure
\`\`\`
${name}/
├── manifest.json              # plugin manifest (plugin-router.ts format)
├── components/
│   ├── sample-def.json        # CanvasDefinition row (html+css+sandbox)
│   └── sample-slot.tsx        # UIComponentRegistry bespoke renderer
└── src/
    └── sdk-hook.ts            # SDK entry point: defineComponent + publish + registerSlot
\`\`\`

## Develop
1. Edit \`components/sample-def.json\` (the html/css of your data component).
2. Edit \`components/sample-slot.tsx\` (your React component — bespoke override).
3. Run \`bun src/sdk-hook.ts\` to publish + register locally.

## Install
\`\`\`bash
# Tar it up and POST to /api/plugins/install
tar czf ${name}.vivim-plugin ${name}/
curl -X POST -F 'tarball=@${name}.vivim-plugin' /api/plugins/install
\`\`\`

The backend will:
1. Verify the manifest.
2. Register the plugin via PluginManager.
3. Seed the CanvasDefinition row via CanvasRegistry.define().
4. Emit \`plugin:registered\` → mounted nodes re-render (no rebuild).
`;
  await writeFile(join(root, 'README.md'), readme);

  console.log(`✓ Scaffolded plugin: ${root}`);
  console.log(`  Next: cd plugins/${name} && bun src/sdk-hook.ts`);
}

function pascal(s: string): string {
  return s
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
