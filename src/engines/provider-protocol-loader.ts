// src/engines/provider-protocol-loader.ts
// Resolves the generated provider protocol static file, toggled by the
// PROVIDER_PROTOCOL_SOURCE env var (default: "generated"; alt: "dev").
//
// The generated file is produced by `bun run gen:protocol` (ProviderProtocolGenerator)
// from the DB. Consumers (ProviderRegistry, StreamParserEngine) import the resolved
// protocol instead of querying the DB at runtime. The dev variant
// (provider-protocol.dev.ts) is a gitignored, editable override for local testing.
//
// NOTE: This module lives under src/engines/ and must NOT read process.env directly
// (invariant B5 — config authority belongs to ConfigManager / non-engine callers).
// Callers in non-engine layers resolve the source from the environment and pass it in.

import type { ProviderProtocol } from './provider-protocol-generator.js'

export type ProtocolSource = 'generated' | 'dev'

// Pure resolver: maps a raw string (e.g. an env value) to a valid ProtocolSource.
// Defaults to 'generated' for anything other than exactly 'dev'.
export function normalizeProtocolSource(raw: string | undefined | null): ProtocolSource {
  const value = (raw ?? 'generated').toLowerCase().trim()
  return value === 'dev' ? 'dev' : 'generated'
}

// Lazily import the selected protocol file. We resolve the module dynamically so
// the two generated files are tree-shake-safe and only one is loaded at runtime.
// `source` is resolved by the caller (which may read PROVIDER_PROTOCOL_SOURCE);
// if omitted it defaults to 'generated'.
export async function loadProviderProtocol(
  source: ProtocolSource = 'generated',
): Promise<{ source: ProtocolSource; protocol: ProviderProtocol }> {
  if (source === 'dev') {
    const mod = await import('../__generated__/provider-protocol.dev.js')
    return { source, protocol: mod.default }
  }
  const mod = await import('../__generated__/provider-protocol.js')
  return { source, protocol: mod.default }
}
