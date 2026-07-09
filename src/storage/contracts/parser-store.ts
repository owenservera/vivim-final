// src/storage/contracts/parser-store.ts
// ParserStore — persistence contract for StreamParserEngine (04-merged-engines.md §3).

export interface ProviderParserRow {
  id: string
  providerId: string
  name: string
  version: number
  filePath: string
  hash: string
  isActive: number
  createdAt: number
  updatedAt: number
}

export interface ParserStore {
  getParser(providerId: string): Promise<ProviderParserRow | null>
  getActiveParser(providerId: string): Promise<ProviderParserRow | null>
  upsertParser(parser: ProviderParserRow): Promise<void>
  listParsers(providerId: string): Promise<ProviderParserRow[]>
  getParserByFile(filePath: string): Promise<ProviderParserRow | null>
}
