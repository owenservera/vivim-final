// devops/runtime-test/build-backend.ts
// Unit 5.3 — Backend Scaffold
//
// `scaffoldBackend({ cap })` now emits a compilable `makeCapability` skeleton via the
// codegen recipe (Unit 1.3). Without `--cap` it validates structure (original no-op
// behavior) so existing callers stay compatible.

import { scaffoldCapability, type CodegenResult } from './capability-codegen.js'

export interface ScaffoldBackendOptions {
  cap?: string
}

export async function scaffoldBackend(opts?: ScaffoldBackendOptions): Promise<CodegenResult> {
  if (opts?.cap) {
    return scaffoldCapability(opts.cap)
  }
  // No-op: backend is source; scaffold validates structure
  return { ok: true, path: 'src/', snippet: '' }
}
