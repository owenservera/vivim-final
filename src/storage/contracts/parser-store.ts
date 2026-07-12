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
  isActive: number
  fallbackParserId: string | null
  createdAt: number
  updatedAt: number
}

export interface ParserStore {
  getParser(providerId: string): Promise<ProviderParserRow | null>
  getActiveParser(providerId: string): Promise<ProviderParserRow | null>
  upsertParser(parser: ProviderParserRow): Promise<void>
  listParsers(providerId: string): Promise<ProviderParserRow[]>
  getParserByFile(filePath: string): Promise<ProviderParserRow | null>
  getParserByHash(hash: string): Promise<ProviderParserRow | null>

  // DB-only fallback chain — no hardcoded parsers in engine
  getGenericParser(): Promise<ProviderParserRow | null>
  getSystemFallbackParser(): Promise<ProviderParserRow | null>
}
