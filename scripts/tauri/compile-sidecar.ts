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

console.log(`[compile] Entry: ${entry}`)
console.log(`[compile] Target: ${triple}`)
console.log(`[compile] Output: ${outFile}`)
console.log('[compile] Strategy: Bundle → Copy Data → Compile → UPX level 3')

const startTime = Date.now()
const desktopVersion = readDesktopVersion()
console.log(`[compile] Desktop version: ${desktopVersion}`)

// ── Step 0: Copy database and provider data ─────────────────────────────────
console.log('[compile] Step 0: Copying database and provider data...')

// Copy database if it exists
if (existsSync(dbSource)) {
  const dbDest = join(dataDir, 'app.db')
  copyFileSync(dbSource, dbDest)
  console.log(`[compile] Copied database: ${(statSync(dbDest).size / 1024).toFixed(0)} KB`)
} else {
  console.log(`[compile] No database found at ${dbSource}`)
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
  console.log(`[compile] Copied ${providerFiles.length} provider manifests`)
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
  console.log(`[compile] Copied ${parserFiles.length} parser files`)
}

console.log(`[compile] Data directory: ${(statSync(dataDir).size / 1024).toFixed(0)} KB`)

// Copy seed-snapshot.db for first-boot DB bootstrap
const snapshotSrc = join(repoRoot, 'seeds', 'seed-snapshot.db')
const snapshotDest = join(dataDir, 'seed-snapshot.db')
if (existsSync(snapshotSrc)) {
  copyFileSync(snapshotSrc, snapshotDest)
  console.log(`[compile] Copied seed snapshot: ${(statSync(snapshotDest).size / 1024).toFixed(0)} KB`)
} else {
  console.warn(`[compile] ⚠ seeds/seed-snapshot.db not found — sidecar will not bootstrap DB on first boot`)
}

// ── Step 1: Bundle ──────────────────────────────────────────────────────────
console.log('[compile] Step 1: Bundling...')

const bundle = await Bun.build({
  entrypoints: [entry],
  outdir: binDir,
  target: 'bun',
  splitting: false,
  sourcemap: 'none',
  minify: true,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})

if (!bundle.success) {
  console.error('[compile] Bundle failed:')
  for (const msg of bundle.logs) console.error(msg)
  process.exit(1)
}

const bundleOutput = bundle.outputs[0]
if (!bundleOutput) {
  console.error('[compile] No bundle output')
  process.exit(1)
}

// Copy bundle to temp file
await Bun.write(bundledJs, bundleOutput)
console.log(`[compile] Bundle: ${(statSync(bundledJs).size / 1024).toFixed(0)} KB`)

// ── Step 2: Compile to standalone exe ───────────────────────────────────────
console.log('[compile] Step 2: Compiling standalone exe...')

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
  console.error('[compile] Compilation failed:')
  if (stdout) console.error(stdout)
  if (stderr) console.error(stderr)
  process.exit(1)
}

// Clean up temp file
try {
  unlinkSync(bundledJs)
} catch {}

const preCompressSize = statSync(outFile).size
console.log(`[compile] Compiled: ${(preCompressSize / 1024 / 1024).toFixed(1)} MB`)

// ── Step 3: UPX compress ──────────────────────────────────────────────────────
// UPX level 3 with --no-lzma balances compression ratio and speed.
// Production standard per AGENTS.md: 46.94% ratio, ~45.6 MB from ~97 MB.
console.log('[compile] Step 3: UPX compressing (level 3, --no-lzma)...')

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
  console.warn(`[compile] UPX failed (exit ${upxDone}), keeping uncompressed binary:`)
  if (upxErr) console.warn(upxErr.trim())
  if (upxOut) console.warn(upxOut.trim())
} else {
  console.log('[compile] UPX compression complete')
}

// ── Report ──────────────────────────────────────────────────────────────────
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
const finalSize = statSync(outFile).size
const sizeMB = (finalSize / 1024 / 1024).toFixed(1)

console.log('')
console.log(`[compile] Done in ${elapsed}s`)
console.log(`[compile] Output: ${outFile}`)
console.log(`[compile] Final size: ${sizeMB} MB`)
console.log('[compile] Data included: database + provider manifests + parser files')
