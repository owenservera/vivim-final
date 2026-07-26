// src/engines/provider-protocol-generator.ts
// Reads provider protocol data from DB, generates static TypeScript file.
// Only includes providers where protocol_status = 'Active'.

import { existsSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getLogger } from '../lib/logger.js'
import type { CapStoreDb } from '../storage/db.js'

const log = getLogger('provider-protocol-generator')

// ── Generated Protocol Types ─────────────────────────────────────────

export interface ProviderProtocol {
  schemaVersion: 1
  generatedAt: number
  providerCount: number
  providers: ProviderProtocolEntry[]
}

export interface ProviderProtocolEntry {
  slug: string
  displayName: string
  description: string | null
  category: string
  providerType: string
  authType: string
  websiteUrl: string | null
  profileStrategy: string
  hasMultiAccount: boolean
  isActive: boolean

  urlPattern: string
  url: string
  loginUrl: string

  composerSelectors: string[]
  sendButtonSelectors: string[]
  loginIndicator: {
    urlPattern: string
    loggedInSelector?: string
    loggedOutSelector?: string
  } | null

  endpoints: EndpointEntry[]
  parsers: ParserModuleEntry[]
  streamConfigs: StreamConfigEntry[]
  capabilities: CapabilityBindingEntry[]
  config: Record<string, string>
}

export interface EndpointEntry {
  label: string
  url: string
  endpointType: string
  isDefault: boolean
  composerSelector?: string
  sendButtonSelector?: string
  composerType: string
  sendMethod: string
  contentEditable: boolean
}

export interface ParserModuleEntry {
  name: string
  version: number
  logicCode: string
  hash: string
  isActive: boolean
  fallbackParserName?: string
}

export interface StreamConfigEntry {
  transport: string
  streamTerminal: string[]
  sseFormat?: string
  deltaPath?: string
  contentType?: string
  completionDetectors: string[]
  harnessJs?: string
}

export interface CapabilityBindingEntry {
  globalCapabilityId: string
  recoveryStrategies: unknown[]
  uiComponentOverride?: string
  uiLabelOverride?: string
  uiIconOverride?: string
  uiPositionOverride?: string
  uiOrderOverride?: number
  uiGroupOverride?: string
  uiPriorityOverride?: string
  interactionModeOverride?: string
  existentialRuleOverride?: string
  minPlanTierOverride?: string
  confidence: number
}

export interface GeneratedProtocolResult {
  providerCount: number
  fileSize: number
  outputPath: string
  devOutputPath: string
}

// ── Raw DB Row Types ─────────────────────────────────────────────────

interface DefRow {
  id: string
  slug: string
  display_name: string
  description: string | null
  category: string
  provider_type: string
  auth_type: string
  website_url: string | null
  profile_strategy: string
  has_multi_account: number
}

interface EndpointRow {
  provider_id: string
  label: string
  url: string
  endpoint_type: string
  is_default: number
  selectors_json: string
  composer_type: string
  send_method: string
  content_editable: number
}

interface ParserRow {
  provider_id: string
  parser_name: string
  parser_version: number
  parser_logic_code: string | null
  parser_hash: string | null
  is_active: number
  fallback_parser_name: string | null
}

interface CapabilityRow {
  provider_id: string
  global_capability_id: string
  recovery_strategies_json: string
  ui_component_override: string | null
  ui_label_override: string | null
  ui_icon_override: string | null
  ui_position_override: string | null
  ui_order_override: number | null
  ui_group_override: string | null
  ui_priority_override: string | null
  interaction_mode_override: string | null
  existential_rule_override: string | null
  min_plan_tier_override: string | null
  confidence: number
}

interface StreamConfigRow {
  provider_id: string
  stream_transport: string
  stream_terminal_json: string
  sse_format: string | null
  delta_path_json: string | null
  content_type: string | null
  completion_detectors_json: string
  harness_js: string | null
}

interface ConfigRow {
  provider_id: string
  config_key: string
  config_value: string
}

// ── Generator ────────────────────────────────────────────────────────

export class ProviderProtocolGenerator {
  constructor(private db: CapStoreDb) {}

  /**
   * Generate the static protocol files.
   *
   * `provider-protocol.ts` (prod) is ALWAYS overwritten from the DB — it is a pure
   * compilation of the single source of truth.
   *
   * `provider-protocol.dev.ts` (dev clone) is the editable override layer used during
   * testing/devops: `PROVIDER_PROTOCOL_SOURCE=dev` makes the whole system read it so
   * fixes and theories can be tracked without touching the DB. By default we PRESERVE
   * any existing dev clone (it carries human edits); pass `overwriteDev=true` (or run
   * `gen:protocol --reset-dev`) to resync the dev clone from the freshly-generated prod.
   */
  async generate(opts: { overwriteDev?: boolean } = {}): Promise<GeneratedProtocolResult> {
    const protocol = await this.collectFromDb()
    const rendered = this.render(protocol)
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const outputDir = resolve(__dirname, '../../src/__generated__')
    const outputPath = resolve(outputDir, 'provider-protocol.ts')
    const devOutputPath = resolve(outputDir, 'provider-protocol.dev.ts')

    writeFileSync(outputPath, rendered, 'utf-8')

    // Preserve the dev clone unless explicitly reset. This is what lets the devops
    // workflow overlay fixes on the dev file and promote them later (dev → DB → prod).
    const devExists = existsSync(devOutputPath)
    if (opts.overwriteDev || !devExists) {
      writeFileSync(devOutputPath, rendered, 'utf-8')
    }

    // Format the generated files so they pass `bun run lint` (Biome quote-style) without
    // manual edits. Best-effort: if the Biome binary is unavailable, the files still compile.
    const toFormat = opts.overwriteDev || !devExists ? [outputPath, devOutputPath] : [outputPath]
    await this.formatGenerated(toFormat)

    return {
      providerCount: protocol.providerCount,
      fileSize: Buffer.byteLength(rendered, 'utf-8'),
      outputPath,
      devOutputPath,
    }
  }

  private async formatGenerated(paths: string[]): Promise<void> {
    try {
      const proc = Bun.spawn(['bunx', 'biome', 'check', '--write', ...paths], {
        stdout: 'ignore',
        stderr: 'ignore',
      })
      await proc.exited
    } catch {
      // Non-fatal: generated output remains valid TypeScript even if formatting is skipped.
    }
  }

  async collectFromDb(): Promise<ProviderProtocol> {
    const generatedAt = Date.now()

    // Query 1: Active provider definitions
    const defRows = await this.db.prisma.$queryRawUnsafe<DefRow[]>(
      "SELECT id, slug, display_name, description, category, provider_type, auth_type, website_url, profile_strategy, has_multi_account FROM provider_definition WHERE protocol_status = 'Active' ORDER BY slug",
    )

    if (defRows.length === 0) {
      return { schemaVersion: 1, generatedAt, providerCount: 0, providers: [] }
    }

    const _slugs = defRows.map((r) => `'${r.slug.replace(/'/g, "''")}'`).join(',')
    const providerIds = defRows.map((r) => `'${r.id.replace(/'/g, "''")}'`).join(',')

    // Query 2: Endpoints for all active providers
    const epRows = await this.db.prisma.$queryRawUnsafe<EndpointRow[]>(
      `SELECT provider_id, label, url, endpoint_type, is_default, selectors_json, composer_type, send_method, content_editable FROM provider_endpoint WHERE provider_id IN (${providerIds}) ORDER BY provider_id, is_default DESC`,
    )

    // Query 3: Parsers for all active providers
    const parserRows = await this.db.prisma.$queryRawUnsafe<ParserRow[]>(
      `SELECT pp.provider_id, pp.parser_name, pp.parser_version, pp.parser_logic_code, pp.parser_hash, pp.is_active, fp.parser_name AS fallback_parser_name FROM provider_parser pp LEFT JOIN provider_parser fp ON pp.fallback_parser_id = fp.id WHERE pp.provider_id IN (${providerIds}) ORDER BY pp.provider_id, pp.parser_version DESC`,
    )

    // Query 4: Capabilities for all active providers
    const capRows = await this.db.prisma.$queryRawUnsafe<CapabilityRow[]>(
      `SELECT provider_id, global_capability_id, recovery_strategies_json, ui_component_override, ui_label_override, ui_icon_override, ui_position_override, ui_order_override, ui_group_override, ui_priority_override, interaction_mode_override, existential_rule_override, min_plan_tier_override, confidence FROM provider_capability WHERE provider_id IN (${providerIds}) ORDER BY provider_id`,
    )

    // Query 5: Stream configs + configs for all active providers
    const scRows = await this.db.prisma.$queryRawUnsafe<StreamConfigRow[]>(
      `SELECT provider_id, stream_transport, stream_terminal_json, sse_format, delta_path_json, content_type, completion_detectors_json, harness_js FROM provider_stream_config WHERE provider_id IN (${providerIds}) AND is_active = 1 ORDER BY provider_id`,
    )

    const cfgRows = await this.db.prisma.$queryRawUnsafe<ConfigRow[]>(
      `SELECT provider_id, config_key, config_value FROM provider_config WHERE provider_id IN (${providerIds}) ORDER BY provider_id, config_key`,
    )

    // Index related rows by provider id
    const epsByProvider = new Map<string, EndpointRow[]>()
    for (const r of epRows) {
      const list = epsByProvider.get(r.provider_id) ?? []
      list.push(r)
      epsByProvider.set(r.provider_id, list)
    }

    const parsersByProvider = new Map<string, ParserRow[]>()
    for (const r of parserRows) {
      const list = parsersByProvider.get(r.provider_id) ?? []
      list.push(r)
      parsersByProvider.set(r.provider_id, list)
    }

    const capsByProvider = new Map<string, CapabilityRow[]>()
    for (const r of capRows) {
      const list = capsByProvider.get(r.provider_id) ?? []
      list.push(r)
      capsByProvider.set(r.provider_id, list)
    }

    const scsByProvider = new Map<string, StreamConfigRow[]>()
    for (const r of scRows) {
      const list = scsByProvider.get(r.provider_id) ?? []
      list.push(r)
      scsByProvider.set(r.provider_id, list)
    }

    const configsByProvider = new Map<string, Map<string, string>>()
    for (const r of cfgRows) {
      const inner = configsByProvider.get(r.provider_id) ?? new Map<string, string>()
      inner.set(r.config_key, r.config_value)
      configsByProvider.set(r.provider_id, inner)
    }

    const providers: ProviderProtocolEntry[] = []

    for (const def of defRows) {
      const eps = epsByProvider.get(def.id) ?? []
      const chatEp = eps.find((e) => e.endpoint_type === 'chat')
      const loginEp = eps.find((e) => e.endpoint_type === 'login')

      const baseUrl = def.website_url || `https://${def.slug}.com`

      // Build selectors from endpoints
      const composerSelectors: string[] = []
      const sendButtonSelectors: string[] = []
      for (const ep of eps) {
        const sel = JSON.parse(ep.selectors_json || '{}')
        if (sel.composer && !composerSelectors.includes(sel.composer))
          composerSelectors.push(sel.composer)
        if (sel.send_button && !sendButtonSelectors.includes(sel.send_button))
          sendButtonSelectors.push(sel.send_button)
      }
      // Apply composer-type fallbacks
      if (chatEp) {
        if (chatEp.composer_type === 'quill') {
          if (!composerSelectors.some((s) => s.includes('ql-editor')))
            composerSelectors.push('div.ql-editor[contenteditable="true"]')
        } else if (chatEp.content_editable) {
          if (!composerSelectors.some((s) => s.includes('contenteditable')))
            composerSelectors.push('div[contenteditable="true"]')
        }
      }
      if (!composerSelectors.some((s) => s.includes('textarea'))) composerSelectors.push('textarea')
      if (!sendButtonSelectors.some((s) => s.includes('submit')))
        sendButtonSelectors.push('button[type="submit"]')

      const urlPattern = `^${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`

      providers.push({
        slug: def.slug,
        displayName: def.display_name,
        description: def.description,
        category: def.category,
        providerType: def.provider_type,
        authType: def.auth_type,
        websiteUrl: def.website_url,
        profileStrategy: def.profile_strategy,
        hasMultiAccount: def.has_multi_account === 1,
        isActive: true,
        urlPattern,
        url: chatEp?.url ?? baseUrl,
        loginUrl: loginEp?.url ?? `${baseUrl}/login`,
        composerSelectors,
        sendButtonSelectors,
        loginIndicator: {
          urlPattern: 'login|auth|signin|sign-in',
        },
        endpoints: eps.map((e) => ({
          label: e.label,
          url: e.url,
          endpointType: e.endpoint_type,
          isDefault: e.is_default === 1,
          composerSelector: (JSON.parse(e.selectors_json || '{}') as Record<string, string>)
            .composer,
          sendButtonSelector: (JSON.parse(e.selectors_json || '{}') as Record<string, string>)
            .send_button,
          composerType: e.composer_type,
          sendMethod: e.send_method,
          contentEditable: e.content_editable === 1,
        })),
        parsers: (parsersByProvider.get(def.id) ?? []).map((p) => ({
          name: p.parser_name,
          version: p.parser_version,
          logicCode: p.parser_logic_code ?? '',
          hash: p.parser_hash ?? '',
          isActive: p.is_active === 1,
          fallbackParserName: p.fallback_parser_name ?? undefined,
        })),
        streamConfigs: (scsByProvider.get(def.id) ?? []).map((sc) => ({
          transport: sc.stream_transport,
          streamTerminal: JSON.parse(sc.stream_terminal_json || '[]'),
          sseFormat: sc.sse_format ?? undefined,
          deltaPath: sc.delta_path_json ?? undefined,
          contentType: sc.content_type ?? undefined,
          completionDetectors: JSON.parse(sc.completion_detectors_json || '[]'),
          harnessJs: sc.harness_js ?? undefined,
        })),
        capabilities: (capsByProvider.get(def.id) ?? []).map((c) => ({
          globalCapabilityId: c.global_capability_id,
          recoveryStrategies: JSON.parse(c.recovery_strategies_json || '[]'),
          uiComponentOverride: c.ui_component_override ?? undefined,
          uiLabelOverride: c.ui_label_override ?? undefined,
          uiIconOverride: c.ui_icon_override ?? undefined,
          uiPositionOverride: c.ui_position_override ?? undefined,
          uiOrderOverride: c.ui_order_override ?? undefined,
          uiGroupOverride: c.ui_group_override ?? undefined,
          uiPriorityOverride: c.ui_priority_override ?? undefined,
          interactionModeOverride: c.interaction_mode_override ?? undefined,
          existentialRuleOverride: c.existential_rule_override ?? undefined,
          minPlanTierOverride: c.min_plan_tier_override ?? undefined,
          confidence: c.confidence,
        })),
        config: Object.fromEntries(configsByProvider.get(def.id) ?? new Map()),
      })
    }

    return {
      schemaVersion: 1,
      generatedAt,
      providerCount: providers.length,
      providers,
    }
  }

  render(protocol: ProviderProtocol): string {
    const esc = (s: string): string => JSON.stringify(s)

    const lines: string[] = [
      '// Auto-generated by ProviderProtocolGenerator — DO NOT EDIT',
      `// Generated at: ${new Date(protocol.generatedAt).toISOString()}`,
      `// Providers: ${protocol.providerCount}`,
      '',
      "import type { ProviderProtocol } from '../engines/provider-protocol-generator.js'",
      '',
      'const _protocol: ProviderProtocol = {',
      '  schemaVersion: 1 as const,',
      `  generatedAt: ${protocol.generatedAt},`,
      `  providerCount: ${protocol.providerCount},`,
      '  providers: [',
    ]

    for (const p of protocol.providers) {
      lines.push('    {')
      lines.push(`      slug: ${esc(p.slug)},`)
      lines.push(`      displayName: ${esc(p.displayName)},`)
      lines.push(`      description: ${esc(p.description ?? '')},`)
      lines.push(`      category: ${esc(p.category)},`)
      lines.push(`      providerType: ${esc(p.providerType)},`)
      lines.push(`      authType: ${esc(p.authType)},`)
      lines.push(`      websiteUrl: ${esc(p.websiteUrl ?? '')},`)
      lines.push(`      profileStrategy: ${esc(p.profileStrategy)},`)
      lines.push(`      hasMultiAccount: ${String(p.hasMultiAccount)},`)
      lines.push(`      isActive: ${String(p.isActive)},`)
      lines.push(`      urlPattern: ${esc(p.urlPattern)},`)
      lines.push(`      url: ${esc(p.url)},`)
      lines.push(`      loginUrl: ${esc(p.loginUrl)},`)
      lines.push(`      composerSelectors: ${JSON.stringify(p.composerSelectors)},`)
      lines.push(`      sendButtonSelectors: ${JSON.stringify(p.sendButtonSelectors)},`)
      lines.push(`      loginIndicator: ${JSON.stringify(p.loginIndicator)},`)
      lines.push('      endpoints: [')
      for (const e of p.endpoints) {
        lines.push('        {')
        lines.push(`          label: ${esc(e.label)},`)
        lines.push(`          url: ${esc(e.url)},`)
        lines.push(`          endpointType: ${esc(e.endpointType)},`)
        lines.push(`          isDefault: ${String(e.isDefault)},`)
        lines.push(`          composerSelector: ${esc(e.composerSelector ?? '')},`)
        lines.push(`          sendButtonSelector: ${esc(e.sendButtonSelector ?? '')},`)
        lines.push(`          composerType: ${esc(e.composerType)},`)
        lines.push(`          sendMethod: ${esc(e.sendMethod)},`)
        lines.push(`          contentEditable: ${String(e.contentEditable)},`)
        lines.push('        },')
      }
      lines.push('      ],')
      lines.push('      parsers: [')
      for (const pr of p.parsers) {
        lines.push('        {')
        lines.push(`          name: ${esc(pr.name)},`)
        lines.push(`          version: ${pr.version},`)
        lines.push(`          logicCode: ${esc(pr.logicCode)},`)
        lines.push(`          hash: ${esc(pr.hash)},`)
        lines.push(`          isActive: ${String(pr.isActive)},`)
        lines.push(`          fallbackParserName: ${esc(pr.fallbackParserName ?? '')},`)
        lines.push('        },')
      }
      lines.push('      ],')
      lines.push('      streamConfigs: [')
      for (const sc of p.streamConfigs) {
        lines.push('        {')
        lines.push(`          transport: ${esc(sc.transport)},`)
        lines.push(`          streamTerminal: ${JSON.stringify(sc.streamTerminal)},`)
        lines.push(`          sseFormat: ${esc(sc.sseFormat ?? '')},`)
        lines.push(`          deltaPath: ${esc(sc.deltaPath ?? '')},`)
        lines.push(`          contentType: ${esc(sc.contentType ?? '')},`)
        lines.push(`          completionDetectors: ${JSON.stringify(sc.completionDetectors)},`)
        lines.push(`          harnessJs: ${esc(sc.harnessJs ?? '')},`)
        lines.push('        },')
      }
      lines.push('      ],')
      lines.push('      capabilities: [')
      for (const c of p.capabilities) {
        lines.push('        {')
        lines.push(`          globalCapabilityId: ${esc(c.globalCapabilityId)},`)
        lines.push(`          recoveryStrategies: ${JSON.stringify(c.recoveryStrategies)},`)
        lines.push(`          uiComponentOverride: ${esc(c.uiComponentOverride ?? '')},`)
        lines.push(`          uiLabelOverride: ${esc(c.uiLabelOverride ?? '')},`)
        lines.push(`          uiIconOverride: ${esc(c.uiIconOverride ?? '')},`)
        lines.push(`          uiPositionOverride: ${esc(c.uiPositionOverride ?? '')},`)
        lines.push(`          uiOrderOverride: ${c.uiOrderOverride ?? 'undefined'},`)
        lines.push(`          uiGroupOverride: ${esc(c.uiGroupOverride ?? '')},`)
        lines.push(`          uiPriorityOverride: ${esc(c.uiPriorityOverride ?? '')},`)
        lines.push(`          interactionModeOverride: ${esc(c.interactionModeOverride ?? '')},`)
        lines.push(`          existentialRuleOverride: ${esc(c.existentialRuleOverride ?? '')},`)
        lines.push(`          minPlanTierOverride: ${esc(c.minPlanTierOverride ?? '')},`)
        lines.push(`          confidence: ${c.confidence},`)
        lines.push('        },')
      }
      lines.push('      ],')
      lines.push(`      config: ${JSON.stringify(p.config)},`)
      lines.push('    },')
    }

    lines.push('  ],')
    lines.push('}')
    lines.push('')
    lines.push('export default _protocol')
    lines.push('export const protocol = _protocol')
    lines.push('')

    return lines.join('\n')
  }
}

// ── CLI Entry Point ─────────────────────────────────────────────────

// When run directly via `bun run src/engines/provider-protocol-generator.ts`
if (import.meta.main) {
  const { getPrisma } = await import('../storage/prisma.js')
  const _prisma = getPrisma()
  const db = new (await import('../storage/db.js')).CapStoreDb()
  const generator = new ProviderProtocolGenerator(db)

  // `--reset-dev` resyncs the editable .dev.ts clone from the freshly-generated prod
  // (overwriting any local dev edits). By default the dev clone is preserved.
  const overwriteDev = process.argv.includes('--reset-dev')

  try {
    const result = await generator.generate({ overwriteDev })
    log.info(
      `Generated ${result.providerCount} providers at ${result.outputPath} (${result.fileSize} bytes)`,
    )
    log.info(
      overwriteDev
        ? `Dev copy reset at ${result.devOutputPath}`
        : `Dev copy preserved at ${result.devOutputPath}`,
    )
    process.exit(0)
  } catch (err) {
    log.error({ err }, 'Protocol generation failed')
    process.exit(1)
  }
}
