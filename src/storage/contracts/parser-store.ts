// src/storage/contracts/parser-store.ts
// ParserStore — persistence contract for StreamParserEngine (04-merged-engines.md §3).
// All parser logic lives in DB — engine is a loader/executor, not a parser repository.

export interface ProviderParserRow {
  id: string
  providerId: string
  name: string
  version: number
  logicType: string // 'file' | 'inline' | 'composed'
  filePath: string | null
  logicCode: string | null // Inline TypeScript/JavaScript for DB-driven loading
  hash: string
  sampleBody: string | null // Representative wire-format sample for testing
  isActive: number
  fallbackParserId: string | null
  createdAt: number
  updatedAt: number
}

export interface ParserStore {
  getParser(providerId: string): Promise<ProviderParserRow | null>
  getActiveParser(providerId: string): Promise<ProviderParserRow | null>
  // By-need resolution: providerId@version (semver) or @latest. Returns the
  // active row matching the resolved version, or the highest version when
  // `version` is omitted/'latest'. The engine walks fallbackParserId from here.
  getParserByProviderAndVersion(
    providerId: string,
    version?: string,
  ): Promise<ProviderParserRow | null>
  // Resolve a single parser row by its primary id (used to follow the
  // fallbackParserId edge without re-querying by provider).
  getParserById(id: string): Promise<ProviderParserRow | null>
  upsertParser(parser: ProviderParserRow): Promise<void>
  listParsers(providerId: string): Promise<ProviderParserRow[]>
  getParserByFile(filePath: string): Promise<ProviderParserRow | null>
  getParserByHash(hash: string): Promise<ProviderParserRow | null>

  // DB-only fallback chain — generic/system are ordinary rows reached via the
  // fallbackParserId edge (no hardcoded tiers in the engine).
  getGenericParser(): Promise<ProviderParserRow | null>
  getSystemFallbackParser(): Promise<ProviderParserRow | null>
}
