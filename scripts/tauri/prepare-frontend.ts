import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const root = join(import.meta.dir, '..', '..')
const frontendDir = join(root, 'frontend')
const dotNext = join(frontendDir, '.next')
const outDir = join(frontendDir, 'out')

// 1. Build Next.js
console.log('[prepare] Building Next.js...')
execSync('bun run build', { cwd: frontendDir, stdio: 'inherit' })

// 2. Create out/
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

// 3. Copy static assets to out/_next/static/
const staticSrc = join(dotNext, 'static')
const staticDst = join(outDir, '_next', 'static')
if (existsSync(staticSrc)) {
  cpSync(staticSrc, staticDst, { recursive: true })
  console.log('[prepare] Copied static assets')
}

// 4. Read build-manifest to get chunk names
const manifest = JSON.parse(readFileSync(join(dotNext, 'build-manifest.json'), 'utf-8'))

// 5. Generate index.html
const polyfill = manifest.polyfillFiles?.[0] ?? ''
const rootFiles = manifest.rootMainFiles ?? []

const scriptTags = [
  polyfill ? `<script src="/_next/${polyfill}" crossorigin=""></script>` : '',
  ...rootFiles.map((f: string) => `<script src="/_next/${f}" crossorigin=""></script>`),
].filter(Boolean).join('\n    ')

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>vivim</title>
  <link rel="icon" href="/favicon.ico" />
</head>
<body>
  <div id="__next"></div>
  ${scriptTags}
  <script>
    self.__next_f = [];
    self.__next_setup = true;
  </script>
</body>
</html>
`

writeFileSync(join(outDir, 'index.html'), html, 'utf-8')
console.log('[prepare] Generated index.html')
console.log(`[prepare] Done. out/ ready at: ${outDir}`)
