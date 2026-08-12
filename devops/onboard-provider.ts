// devops/onboard-provider.ts
// Agent entry point for autonomous provider onboarding.
// Seeds provider definition (if missing), calls ChromeSetupWizard.runSetup(),
// and returns agent instructions for the next steps (UI exploration, capture, etc.).

import type { ChromeSetupWizard } from '../src/engines/chrome-setup-wizard.js'
import type { ProfileAllocator } from '../src/executor/profile-allocator.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface OnboardProviderArgs {
  /** Provider slug (e.g. 'grok', 'mistral'). */
  provider: string
  /** Provider URL. Defaults to manifest's website_url. */
  url?: string
  /** Account email. Defaults to 'owservera'. */
  account?: string
}

export interface OnboardProviderResult {
  ok: boolean
  provider: string
  debugPort: number
  profileDir: string
  instructions: string
  error?: string
}

// ── Instructions template ──────────────────────────────────────────────────

function buildInstructions(provider: string, url: string, debugPort: number): string {
  return `
## Provider Onboarding: ${provider}

Chrome is running at ws://127.0.0.1:${debugPort}

### Your Toolkit
- CDP client: attach to ws://127.0.0.1:${debugPort}
- LiveCaptureEngine: send test message + capture streaming response
- StreamingResponseAnalyzer: classify format + generate parser
- FormatClassifier: LLM fallback for unknown formats
- SelectorRefiner: LLM fallback for low-confidence selectors
- ProtocolDiscoveryEngine: probe DOM for composers, buttons, network patterns
- ProviderRegistrar: upsert full manifest to DB

### Suggested Flow
1. Navigate to ${url}
2. Use ProtocolDiscoveryEngine to find composers and send buttons
3. Use LiveCaptureEngine to send "Hello" and capture the response
4. Use StreamingResponseAnalyzer to classify the format
5. If confidence < 0.7, use FormatClassifier as fallback
6. Build the provider manifest from discovered data
  7. Use ProviderRegistrar.seedProvider() to upsert to DB
  8. Verify: bun run devops runtime-test onboard-verify --provider=${provider}
     (auto-triggers gen:protocol after all 12 checks pass)

### Failure Recovery
- Can't find composer? Try screenshots, accessibility tree, known selectors
- Empty capture? Check Network.requestWillBeSent for actual URL
- Unknown format? Use FormatClassifier with raw body
- Low confidence selectors? Use SelectorRefiner with page snapshot
`.trim()
}

// ── Main function ──────────────────────────────────────────────────────────

export async function onboardProvider(
  args: OnboardProviderArgs,
  deps: { db: { prisma: any }; allocator: ProfileAllocator; wizard: ChromeSetupWizard },
): Promise<OnboardProviderResult> {
  const { provider, url, account = 'owservera' } = args
  const { db, allocator, wizard } = deps

  // 1. Look up or create provider definition
  let prov = await db.prisma.providerDefinition.findFirst({ where: { slug: provider } })
  if (!prov) {
    // Try to load from manifests
    let manifestUrl = url
    if (!manifestUrl) {
      try {
        const { PROVIDER_MANIFESTS } = await import('../seeds/providers/manifests.js')
        const manifest = (PROVIDER_MANIFESTS as any[]).find(
          (m: any) => m.provider?.slug === provider,
        )
        manifestUrl = manifest?.provider?.website_url ?? `https://${provider}.com`
      } catch {
        manifestUrl = url ?? `https://${provider}.com`
      }
    }

    prov = await db.prisma.providerDefinition.create({
      data: {
        slug: provider,
        display_name: provider.charAt(0).toUpperCase() + provider.slice(1),
        description: null,
        category: 'ai',
        provider_type: 'llm',
        website_url: manifestUrl,
        auth_type: 'browser',
        has_multi_account: 0,
        profile_strategy: 'per_account',
        fleet_config_json: '{}',
        capabilities_json: '[]',
        models_json: '[]',
        is_active: 1,
      },
    })
    // [audit] removed: console.log(`[onboard] Created provider definition: ${provider} (${prov.id})`)
  }

  // 2. Check if already authenticated (fast no-op)
  const profileDir = await allocator.allocate(provider, account)
  if (await allocator.isAuthenticated(profileDir)) {
    // Already logged in — find existing debug port
    const existingAccount = await db.prisma.providerAccount.findFirst({
      where: { providerId: prov.id, email: account },
    })
    const debugPort = existingAccount?.debugPort ?? 0
    return {
      ok: true,
      provider,
      debugPort,
      profileDir,
      instructions: buildInstructions(provider, url ?? prov.website_url ?? `https://${provider}.com`, debugPort),
    }
  }

  // 3. Launch Chrome + wait for login
  // [audit] removed: console.log(`[onboard] Starting wizard for ${provider}/${account}...`)
  const result = await wizard.runSetup(prov.id, provider, account, {
    visible: true,
    // [audit] removed: onProgress: (msg: string) => console.log(msg),
  })

  if (!result.ok) {
    return {
      ok: false,
      provider,
      debugPort: 0,
      profileDir: '',
      instructions: '',
      error: result.error ?? 'Account registration failed',
    }
  }

  return {
    ok: true,
    provider,
    debugPort: result.debugPort,
    profileDir: result.profileDir,
    instructions: buildInstructions(provider, url ?? prov.website_url ?? `https://${provider}.com`, result.debugPort),
  }
}
