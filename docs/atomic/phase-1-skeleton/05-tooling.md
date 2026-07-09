# Unit 1.5: Tooling Configuration

**Phase:** 1 | **Files:** `biome.json`, `lefthook.yml`, `tsup.config.ts`
**Depends:** — | **Produces:** Linting, formatting, git hooks, build system

## biome.json
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": { "noUnusedImports": "warn", "noUnusedVariables": "warn" },
      "suspicious": { "noExplicitAny": "error" },
      "style": { "noNonNullAssertion": "warn" }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "asNeeded" }
  },
  "files": {
    "ignore": ["node_modules", "dist", "*.db", "*.db-journal", "*.db-wal"]
  }
}
```

## lefthook.yml
```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{js,ts,json,md}"
      run: bun run lint
    format:
      glob: "*.{js,ts,json,md}"
      run: bun run format
    typecheck:
      glob: "*.ts"
      run: bun run typecheck

pre-push:
  commands:
    test:
      run: bun test
```

## tsup.config.ts
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  target: 'node20',
  platform: 'node',
  external: ['@prisma/client', 'bun:sqlite'],
  banner: { js: '#!/usr/bin/env node' },
});
```

## Gate
- `bun run lint` exits clean
- `bun run format` exits clean
- `bunx lefthook install` works
- `bun run build` produces `dist/` with ESM + DTS
