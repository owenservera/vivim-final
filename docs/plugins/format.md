# .vivim-plugin Format Specification v1.0

A `.vivim-plugin` is a **tar.gz** archive containing a self-describing provider
extension. It packages provider configuration, capabilities, UI components,
parsers, and stream configs into a single distributable artifact.

## Archive Structure

```
my-plugin.vivim-plugin  (tar.gz)
├── manifest.json        (required — provider definition)
├── icon.png             (optional — 128x128 plugin icon)
├── components/          (optional — UI components per primitive)
│   ├── composer/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   ├── message-bubble/
│   │   ├── index.html
│   │   ├── style.css
│   │   └── script.js
│   └── ...
└── parsers/             (optional — parser source files)
    └── stream-parser.ts
```

## manifest.json

The manifest follows the `ProviderManifestSchema` (see `src/schema/provider-manifest.ts`)
with additional plugin-level metadata:

```jsonc
{
  "$schema": "https://vivim.ai/schemas/plugin-v1.json",
  "version": "1.2.0",
  "description": "ChatGPT provider plugin with canvas viewer component",
  "depends_on": [],                          // list of plugin slugs this depends on
  "migrationScript": null,                   // optional JS migration on upgrade
  "provider": {
    "slug": "chatgpt",
    "display_name": "ChatGPT",
    "description": "OpenAI ChatGPT provider",
    "category": "ai",
    "provider_type": "llm",
    "website_url": "https://chatgpt.com",
    "auth_type": "browser",
    "has_multi_account": true,
    "profile_strategy": "per_account"
  },
  "endpoints": [...],
  "parsers": [...],
  "models": [...],
  "capabilities_config": [...],
  "config": [...]
}
```

### Plugin Metadata Fields

| Field | Required | Description |
|---|---|---|
| `version` | Yes | SemVer version of the plugin artifact |
| `description` | No | Human-readable description |
| `depends_on` | No | Array of plugin slugs required before this plugin can install |
| `migrationScript` | No | JavaScript migration to run during upgrade (function body, given `db`, `oldVersion`, `newVersion`) |

## Components Directory

Each subdirectory under `components/` maps to one UI primitive (composer,
message-bubble, sidebar, etc.). The directory name is the primitive's short
name. Three files compose one component:

| File | Required | Content |
|---|---|---|
| `index.html` | Yes | HTML template with `{{variable}}` placeholders |
| `style.css` | No | Scoped CSS styles |
| `script.js` | No | Client-side JavaScript (sandboxed) |

Components are registered as `UiComponent` rows with:
- `scope: 'provider'`
- `ownerId: <plugin slug>`
- `variant: null` (or overridden per variant)
- `status: 'published'`

## Integrity Verification

On install, the entire archive is SHA-256 hashed. Before loading any plugin
code (parser, component script, stream config), the stored hash is verified
against the current files. If the hash does not match, the plugin is refused
with a `plugin:integrity_failed` event.

## Lifecycle Events

| Event | Trigger |
|---|---|
| `plugin:installed` | Plugin registered successfully |
| `plugin:uninstalled` | Plugin and all related rows removed |
| `plugin:upgraded` | New version installed over old |
| `plugin:enabled` | Plugin activated |
| `plugin:disabled` | Plugin deactivated |
| `plugin:integrity_failed` | Hash verification failed |

## Dependency Resolution

On install, all plugins listed in `depends_on` must exist and be active. On
uninstall, if any other active plugin depends on this one, uninstall is
blocked with a `DependencyConstraint` error.

## Conflict Detection

On install, every `global_capability_id` in the plugin's `capabilities_config`
is checked against existing capabilities from other providers. If a duplicate
is found, install is refused with `CapabilityConflict`.
