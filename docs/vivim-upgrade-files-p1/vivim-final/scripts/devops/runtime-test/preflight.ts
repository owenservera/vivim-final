// scripts/devops/runtime-test/preflight.ts
// Pre-flight health check (DB + server + slaves + governor)

export interface PreflightResult {
  ok: boolean
  checks: Array<{
    name: string
    ok: boolean
    detail?: string
  }>
  failingCheck?: string
}

export interface PreflightOptions {
  backendPort: number
  frontendPort: number
}

export async function preflightCheck(opts: PreflightOptions): Promise<PreflightResult> {
  const checks: PreflightResult['checks'] = []
  let ok = true
  let failingCheck: string | undefined

  // Check 1: Database connection + WAL mode
  try {
    const prismaUrl = process.env.DATABASE_URL ?? 'file:./dev.db'
    const dbCheck = await checkDatabaseWAL(prismaUrl)
    checks.push({ name: 'database-wal', ok: dbCheck.ok, detail: dbCheck.detail })
    if (!dbCheck.ok) {
      ok = false
      failingCheck = 'database-wal'
    }
  } catch (e) {
    checks.push({ name: 'database-wal', ok: false, detail: String(e) })
    ok = false
    failingCheck = 'database-wal'
  }

  // Check 2: Backend health
  try {
    const backendHealthy = await checkBackendHealth(opts.backendPort)
    checks.push({ name: 'backend', ok: backendHealthy.ok, detail: backendHealthy.detail })
    if (!backendHealthy.ok) {
      ok = false
      if (!failingCheck) failingCheck = 'backend'
    }
  } catch (e) {
    checks.push({ name: 'backend', ok: false, detail: String(e) })
    ok = false
    if (!failingCheck) failingCheck = 'backend'
  }

  // Check 3: Frontend (if accessible)
  try {
    const frontendHealthy = await checkFrontendHealth(opts.frontendPort)
    checks.push({ name: 'frontend', ok: frontendHealthy.ok, detail: frontendHealthy.detail })
    // Frontend not required to block - warn only
  } catch (e) {
    checks.push({ name: 'frontend', ok: false, detail: String(e) })
  }

  // Check 4: Provider slaves
  try {
    const slavesOk = await checkSlaves()
    checks.push({ name: 'slaves', ok: slavesOk.ok, detail: slavesOk.detail })
    if (!slavesOk.ok) {
      ok = false
      if (!failingCheck) failingCheck = 'slaves'
    }
  } catch (e) {
    checks.push({ name: 'slaves', ok: false, detail: String(e) })
    ok = false
    if (!failingCheck) failingCheck = 'slaves'
  }

  return { ok, checks, failingCheck }
}

async function checkDatabaseWAL(prismaUrl: string): Promise<{ ok: boolean; detail?: string }> {
  try {
    // Use Prisma to check WAL mode
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    await prisma.$connect()

    // Check journal_mode
    const result = await prisma.$queryRaw<{ journal_mode: string }[]>`PRAGMA journal_mode`
    await prisma.$disconnect()

    const mode = result[0]?.journal_mode?.toUpperCase() ?? 'UNKNOWN'
    return {
      ok: mode === 'WAL',
      detail: `journal_mode=${mode}`,
    }
  } catch (e) {
    return { ok: false, detail: String(e) }
  }
}

async function checkBackendHealth(port: number): Promise<{ ok: boolean; detail?: string }> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/health/providers`)
    if (r.ok) {
      const data = await r.json()
      return { ok: true, detail: `providers=${Array.isArray(data) ? data.length : 0}` }
    }
    return { ok: false, detail: `status=${r.status}` }
  } catch (e) {
    return { ok: false, detail: String(e) }
  }
}

async function checkFrontendHealth(port: number): Promise<{ ok: boolean; detail?: string }> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/`)
    if (r.ok) {
      return { ok: true, detail: 'frontend accessible' }
    }
    return { ok: false, detail: `status=${r.status}` }
  } catch (e) {
    return { ok: false, detail: 'not accessible' }
  }
}

async function checkSlaves(): Promise<{ ok: boolean; detail?: string }> {
  try {
    // Check governor for running slaves
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    await prisma.$connect()

    const count = await prisma.chromeSlave.count()
    await prisma.$disconnect()

    return { ok: count > 0, detail: `slaves=${count}` }
  } catch (e) {
    return { ok: false, detail: String(e) }
  }
}
