# demo-plugin

A Vivim Universal Canvas plugin scaffolded by `vivim canvas scaffold`.

## Structure
```
demo-plugin/
├── manifest.json              # plugin manifest (plugin-router.ts format)
├── components/
│   ├── sample-def.json        # CanvasDefinition row (html+css+sandbox)
│   └── sample-slot.tsx        # UIComponentRegistry bespoke renderer
└── src/
    └── sdk-hook.ts            # SDK entry point: defineComponent + publish + registerSlot
```

## Develop
1. Edit `components/sample-def.json` (the html/css of your data component).
2. Edit `components/sample-slot.tsx` (your React component — bespoke override).
3. Run `bun src/sdk-hook.ts` to publish + register locally.

## Install
```bash
# Tar it up and POST to /api/plugins/install
tar czf demo-plugin.vivim-plugin demo-plugin/
curl -X POST -F 'tarball=@demo-plugin.vivim-plugin' http://localhost:3000/api/plugins/install
```

The backend will:
1. Verify the manifest.
2. Register the plugin via PluginManager.
3. Seed the CanvasDefinition row via CanvasRegistry.define().
4. Emit `plugin:registered` → mounted nodes re-render (no rebuild).
