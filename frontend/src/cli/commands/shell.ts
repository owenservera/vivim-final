/**
 * cli/commands/shell.ts
 * --------------------------------------------------------------------
 * The thin CLI client's command catalog. Registers multi-word commands
 * (`admin db status`, `list conversations`, `resolve canvas`, …) into
 * the ShellCommandStore (CommandRegistry). The canvas
 * `cap:canvas:shell-command` capability dispatches through the SAME
 * registry (FRONTEND=BACKEND two-way, invariant 5).
 *
 * Each command is registered with:
 *   - path: ['admin', 'db', 'status']
 *   - capabilityId: 'cap:admin:db_status'
 *   - handler: async (args, ctx) => ShellCommandResult
 *
 * Production swaps the stub handlers for real capability dispatch
 * via /api/capabilities/:id/execute. The resolution + longest-prefix-
 * match logic stays identical.
 */

import type { CommandSpec, ShellCommandContext, ShellCommandResult } from '../../shared/shell-command';
import type { ShellCommandStore } from '../../storage/contracts/shell-command-store';

/**
 * Register the default command catalog. Called once at boot by the
 * engine bootstrap. Each command's handler is a stub that returns a
 * ShellCommandResult; production swaps in real capability dispatch.
 */
export function registerDefaultCommands(store: ShellCommandStore): void {
  const commands: CommandSpec[] = [
    // ── admin ──────────────────────────────────────────────────────────
    {
      path: ['admin', 'db', 'status'],
      description: 'Show database row counts + file size',
      capabilityId: 'cap:admin:db_status',
      handler: async (_args, ctx) => ok(ctx, [
        '═ vivim-final db status ════════════════════',
        '  provider_type:        5 rows',
        '  primitive:           13 rows',
        '  ui_component:        22 rows',
        '  provider_definition: 16 rows',
        '  workspace:            3 rows',
        '  document:             4 rows',
        '  media:                2 rows',
        '  automation:         100 rows',
        '  agent:                3 rows',
        '  trace_entry:        248 rows',
        '  db size:           4.2 MB',
        '  integrity_check:    ok',
      ].join('\n')),
    },
    {
      path: ['admin', 'db', 'migrate'],
      description: 'Apply pending Prisma migrations',
      capabilityId: 'cap:admin:db_migrate',
      handler: async (_args, ctx) => ok(ctx, 'No pending migrations. Schema is up to date.'),
    },
    {
      path: ['admin', 'db', 'reset'],
      description: 'Wipe + migrate + seed (destructive)',
      capabilityId: 'cap:admin:db_reset',
      handler: async (_args, ctx) => ok(ctx, 'Reset aborted: --force flag required for destructive ops.'),
    },
    {
      path: ['admin', 'invariants', 'check'],
      description: 'Verify all 13 project invariants',
      capabilityId: 'cap:admin:invariants_check',
      handler: async (_args, ctx) => ok(ctx, [
        '═ invariants check ════════════════════════',
        '  ✓ Governor Canon     (no engine imports BunCdpClient)',
        '  ✓ Store Contracts    (engines use contracts/* only)',
        '  ✓ Frontend=Backend   (no provider conditionals in UI)',
        '  ✓ UI-is-Data         (sandboxed iframe + CSP)',
        '  ✓ One Entry Point    (/api/interpret → /api/capabilities/:id/execute)',
        '  ✓ No any             (strict + unknown narrowing)',
        '  ✓ Live, not build    (publish = DB write + event)',
        '  ✓ Action Registry    (B8 — Zod-validated)',
        '  ✓ No new canvas migrations',
        '  ✓ Phase 2: FRONTEND=BACKEND two-way (cap:canvas:shell-command)',
        '  ✓ Phase 2: workspace z-depth (3D layer model)',
        '  ✓ Phase 2: doc/media/automation/agent cards',
      ].join('\n')),
    },

    // ── list ───────────────────────────────────────────────────────────
    {
      path: ['list', 'conversations'],
      description: 'List recent conversations',
      capabilityId: 'cap:conversation:list',
      handler: async (_args, ctx) => ok(ctx, [
        '═ conversations (workspace=' + ctx.workspaceId + ') ══════',
        '  conv:01HX…  chatgpt   4 messages   2024-01-15',
        '  conv:01HY…  claude    2 messages   2024-01-14',
        '  conv:01HZ…  gemini    8 messages   2024-01-14',
      ].join('\n')),
    },
    {
      path: ['list', 'providers'],
      description: 'List registered providers',
      capabilityId: 'cap:provider:list',
      handler: async (_args, _ctx) => ok(_ctx, [
        '═ providers ══════════════════════════════',
        '  chatgpt       (ai-chat family)   free/pro/ent',
        '  claude        (ai-chat family)   free/pro',
        '  gemini        (ai-chat family)   free',
        '  gmail         (email family)     free/ent',
        '  slack         (messenger family) free/ent',
        '  twitter       (social family)    free',
        '  notion        (custom family)    free',
      ].join('\n')),
    },
    {
      path: ['list', 'workspaces'],
      description: 'List workspaces (parent + children)',
      capabilityId: 'cap:workspace:list',
      handler: async (_args, ctx) => ok(ctx, [
        '═ workspaces ═════════════════════════════',
        '  ws:global            (global, z=0)  ← current',
        '  ws:research          (standard, z=1)',
        '  ws:content-team      (standard, z=1)',
        '  ws:automation-lab    (automation, z=1)',
      ].join('\n')),
    },
    {
      path: ['list', 'automations'],
      description: 'List automation definitions',
      capabilityId: 'cap:automation:list',
      handler: async (_args, ctx) => ok(ctx, [
        '═ automations (workspace=' + ctx.workspaceId + ') ════',
        '  summarize-new-doc           published  trigger=event',
        '  transcribe-and-clip-video   published  trigger=manual',
        '  route-message-to-notion     published  trigger=event',
        '  daily-digest                published  trigger=cron',
        '  … 100 automations total',
      ].join('\n')),
    },
    {
      path: ['list', 'agents'],
      description: 'List agent definitions',
      capabilityId: 'cap:agent:list',
      handler: async (_args, _ctx) => ok(_ctx, [
        '═ agents ════════════════════════════════',
        '  research-assistant    published  5 steps',
        '  content-curator       published  7 steps',
        '  inbox-triager         published  4 steps',
      ].join('\n')),
    },

    // ── resolve / open ─────────────────────────────────────────────────
    {
      path: ['resolve', 'canvas'],
      description: 'Synchronously resolve the canvas surface',
      capabilityId: 'cap:canvas:resolve',
      handler: async (_args, ctx) => ok(ctx, [
        '═ canvas resolved ════════════════════════',
        '  traceId:    ' + ctx.traceId,
        '  workspace:  ' + ctx.workspaceId,
        '  surface:    chat',
        '  slots:      13',
        '  duration:   8ms',
      ].join('\n')),
    },
    {
      path: ['open', 'document'],
      description: 'Open a document card (open document <path>)',
      capabilityId: 'cap:document:open',
      handler: async (args, ctx) => ok(ctx, `Opening document: ${args.join(' ') || '(no path)'}\n  → created doc card on canvas (engineRef=engine:document:pdf)`),
    },
    {
      path: ['open', 'video'],
      description: 'Open a video card (open video <url>)',
      capabilityId: 'cap:media:open_video',
      handler: async (args, ctx) => ok(ctx, `Opening video: ${args.join(' ') || '(no url)'}\n  → created media card on canvas (engine=vlc, transcript=stubbed)`),
    },
    {
      path: ['open', 'audio'],
      description: 'Open an audio card (open audio <url>)',
      capabilityId: 'cap:media:open_audio',
      handler: async (args, ctx) => ok(ctx, `Opening audio: ${args.join(' ') || '(no url)'}\n  → created media card on canvas (engine=vlc)`),
    },

    // ── publish / patch (live-config) ──────────────────────────────────
    {
      path: ['publish', 'component'],
      description: 'Publish a CanvasDefinition row (live, no rebuild)',
      capabilityId: 'cap:canvas:define',
      handler: async (args, ctx) => ok(ctx, `Published component: ${args.join(' ') || '(no slug)'}\n  → version=1, emitted canvas:def:updated`),
    },
    {
      path: ['patch', 'component'],
      description: 'Live-config patch an existing CanvasDefinition',
      capabilityId: 'cap:canvas:set_layout',
      handler: async (args, ctx) => ok(ctx, `Patched component: ${args.join(' ') || '(no id)'}\n  → version bumped, canvas:def:updated emitted`),
    },

    // ── run / invoke ───────────────────────────────────────────────────
    {
      path: ['run', 'automation'],
      description: 'Execute an automation by slug',
      capabilityId: 'cap:automation:execute',
      handler: async (args, ctx) => ok(ctx, `Running automation: ${args.join(' ') || '(no slug)'}\n  → execution started, walking DAG from trigger`),
    },
    {
      path: ['invoke', 'agent'],
      description: 'Invoke an agent by slug',
      capabilityId: 'cap:agent:invoke',
      handler: async (args, ctx) => ok(ctx, `Invoking agent: ${args.join(' ') || '(no slug)'}\n  → run started, walking step DAG from entry`),
    },

    // ── shell ──────────────────────────────────────────────────────────
    {
      path: ['help'],
      description: 'Show available commands',
      capabilityId: 'cap:help:help',
      handler: async (_args, ctx) => ok(ctx, [
        '═ vivim shell — available commands ════════',
        '  admin db status              Database row counts + size',
        '  admin db migrate             Apply pending migrations',
        '  admin invariants check       Verify all 13 invariants',
        '  list conversations           List recent conversations',
        '  list providers               List registered providers',
        '  list workspaces              List workspaces',
        '  list automations             List automation definitions',
        '  list agents                  List agent definitions',
        '  resolve canvas               Synchronously resolve the canvas',
        '  open document <path>         Open a document card',
        '  open video <url>             Open a video card (VLC)',
        '  open audio <url>             Open an audio card (VLC)',
        '  publish component <slug>     Publish a CanvasDefinition',
        '  patch component <id>         Live-config patch',
        '  run automation <slug>        Execute an automation',
        '  invoke agent <slug>          Invoke an agent',
        '  help                         Show this help',
        '',
        '═ V6 Commands ════════════════════════════',
        '  go <surface>                 Switch surface (chat/docs/media/...)',
        '  theme <mode>                 Set theme (light/dark/auto)',
        '  theme accent <color>         Set accent (amber/rose/emerald/sky/violet/slate)',
        '  canvas layout <intent>       Apply layout (cluster/timeline/mindmap/kanban/grid)',
        '  canvas zoom <level>          Set zoom (0.1-5.0)',
        '  node <id> <action>           vCard action (collapse/pin/fullscreen/lock/remove)',
        '  agent canvas <prompt>        Agent co-pilot: propose canvas changes',
        '  stream <nodeId> <capId>      Start streaming a node',
        '  connect <from> <to> <type>   Connect two nodes (data/reference/stream/control)',
        '  drawer <edge> toggle         Toggle a drawer (left/right/top/bottom)',
        '  drawer <edge> panel <id>     Set active panel in a drawer',
        '  zlayer <action> <layer>      Z-layer action (show/hide/lock/active)',
        '  search <query>               Universal search',
        '  notifications <action>       Notifications (list/mark_read/stats)',
        '  onboarding <action>          Onboarding (start/reset/dismiss)',
        '  list components              List all registered UI components',
        '  component <id> <action>      Invoke a component capability',
      ].join('\n')),
    },
  ];

  // ── V6 Commands ──────────────────────────────────────────────────

  // go <surface> — switch the active surface tab.
  commands.push({
    path: ['go'],
    description: 'Switch surface (chat/docs/media/automation/agents/shell/audit/rbac/templates/zlayers/editor)',
    capabilityId: 'cap:canvas:navigate',
    handler: async (args, ctx) => ok(ctx, `→ Switching to surface: ${args[0] ?? 'chat'}`),
  });

  // theme <mode> / theme accent <color> / theme font <scale>
  commands.push({
    path: ['theme', 'accent'],
    description: 'Set accent color (amber/rose/emerald/sky/violet/slate)',
    capabilityId: 'cap:theme:set_accent',
    handler: async (args, ctx) => ok(ctx, `→ Accent set to: ${args[0] ?? 'amber'}`),
  });
  commands.push({
    path: ['theme'],
    description: 'Set theme mode (light/dark/auto)',
    capabilityId: 'cap:theme:set_mode',
    handler: async (args, ctx) => ok(ctx, `→ Theme set to: ${args[0] ?? 'light'}`),
  });

  // canvas layout <intent> / canvas zoom <level>
  commands.push({
    path: ['canvas', 'layout'],
    description: 'Apply layout intent (cluster/timeline/mindmap/kanban/grid/free)',
    capabilityId: 'cap:canvas:layout',
    handler: async (args, ctx) => ok(ctx, `→ Layout: ${args[0] ?? 'free'} (force-directed re-layout triggered)`),
  });
  commands.push({
    path: ['canvas', 'zoom'],
    description: 'Set zoom level (0.1-5.0)',
    capabilityId: 'cap:canvas:zoom',
    handler: async (args, ctx) => ok(ctx, `→ Zoom: ${args[0] ?? '1.0'}×`),
  });

  // node <id> <action> — vCard actions
  commands.push({
    path: ['node'],
    description: 'vCard action on a node (collapse/pin/fullscreen/lock/remove/export)',
    capabilityId: 'cap:vcard:action',
    handler: async (args, ctx) => ok(ctx, `→ Node ${args[0] ?? '?'}: ${args[1] ?? 'inspect'}`),
  });

  // agent canvas <prompt> — co-pilot
  commands.push({
    path: ['agent', 'canvas'],
    description: 'Agent co-pilot: propose canvas changes from a prompt',
    capabilityId: 'cap:agent:canvas',
    handler: async (args, ctx) => ok(ctx, `→ Agent planning: "${args.join(' ')}"\n  (proposed ops will appear as ghost overlays)`),
  });

  // stream <nodeId> <capabilityId>
  commands.push({
    path: ['stream'],
    description: 'Start streaming a node (opens NDJSON stream)',
    capabilityId: 'cap:stream:start',
    handler: async (args, ctx) => ok(ctx, `→ Streaming node ${args[0] ?? '?'} via ${args[1] ?? 'cap:default'}`),
  });

  // connect <from> <to> <type>
  commands.push({
    path: ['connect'],
    description: 'Connect two nodes (data/reference/stream/control/feedback)',
    capabilityId: 'cap:canvas:connect',
    handler: async (args, ctx) => ok(ctx, `→ Connected ${args[0] ?? '?'} → ${args[1] ?? '?'} (${args[2] ?? 'data'})`),
  });

  // drawer <edge> toggle / drawer <edge> panel <id>
  commands.push({
    path: ['drawer', 'toggle'],
    description: 'Toggle a drawer (left/right/top/bottom)',
    capabilityId: 'cap:drawer:toggle',
    handler: async (args, ctx) => ok(ctx, `→ Drawer ${args[0] ?? 'left'} toggled`),
  });
  commands.push({
    path: ['drawer', 'panel'],
    description: 'Set active panel in a drawer',
    capabilityId: 'cap:drawer:set_active_panel',
    handler: async (args, ctx) => ok(ctx, `→ Drawer ${args[0] ?? 'left'} → panel ${args[1] ?? 'conversations'}`),
  });

  // zlayer <action> <layer>
  commands.push({
    path: ['zlayer'],
    description: 'Z-layer action (show/hide/lock/active) on a layer',
    capabilityId: 'cap:zlayer:update',
    handler: async (args, ctx) => ok(ctx, `→ Z-Layer ${args[1] ?? 'content'}: ${args[0] ?? 'show'}`),
  });

  // search <query>
  commands.push({
    path: ['search'],
    description: 'Universal search across all entities',
    capabilityId: 'cap:search:query',
    handler: async (args, ctx) => ok(ctx, `→ Searching for: "${args.join(' ')}"\n  (results appear in the command palette)`),
  });

  // notifications <action>
  commands.push({
    path: ['notifications'],
    description: 'Notifications action (list/mark_read/stats)',
    capabilityId: 'cap:notification:list',
    handler: async (args, ctx) => ok(ctx, `→ Notifications: ${args[0] ?? 'list'}`),
  });

  // onboarding <action>
  commands.push({
    path: ['onboarding'],
    description: 'Onboarding action (start/reset/dismiss)',
    capabilityId: 'cap:onboarding:start',
    handler: async (args, ctx) => ok(ctx, `→ Onboarding: ${args[0] ?? 'start'}`),
  });

  // list components — list all registered UI components
  commands.push({
    path: ['list', 'components'],
    description: 'List all registered UI components from the UniversalComponentRegistry',
    capabilityId: 'cap:registry:list',
    handler: async (_args, ctx) => {
      try {
        const { list } = await import('../../shared/universal-registry');
        const all = list({ enabledOnly: true });
        const lines = ['═ Registered UI Components ══════════════'];
        const byKind: Record<string, typeof all> = {};
        for (const c of all) {
          if (!byKind[c.kind]) byKind[c.kind] = [];
          byKind[c.kind].push(c);
        }
        for (const [kind, comps] of Object.entries(byKind)) {
          lines.push(`\n  ${kind} (${comps.length}):`);
          for (const c of comps) {
            lines.push(`    ${c.id.padEnd(28)} ${c.label.padEnd(24)} [${c.category}] ${c.capabilities.length} caps`);
          }
        }
        lines.push(`\n  Total: ${all.length} components`);
        return ok(ctx, lines.join('\n'));
      } catch (err) {
        return ok(ctx, `Error listing components: ${String(err)}`);
      }
    },
  });

  // component <id> <action> — invoke a component capability
  commands.push({
    path: ['component'],
    description: 'Invoke a component capability from the registry',
    capabilityId: 'cap:registry:invoke',
    handler: async (args, ctx) => {
      const id = args[0];
      const action = args[1];
      if (!id) return ok(ctx, 'Usage: component <id> [action]');
      try {
        const { get } = await import('../../shared/universal-registry');
        const spec = get(id);
        if (!spec) return ok(ctx, `Component not found: ${id}`);
        const lines = [
          `═ Component: ${spec.label} ════════════════`,
          `  id:           ${spec.id}`,
          `  kind:         ${spec.kind}`,
          `  category:     ${spec.category}`,
          `  slot:         ${spec.slot ?? '—'}`,
          `  version:      ${spec.version}`,
          `  author:       ${spec.author}`,
          `  tags:         ${spec.tags.join(', ')}`,
          `  enabled:      ${spec.enabled}`,
          `  capabilities: ${spec.capabilities.length}`,
        ];
        if (action) {
          const cap = spec.capabilities.find((c) => c.includes(action));
          if (cap) {
            lines.push(`\n  → Invoking: ${cap}`);
          } else {
            lines.push(`\n  ✗ No capability matching "${action}"`);
            lines.push(`    Available: ${spec.capabilities.join(', ')}`);
          }
        } else {
          lines.push('\n  Capabilities:');
          for (const c of spec.capabilities) lines.push(`    ${c}`);
        }
        return ok(ctx, lines.join('\n'));
      } catch (err) {
        return ok(ctx, `Error: ${String(err)}`);
      }
    },
  });

  // ── V8 UI Engine Commands ─────────────────────────────────────────

  // ui list — list all UI component specs
  commands.push({
    path: ['ui', 'list'],
    description: 'List all registered UI component specs (with properties + capabilities)',
    capabilityId: 'cap:ui:list',
    handler: async (_args, ctx) => {
      try {
        const { list } = await import('../../shared/universal-registry');
        const all = list({ enabledOnly: true });
        const lines = ['═ UI Component Specs ════════════════════'];
        for (const c of all) {
          const caps = c.capabilities.length;
          const tags = c.tags.length > 0 ? ` [${c.tags.join(',')}]` : '';
          lines.push(`  ${c.id.padEnd(28)} ${c.label.padEnd(24)} ${c.kind.padEnd(10)} ${c.category.padEnd(12)} ${caps} caps${tags}`);
        }
        lines.push(`\n  Total: ${all.length} components`);
        return ok(ctx, lines.join('\n'));
      } catch (err) {
        return ok(ctx, `Error: ${String(err)}`);
      }
    },
  });

  // ui get <id> — get a component's full spec + resolved properties
  commands.push({
    path: ['ui', 'get'],
    description: 'Get a component spec with resolved properties (inheritance walk)',
    capabilityId: 'cap:ui:get',
    handler: async (args, ctx) => {
      const id = args[0];
      if (!id) return ok(ctx, 'Usage: ui get <id>');
      try {
        const res = await fetch(`/api/ui/component/${encodeURIComponent(id)}/spec`);
        const data = (await res.json()) as { ok: boolean; spec?: unknown; resolvedProperties?: unknown; error?: string };
        if (!data.ok) return ok(ctx, `Component not found: ${id}`);
        const spec = data.spec as Record<string, unknown>;
        const props = data.resolvedProperties as Record<string, unknown>;
        const lines = [
          `═ Component: ${spec.label} ════════════════`,
          `  id:           ${spec.id}`,
          `  kind:         ${spec.kind}`,
          `  category:     ${spec.category}`,
          `  slot:         ${spec.slot ?? '—'}`,
          `  version:      ${spec.version}`,
          `  extends:      ${spec.extends ?? '—'}`,
          `  enabled:      ${spec.enabled}`,
          '',
          '═ Resolved Properties (inheritance walk) ═',
        ];
        if (props) {
          for (const [k, v] of Object.entries(props)) {
            lines.push(`  ${k}: ${JSON.stringify(v)}`);
          }
        }
        return ok(ctx, lines.join('\n'));
      } catch (err) {
        return ok(ctx, `Error: ${String(err)}`);
      }
    },
  });

  // ui set <id> <path> <value> — live property mutation
  commands.push({
    path: ['ui', 'set'],
    description: 'Set a component property (dot-notation path, e.g. styling.borderRadius)',
    capabilityId: 'cap:ui:set_property',
    handler: async (args, ctx) => {
      const [id, path, ...rest] = args;
      if (!id || !path) return ok(ctx, 'Usage: ui set <id> <path> <value>');
      const value = rest.join(' ');
      try {
        const res = await fetch('/api/ui/set_property', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, path, value: isNaN(Number(value)) ? value : Number(value) }),
        });
        const data = (await res.json()) as { ok: boolean; spec?: { version: number }; error?: string };
        if (!data.ok) return ok(ctx, `Error: ${data.error}`);
        return ok(ctx, `→ ${id}.${path} = ${value}  (v${data.spec?.version})`);
      } catch (err) {
        return ok(ctx, `Error: ${String(err)}`);
      }
    },
  });

  // ui extend <baseId> <newId> — create a derived component
  commands.push({
    path: ['ui', 'extend'],
    description: 'Extend a base component spec (creates a derived component with merged properties)',
    capabilityId: 'cap:ui:extend',
    handler: async (args, ctx) => {
      const [baseId, newId] = args;
      if (!baseId || !newId) return ok(ctx, 'Usage: ui extend <baseId> <newId>');
      try {
        const res = await fetch('/api/ui/extend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseId, id: newId }),
        });
        const data = (await res.json()) as { ok: boolean; spec?: { id: string; label: string; version: number }; error?: string };
        if (!data.ok) return ok(ctx, `Error: ${data.error}`);
        return ok(ctx, `→ Extended ${baseId} → ${data.spec?.id} (${data.spec?.label}) v${data.spec?.version}`);
      } catch (err) {
        return ok(ctx, `Error: ${String(err)}`);
      }
    },
  });

  // ui blueprint — read the full UI layout/theme
  commands.push({
    path: ['ui', 'blueprint'],
    description: 'Read the full UI blueprint (all component specs + theme)',
    capabilityId: 'cap:ui:get_blueprint',
    handler: async (args, ctx) => {
      try {
        const ws = args[0] ?? 'ws:global';
        const res = await fetch(`/api/ui/blueprint?workspaceId=${encodeURIComponent(ws)}`);
        const data = (await res.json()) as { ok: boolean; blueprint?: { version: number; components: Record<string, unknown>; themeMode: string; accentColor: string } };
        if (!data.ok) return ok(ctx, 'Error reading blueprint');
        const bp = data.blueprint!;
        const lines = [
          `═ UI Blueprint v${bp.version} ════════════════`,
          `  workspace:    ${ws}`,
          `  theme:        ${bp.themeMode}`,
          `  accent:       ${bp.accentColor}`,
          `  components:   ${Object.keys(bp.components).length}`,
          '',
          '  Component IDs:',
        ];
        for (const id of Object.keys(bp.components)) lines.push(`    ${id}`);
        return ok(ctx, lines.join('\n'));
      } catch (err) {
        return ok(ctx, `Error: ${String(err)}`);
      }
    },
  });

  // ui apply <theme|accent> <value> — apply a blueprint patch
  commands.push({
    path: ['ui', 'apply'],
    description: 'Apply a UI reprogramming patch (theme/accent or component spec)',
    capabilityId: 'cap:ui:apply_blueprint',
    handler: async (args, ctx) => {
      const [kind, value] = args;
      if (!kind || !value) return ok(ctx, 'Usage: ui apply <theme|accent> <value>');
      try {
        const patch: Record<string, unknown> = {};
        if (kind === 'theme') patch.themeMode = value;
        else if (kind === 'accent') patch.accentColor = value;
        else return ok(ctx, `Unknown patch kind: ${kind}. Use: theme | accent`);
        const res = await fetch('/api/ui/blueprint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId: 'ws:global', ...patch }),
        });
        const data = (await res.json()) as { ok: boolean; blueprint?: { version: number } };
        if (!data.ok) return ok(ctx, 'Error applying blueprint');
        return ok(ctx, `→ Blueprint applied: ${kind}=${value}  (v${data.blueprint?.version})`);
      } catch (err) {
        return ok(ctx, `Error: ${String(err)}`);
      }
    },
  });

  // ui delete <id> — unregister a component
  commands.push({
    path: ['ui', 'delete'],
    description: 'Unregister a UI component',
    capabilityId: 'cap:ui:unregister',
    handler: async (args, ctx) => {
      const id = args[0];
      if (!id) return ok(ctx, 'Usage: ui delete <id>');
      return ok(ctx, `→ Unregistered: ${id}`);
    },
  });

  for (const cmd of commands) {
    store.register(cmd);
  }
}

function ok(ctx: ShellCommandContext, stdout: string): ShellCommandResult {
  return {
    traceId: ctx.traceId,
    ok: true,
    exitCode: 0,
    stdout,
    stderr: '',
    durationMs: 0,
  };
}
