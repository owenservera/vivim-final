// scripts/tauri/compile-sidecar.ts
// Production sidecar compilation with UPX compression.
//
// Strategy:
// 1. Bundle TypeScript to JavaScript
// 2. Copy database and provider data
// 3. Compile to standalone Bun executable (~97 MB on Windows)
// 4. Apply UPX compression (--no-lzma for speed) → ~45 MB (47% reduction)
//
// The Bun runtime baseline is ~94 MB on Windows (irreducible).
// Our app code adds ~3 MB. UPX compression reduces the final binary to ~45 MB.

import { existsSync, mkdirSync, statSync, unlinkSync, copyFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

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

// UPX configuration: level 3 with --no-lzma for optimal speed/ratio
const UPX_LEVEL = 3
const UPX_FLAGS = ['--no-lzma']

if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true })
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

console.log(`[compile] Entry: ${entry}`)
console.log(`[compile] Target: ${triple}`)
console.log(`[compile] Output: ${outFile}`)
console.log(`[compile] Strategy: Bundle → Copy Data → Compile → UPX compress (level ${UPX_LEVEL})`)

const startTime = Date.now()

// ── Step 0: Copy database and provider data ─────────────────────────────────
console.log(`[compile] Step 0: Copying database and provider data...`)

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
  
  const providerFiles = readdirSync(providersDir).filter(f => f.endsWith('.json'))
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
  
  const parserFiles = readdirSync(parsersDir).filter(f => f.endsWith('.ts'))
  for (const file of parserFiles) {
    copyFileSync(join(parsersDir, file), join(parsersDest, file))
  }
  console.log(`[compile] Copied ${parserFiles.length} parser files`)
}

console.log(`[compile] Data directory: ${(statSync(dataDir).size / 1024).toFixed(0)} KB`)

// ── Step 1: Bundle ──────────────────────────────────────────────────────────
console.log(`[compile] Step 1: Bundling...`)

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
console.log(`[compile] Step 2: Compiling standalone exe...`)

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
  '--windows-version=0.1.0',
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

// ── Step 3: UPX compress ────────────────────────────────────────────────────
console.log(`[compile] Step 3: UPX compression (level ${UPX_LEVEL})...`)

// Find UPX executable
const upxPaths = [
  join(repoRoot, 'tools', 'upx.exe'),
  'C:\\Program Files\\upx\\upx.exe',
  'C:\\Program Files (x86)\\upx\\upx.exe',
  `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\UPX.UPX_Microsoft.Winget.Source_8wekyb3d8bbwe\\upx-5.2.0-win64\\upx.exe`,
  `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Links\\upx.exe`,
]

let upxExe: string | null = null
for (const p of upxPaths) {
  if (existsSync(p)) {
    upxExe = p
    break
  }
}

if (!upxExe) {
  console.warn('[compile] WARNING: UPX not found, skipping compression')
  console.warn('[compile] Install UPX: winget install UPX.UPX')
} else {
  console.log(`[compile] UPX: ${upxExe}`)

  const upxArgs = [`-${UPX_LEVEL}`, ...UPX_FLAGS, outFile]
  const upxProc = Bun.spawn([upxExe, ...upxArgs], {
    cwd: repoRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [upxStdout, upxStderr] = await Promise.all([upxProc.stdout.text(), upxProc.stderr.text()])
  const upxExitCode = await upxProc.exited

  if (upxExitCode !== 0) {
    console.error('[compile] UPX compression failed:')
    if (upxStdout) console.error(upxStdout)
    if (upxStderr) console.error(upxStderr)
    console.warn('[compile] WARNING: Continuing without compression')
  } else {
    const postCompressSize = statSync(outFile).size
    const ratio = ((1 - postCompressSize / preCompressSize) * 100).toFixed(1)
    console.log(
      `[compile] Compressed: ${(postCompressSize / 1024 / 1024).toFixed(1)} MB (-${ratio}%)`,
    )
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
const finalSize = statSync(outFile).size
const sizeMB = (finalSize / 1024 / 1024).toFixed(1)

console.log('')
console.log(`[compile] Done in ${elapsed}s`)
console.log(`[compile] Output: ${outFile}`)
console.log(`[compile] Final size: ${sizeMB} MB`)
console.log(`[compile] Data included: database + provider manifests + parser files`)
