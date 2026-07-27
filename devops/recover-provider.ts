// devops/recover-provider.ts
// Diagnostic + recovery tooling for provider onboarding failures.
// The LLM agent calls this when something goes wrong during the
// agent-as-explorer flow. Returns structured diagnosis + fix actions.

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ── Types ──────────────────────────────────────────────────────────────────

export interface DiagnosticCheck {
  name: string
  status: 'ok' | 'warn' | 'error'
  detail: string
  fix?: string
}

export interface DiagnosisResult {
  provider: string
  phase: string
  checks: DiagnosticCheck[]
  recoverable: boolean
  suggestedAction: string
}

// ── Chrome health checks ───────────────────────────────────────────────────

function checkChromeProcesses(): DiagnosticCheck {
  // On Windows, we check via PowerShell. For now, return a static advisory.
  return {
    name: 'chrome_processes',
    status: 'warn',
    detail: 'Check for stale Chrome processes manually',
    fix: 'Get-Process chrome | Stop-Process -Force',
  }
}

function checkProfileDir(slug: string, account: string): DiagnosticCheck {
  const profileDir = join(process.cwd(), 'chrome-profiles', slug, account)
  if (!existsSync(profileDir)) {
    return {
      name: 'profile_directory',
      status: 'error',
      detail: `Profile dir not found: ${profileDir}`,
      fix: `bun run devops runtime-test onboard-provider --provider=${slug} --account=${account}`,
    }
  }

  // Check for SingletonLock (stale lock file)
  const lockFile = join(profileDir, 'SingletonLock')
  if (existsSync(lockFile)) {
    return {
      name: 'singleton_lock',
      status: 'warn',
      detail: 'SingletonLock exists — Chrome may be holding it',
      fix: `Remove-Item "${lockFile}" -Force`,
    }
  }

  // Check for cookie files
  const networkDir = join(profileDir, 'Default', 'Network')
  const altNetworkDir = join(profileDir, 'Profile 1', 'Network')
  const hasCookies = existsSync(join(networkDir, 'Cookies')) || existsSync(join(altNetworkDir, 'Cookies'))
  if (!hasCookies) {
    return {
      name: 'cookies',
      status: 'error',
      detail: 'No cookie files found in profile — login may not have completed',
      fix: `bun run devops runtime-test onboard-provider --provider=${slug} --account=${account}`,
    }
  }

  return {
    name: 'profile_directory',
    status: 'ok',
    detail: `Profile exists at ${profileDir}, cookies present`,
  }
}

function checkDebugPort(slug: string): DiagnosticCheck {
  // Check .runtime/ for saved debug port
  const runtimeDir = join(process.cwd(), '.runtime')
  if (!existsSync(runtimeDir)) {
    return {
      name: 'debug_port',
      status: 'warn',
      detail: '.runtime/ directory not found',
      fix: 'Ensure backend has been started at least once',
    }
  }

  return {
    name: 'debug_port',
    status: 'warn',
    detail: 'Debug port not persisted — check Chrome debug output or running processes',
    fix: 'Check Chrome process args for --remote-debugging-port',
  }
}

// ── DB checks ──────────────────────────────────────────────────────────────

async function checkDbProvider(slug: string): Promise<DiagnosticCheck> {
  try {
    const { CapStoreDb } = await import('../src/storage/db.js')
    const db = new CapStoreDb()
    const def = await db.prisma.providerDefinition.findFirst({ where: { slug } })
    if (!def) {
      return {
        name: 'db_definition',
        status: 'error',
        detail: `No ProviderDefinition for slug '${slug}'`,
        fix: `bun run devops runtime-test onboard-provider --provider=${slug}`,
      }
    }

    const endpoints = await db.prisma.providerEndpoint.findMany({ where: { providerId: def.id } })
    const parsers = await db.prisma.providerParser.findMany({ where: { providerId: def.id } })
    const caps = await db.prisma.providerCapability.findMany({ where: { providerId: def.id } })
    const validParser = parsers.find(
      (p: any) => p.parserLogicType === 'inline' && p.parserLogicCode && p.parserLogicCode.length > 0,
    )

    const issues: string[] = []
    if (endpoints.length === 0) issues.push('no endpoints')
    if (!validParser) issues.push('no valid parser (need inline logic_code)')
    if (caps.length === 0) issues.push('no capabilities')

    return {
      name: 'db_provider',
      status: issues.length > 0 ? 'error' : 'ok',
      detail: `${endpoints.length} endpoints, ${parsers.length} parsers (${validParser ? 'valid' : 'none valid'}), ${caps.length} capabilities`,
      fix: issues.length > 0 ? `Missing: ${issues.join(', ')}. Run full onboarding flow.` : undefined,
    }
  } catch (err) {
    return {
      name: 'db_provider',
      status: 'error',
      detail: `DB check failed: ${err instanceof Error ? err.message : String(err)}`,
      fix: 'Check DATABASE_URL and Prisma schema',
    }
  }
}

// ── Main diagnosis function ────────────────────────────────────────────────

export async function diagnoseProvider(
  provider: string,
  phase: string,
): Promise<DiagnosisResult> {
  const checks: DiagnosticCheck[] = []

  // Chrome checks
  checks.push(checkChromeProcesses())
  checks.push(checkProfileDir(provider, 'owservera'))
  checks.push(checkDebugPort(provider))

  // DB checks
  checks.push(await checkDbProvider(provider))

  const errors = checks.filter((c) => c.status === 'error')
  const recoverable = errors.every((e) => !!e.fix)

  let suggestedAction = 'All checks passed'
  if (errors.length > 0) {
    suggestedAction = errors[0].fix ?? 'Unknown fix — check logs'
  }

  return {
    provider,
    phase,
    checks,
    recoverable,
    suggestedAction,
  }
}
