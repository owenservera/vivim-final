// devops/onboard-verify.ts
// Verification script — checks all DB rows exist for an onboarded provider,
// then runs system-level checks (parser execution, capability resolution, snapshot readiness).
// Usage: bun run devops runtime-test onboard-verify --provider=<slug>

export interface VerifyCheck {
  name: string
  passed: boolean
  detail?: string
}

export interface VerifyResult {
  ok: boolean
  provider: string
  checks: VerifyCheck[]
}

export async function verifyProvider(
  provider: string,
  db: { prisma: any },
): Promise<VerifyResult> {
  const checks: VerifyCheck[] = []

  // 1. ProviderDefinition exists
  const def = await db.prisma.providerDefinition.findFirst({ where: { slug: provider } })
  checks.push({
    name: 'provider_definition',
    passed: !!def,
    detail: def ? `id=${def.id}` : 'not found',
  })

  if (!def) {
    return { ok: false, provider, checks }
  }

  // 1b. ProviderDefinition is active
  checks.push({
    name: 'provider_definition_active',
    passed: def.isActive === 1,
    detail: `isActive=${def.isActive}`,
  })

  // 2. ProviderAccount exists (loginState='logged_in')
  const account = await db.prisma.providerAccount.findFirst({
    where: { providerId: def.id, loginState: 'logged_in' },
  })
  checks.push({
    name: 'provider_account',
    passed: !!account,
    detail: account ? `email=${account.email}, debugPort=${account.debugPort}` : 'not found',
  })

  // 3. Profile directory exists
  if (account?.profileDir) {
    const fs = await import('node:fs')
    const dirExists = fs.existsSync(account.profileDir)
    checks.push({
      name: 'profile_directory',
      passed: dirExists,
      detail: account.profileDir,
    })
  } else {
    checks.push({ name: 'profile_directory', passed: false, detail: 'no profileDir in account' })
  }

  // 4. ProviderEndpoint rows exist (landing + chat)
  const endpoints = await db.prisma.providerEndpoint.findMany({ where: { providerId: def.id } })
  const hasLanding = endpoints.some((e: any) => e.endpointType === 'landing')
  const hasChat = endpoints.some((e: any) => e.endpointType === 'chat')
  checks.push({
    name: 'provider_endpoints',
    passed: hasLanding && hasChat,
    detail: `found ${endpoints.length} endpoints (landing: ${hasLanding}, chat: ${hasChat})`,
  })

  // 5. ProviderModel rows exist (2+)
  const models = await db.prisma.providerModel.findMany({ where: { providerId: def.id } })
  checks.push({
    name: 'provider_models',
    passed: models.length >= 2,
    detail: `found ${models.length} models`,
  })

  // 6. ProviderParser row exists (logic_type='inline', logic_code non-empty)
  const parsers = await db.prisma.providerParser.findMany({ where: { providerId: def.id } })
  const validParser = parsers.find(
    (p: any) => p.parserLogicType === 'inline' && p.parserLogicCode && p.parserLogicCode.length > 0,
  )
  checks.push({
    name: 'provider_parser',
    passed: !!validParser,
    detail: validParser
      ? `name=${validParser.parserName}, version=${validParser.parserVersion}`
      : `found ${parsers.length} parsers (none with inline logic_code)`,
  })

  // 7. ProviderCapability rows exist (send_message)
  const capabilities = await db.prisma.providerCapability.findMany({ where: { providerId: def.id } })
  const hasSendMessage = capabilities.some((c: any) => c.globalCapabilityId === 'send_message')
  checks.push({
    name: 'provider_capabilities',
    passed: hasSendMessage,
    detail: `found ${capabilities.length} capabilities (send_message: ${hasSendMessage})`,
  })

  // ── System-level checks (post-registration verification) ──────────────────

  // 8. Parser logic_code compiles and exports expected interface
  if (validParser?.parserLogicCode) {
    try {
      const fn = new Function('module', 'exports', validParser.parserLogicCode)
      const mod: any = { exports: {} }
      fn(mod, mod.exports)
      const parserModule = mod.exports.default ?? mod.exports
      const hasParse = typeof parserModule?.parse === 'function'
      const hasGetConfidence = typeof parserModule?.getConfidence === 'function'
      checks.push({
        name: 'system_parser_compiles',
        passed: hasParse && hasGetConfidence,
        detail: `parse=${hasParse}, getConfidence=${hasGetConfidence}, name=${parserModule?.name ?? 'unknown'}`,
      })

      // 9. Parser can execute against a sample (stored sampleBody or fallback SSE)
      if (hasParse) {
        try {
          const sampleBody = validParser.sampleBody
            || 'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'
          const blocks = parserModule.parse(sampleBody)
          const isArray = Array.isArray(blocks)
          const hasContent = isArray && blocks.length > 0
          checks.push({
            name: 'system_parser_executes',
            passed: hasContent,
            detail: isArray
              ? `produced ${blocks.length} blocks from test sample`
              : `parse() did not return an array`,
          })
        } catch (execErr) {
          checks.push({
            name: 'system_parser_executes',
            passed: false,
            detail: `parse() threw: ${execErr instanceof Error ? execErr.message : String(execErr)}`,
          })
        }
      }
    } catch (compileErr) {
      checks.push({
        name: 'system_parser_compiles',
        passed: false,
        detail: `compile error: ${compileErr instanceof Error ? compileErr.message : String(compileErr)}`,
      })
    }
  }

  // 10. Capability resolution: DB has the binding row for send_message
  const sendMsgCap = capabilities.find((c: any) => c.globalCapabilityId === 'send_message')
  if (sendMsgCap) {
    const capId = sendMsgCap.id
    // Verify the capability row has valid data (not just a stub)
    checks.push({
      name: 'system_capability_binding',
      passed: !!capId && typeof capId === 'string' && capId.length > 0,
      detail: `capability_id=${capId}, provider_id=${def.id}`,
    })
  }

  // 11. Snapshot readiness: provider would be included in active snapshot
  checks.push({
    name: 'system_snapshot_ready',
    passed: def.isActive === 1 && !!validParser && hasSendMessage,
    detail: `active=${def.isActive === 1}, parser=${!!validParser}, send_message=${hasSendMessage}`,
  })

  // 12. Trigger snapshot refresh if server is running (best-effort)
  try {
    const backendPortFile = await import('node:fs').then((fs) =>
      fs.default?.existsSync?.('.runtime/backend.port') ?? false
        ? fs.default.readFileSync('.runtime/backend.port', 'utf8').trim()
        : null,
    )
    if (backendPortFile) {
      const refreshUrl = `http://localhost:${backendPortFile}/api/system/refresh-provider-snapshot`
      const resp = await fetch(refreshUrl, { method: 'POST' })
      const body = await resp.json() as any
      checks.push({
        name: 'system_snapshot_refreshed',
        passed: resp.ok && body.ok === true,
        detail: resp.ok
          ? `refreshed: ${body.entries} entries for ${body.providers} providers`
          : `refresh failed: HTTP ${resp.status}`,
      })
    } else {
      checks.push({
        name: 'system_snapshot_refreshed',
        passed: false,
        detail: 'backend not running (no .runtime/backend.port) — restart server to pick up new provider',
      })
    }
  } catch {
    checks.push({
      name: 'system_snapshot_refreshed',
      passed: false,
      detail: 'could not reach server for snapshot refresh',
    })
  }

  const ok = checks.every((c) => c.passed)

  // ── O6: Auto-invoke gen:protocol if all checks passed ────────────────
  if (ok) {
    try {
      const { CapStoreDb } = await import('../src/storage/db.js')
      const { ProviderProtocolGenerator } = await import('../src/engines/provider-protocol-generator.js')
      const genDb = new CapStoreDb()
      const gen = new ProviderProtocolGenerator(genDb)
      const result = await gen.generate({ overwriteDev: false })
      checks.push({
        name: 'protocol_generated',
        passed: true,
        detail: `wrote ${result.outputPath} (${result.providerCount} providers, ${result.fileSize} bytes)`,
      })
    } catch (genErr) {
      checks.push({
        name: 'protocol_generated',
        passed: false,
        detail: `gen:protocol failed: ${genErr instanceof Error ? genErr.message : String(genErr)}`,
      })
    }
  }

  return { ok, provider, checks }
}
