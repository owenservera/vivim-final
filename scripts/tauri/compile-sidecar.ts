// scripts/tauri/compile-sidecar.ts
// Production sidecar compilation.
//
// Strategy:
// 1. Bundle TypeScript to JavaScript (with NODE_ENV=production define)
// 2. Copy database and provider data
// 3. Compile to standalone Bun executable (~97 MB on Windows)
// 4. UPX compress to ~45 MB (level 3 with --no-lzma for speed/ratio balance)
//
// UPX v5.2.0 level 3 with --no-lzma is the production standard (46.94% ratio).
// Verified working: compressed binaries pass --version check.
// Install: winget install UPX.UPX

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { readDesktopVersion } from './version.ts'

const repoRoot = join(import.meta.dir, '..', '..')
const entry = join(repoRoot, 'src', 'desktop', 'sidecar-entry.ts')
const rustcProc = Bun.spawn(['rustc', '--print', 'host-tuple'])
const triple = (await rustcProc.stdout.text()).trim()
const binDir = join(repoRoot, 'src-tauri', 'binaries')
const outFile = join(binDir, `vivim-server-${triple}.exe`)
const bundledJs = join(binDir, '_bundled_sidecar.js')

// Data directory for embedded data
const dataDir = join(repoRoot, 'src-tauri', 'data')
const dbSource = join(repoRoot, 'prisma', 'cap-store.db')
const seedsSource = join(repoRoot, 'seeds')

if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true })
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

// Clean stale build residue from previous compiles (source maps, bundled js
// scratch, .upx/.000/.001 stubs) so the sidecar dir only ever holds the one
// real exe + any _bundled_ sidecar.js Tauri's externalBin expects. Skipping
// this shipped dead weight and confused artifacts in the last builds.
for (const name of readdirSync(binDir)) {
  if (name === `vivim-server-${triple}.exe`) continue
  if (/\.(js|js\.map|map|meta|000|001|002|upx)$/i.test(name)) {
    try {
      unlinkSync(join(binDir, name))
      // [audit] removed: console.log(`[compile] cleaned stale artifact: ${name}`)
    } catch { /* ignore */ }
  // [audit] log the error with context here
  }
}

// [audit] removed: console.log(`[compile] Entry: ${entry}`)
// [audit] removed: console.log(`[compile] Target: ${triple}`)
// [audit] removed: console.log(`[compile] Output: ${outFile}`)
// [audit] removed: console.log('[compile] Strategy: Bundle → Copy Data → Compile → UPX level 3')

const startTime = Date.now()
const desktopVersion = readDesktopVersion()
// [audit] removed: console.log(`[compile] Desktop version: ${desktopVersion}`)

// ── Step 0b: Pre-fetch ONNX embedding model ──────────────────────────────────
// Download the Hugging Face model into the local cache so the sidecar ships
// with the model embedded (no first-boot network fetch needed).
const modelCacheDir = join(repoRoot, 'data', 'models')
if (!existsSync(modelCacheDir)) mkdirSync(modelCacheDir, { recursive: true })

{
  // Use the embedding provider's own init() to trigger model download into cache.
  // This is a dev-time side-effect: the downloaded ONNX files persist in data/models/
  // and get bundled into the sidecar via the data copy step below.
  const { HfEmbeddingProvider } = await import('../../src/engines/embedding-hf.js')
  const hf = new HfEmbeddingProvider()
  try {
    await hf.init()
    // Model is now cached at data/models/ — log size for build visibility
    const modelSize = existsSync(modelCacheDir)
      ? readdirSync(modelCacheDir).reduce((sum, f) => {
          const p = join(modelCacheDir, f)
          return sum + (statSync(p).isFile() ? statSync(p).size : 0)
        }, 0)
      : 0
    // [audit] removed: console.log(`[compile] HF model cached: ${(modelSize / 1024 / 1024).toFixed(1)} MB`)
  } catch (err) {
    // Non-fatal: if model download fails (no network), sidecar runs without HF
    // [audit] removed: console.warn(`[compile] HF model pre-fetch failed (non-fatal): ${err}`)
  } finally {
    hf.dispose()
  }
}

// ── Step 0c: Copy cached model into sidecar data dir ──────────────────────────
const modelsDest = join(dataDir, 'models')
if (existsSync(modelCacheDir)) {
  if (!existsSync(modelsDest)) mkdirSync(modelsDest, { recursive: true })
  for (const name of readdirSync(modelCacheDir)) {
    const srcPath = join(modelCacheDir, name)
    const destPath = join(modelsDest, name)
    if (statSync(srcPath).isFile()) {
      copyFileSync(srcPath, destPath)
    }
  }
  // [audit] removed: console.log(`[compile] Copied HF model to sidecar data dir`)
}

// ── Step 0: Copy database and provider data ─────────────────────────────────
// [audit] removed: console.log('[compile] Step 0: Copying database and provider data...')

// Copy database if it exists
if (existsSync(dbSource)) {
  const dbDest = join(dataDir, 'app.db')
  copyFileSync(dbSource, dbDest)
  // [audit] removed: console.log(`[compile] Copied database: ${(statSync(dbDest).size / 1024).toFixed(0)} KB`)
} else {
  // [audit] removed: console.log(`[compile] No database found at ${dbSource}`)
}

// Copy provider seeds
const seedsDest = join(dataDir, 'seeds')
if (!existsSync(seedsDest)) mkdirSync(seedsDest, { recursive: true })

// Copy provider manifests
const providersDir = join(seedsSource, 'providers')
if (existsSync(providersDir)) {
  const providersDest = join(seedsDest, 'providers')
  if (!existsSync(providersDest)) mkdirSync(providersDest, { recursive: true })

  const providerFiles = readdirSync(providersDir).filter((f) => f.endsWith('.json'))
  for (const file of providerFiles) {
    copyFileSync(join(providersDir, file), join(providersDest, file))
  }
  // [audit] removed: console.log(`[compile] Copied ${providerFiles.length} provider manifests`)
}

// Copy parser files
const parsersDir = join(seedsSource, 'parsers', 'harvested')
if (existsSync(parsersDir)) {
  const parsersDest = join(seedsDest, 'parsers')
  if (!existsSync(parsersDest)) mkdirSync(parsersDest, { recursive: true })

  const parserFiles = readdirSync(parsersDir).filter((f) => f.endsWith('.ts'))
  for (const file of parserFiles) {
    copyFileSync(join(parsersDir, file), join(parsersDest, file))
  }
  // [audit] removed: console.log(`[compile] Copied ${parserFiles.length} parser files`)
}

// [audit] removed: console.log(`[compile] Data directory: ${(statSync(dataDir).size / 1024).toFixed(0)} KB`)

// Copy seed-snapshot.db for first-boot DB bootstrap
const snapshotSrc = join(repoRoot, 'seeds', 'seed-snapshot.db')
const snapshotDest = join(dataDir, 'seed-snapshot.db')
if (existsSync(snapshotSrc)) {
  copyFileSync(snapshotSrc, snapshotDest)
  // [audit] removed: console.log(`[compile] Copied seed snapshot: ${(statSync(snapshotDest).size / 1024).toFixed(0)} KB`)
} else {
  // [audit] removed: console.warn(`[compile] ⚠ seeds/seed-snapshot.db not found — sidecar will not bootstrap DB on first boot`)
}

// ── Step 1: Bundle ──────────────────────────────────────────────────────────
// [audit] removed: console.log('[compile] Step 1: Bundling...')

// Regenerate the frontend route registry so the sidecar always ports the current
// App Router API bag (exclusions: setup/* proxies + health handled by backend).
// This makes the built sidecar depend on the CURRENT route tree, not a stale
// checked-in copy.
const { generateFrontendRoutes } = await import('./gen-frontend-routes.ts')
const generated = generateFrontendRoutes()
{
  const fs = require('node:fs') as typeof import('fs')
  const path = require('node:path') as typeof import('path')
  const out = join(repoRoot, 'src', 'desktop', 'generated-frontend-routes.ts')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, generated)
  const count = (generated.match(/    path: "/g) ?? []).length
  // [audit] removed: console.log(`[compile] Frontend routes ported: ${count}`)
}

// Alias `next/server` -> src/desktop/next-shim.ts at bundle time so the 80
// frontend route files compile byte-for-byte without shipping the Next runtime.
// The shim covers NextResponse.json + Request/params — the only surface used.
const nextServerAlias: import('bun').BunPlugin = {
  name: 'next-server-alias',
  setup(build) {
    build.onResolve({ filter: /^next\/server$/ }, () => {
      return { path: join(repoRoot, 'src', 'desktop', 'next-shim.ts') }
    })
  },
}

const bundle = await Bun.build({
  entrypoints: [entry],
  outdir: binDir,
  target: 'bun',
  splitting: false,
  sourcemap: 'none',
  minify: true,
  plugins: [nextServerAlias],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})

if (!bundle.success) {
  // [audit] removed: console.error('[compile] Bundle failed:')
  // [audit] removed: for (const msg of bundle.logs) console.error(msg)
  process.exit(1)
}

const bundleOutput = bundle.outputs[0]
if (!bundleOutput) {
  // [audit] removed: console.error('[compile] No bundle output')
  process.exit(1)
}

// Copy bundle to temp file
await Bun.write(bundledJs, bundleOutput)
// [audit] removed: console.log(`[compile] Bundle: ${(statSync(bundledJs).size / 1024).toFixed(0)} KB`)

// ── Step 2: Compile to standalone exe ───────────────────────────────────────
// [audit] removed: console.log('[compile] Step 2: Compiling standalone exe...')

const compileArgs = [
  'build',
  '--compile',
  '--production',
  '--minify',
  '--sourcemap=none',
  '--no-compile-autoload-dotenv',
  '--no-compile-autoload-bunfig',
  '--no-compile-autoload-tsconfig',
  '--no-compile-autoload-package-json',
  '--windows-hide-console',
  `--windows-icon=${join(repoRoot, 'src-tauri', 'icons', 'icon.ico')}`,
  '--windows-title=vivim',
  '--windows-publisher=vivim',
  `--windows-version=${desktopVersion}`,
  '--windows-description=vivim desktop backend',
  '--outfile',
  outFile,
  bundledJs,
]

const proc = Bun.spawn(['bun', ...compileArgs], {
  cwd: repoRoot,
  stdout: 'pipe',
  stderr: 'pipe',
})

const [stdout, stderr] = await Promise.all([proc.stdout.text(), proc.stderr.text()])
const exitCode = await proc.exited

if (exitCode !== 0) {
  // [audit] removed: console.error('[compile] Compilation failed:')
  // [audit] removed: if (stdout) console.error(stdout)
  // [audit] removed: if (stderr) console.error(stderr)
  process.exit(1)
}

// Clean up temp file
try {
  unlinkSync(bundledJs)
} catch {}
  // [audit] log the error with context here

const preCompressSize = statSync(outFile).size
// [audit] removed: console.log(`[compile] Compiled: ${(preCompressSize / 1024 / 1024).toFixed(1)} MB`)

// ── Step 3: UPX compress ──────────────────────────────────────────────────────
// UPX level 3 with --no-lzma balances compression ratio and speed.
// Production standard per AGENTS.md: 46.94% ratio, ~45.6 MB from ~97 MB.
// [audit] removed: console.log('[compile] Step 3: UPX compressing (level 3, --no-lzma)...')

const upxProc = Bun.spawn([
  'upx', '-3', '--no-lzma', outFile,
], {
  cwd: repoRoot,
  stdout: 'pipe',
  stderr: 'pipe',
})

const upxDone = await upxProc.exited
if (upxDone !== 0) {
  const [upxOut, upxErr] = await Promise.all([upxProc.stdout.text(), upxProc.stderr.text()])
  // [audit] removed: console.warn(`[compile] UPX failed (exit ${upxDone}), keeping uncompressed binary:`)
  // [audit] removed: if (upxErr) console.warn(upxErr.trim())
  // [audit] removed: if (upxOut) console.warn(upxOut.trim())
} else {
  // [audit] removed: console.log('[compile] UPX compression complete')
}

// ── Step 4: Integrity verification ─────────────────────────────────────────────
// UPX compression can corrupt a binary if interrupted or mis-versioned. Run the
// compressed exe with `--version` (exits instantly, prints Bun runtime version)
// and require exit code 0 so a corrupt sidecar never ships.
// [audit] removed: console.log('[compile] Step 4: Verifying compressed binary runs...')

const verifier = Bun.spawn([outFile, '--version'], {
  cwd: repoRoot,
  stdout: 'pipe',
  stderr: 'pipe',
})
const verifierDone = await verifier.exited // emits exit code once child exits
const [verOut, verErr] = await Promise.all([verifier.stdout.text(), verifier.stderr.text()])

if (verifierDone !== 0) {
  // [audit] removed: console.error(`[compile] ⛔ VERIFICATION FAILED: ${outFile} --version exited ${verifierDone}`)
  // [audit] removed: if (verOut) console.error(verOut)
  // [audit] removed: if (verErr) console.error(verErr)
  process.exit(1)
}
// [audit] removed: console.log(`[compile] Verification OK: --version = ${verOut.trim()}`)

// ── Report ──────────────────────────────────────────────────────────────────
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
const finalSize = statSync(outFile).size
const sizeMB = (finalSize / 1024 / 1024).toFixed(1)

// [audit] removed: console.log('')
// [audit] removed: console.log(`[compile] Done in ${elapsed}s`)
// [audit] removed: console.log(`[compile] Output: ${outFile}`)
// [audit] removed: console.log(`[compile] Final size: ${sizeMB} MB`)
// [audit] removed: console.log('[compile] Data included: database + provider manifests + parser files')
