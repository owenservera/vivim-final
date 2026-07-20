// src/storage/contracts/parser-execution-log-store.ts
// ParserExecutionLogStore — persistence contract for parser diagnostic logging.
// Every parse() call is recorded for confidence tracking, repair triggers, and analysis.

export interface ParserExecutionLogRow {
  id: string
  providerId: string
  parserName: string
  parserVersion: number
  conversationId: string | null
  messageId: string | null
  confidence: number
  blockCount: number
  textBlocks: number
  toolCallBlocks: number
  fileBlocks: number
  errorBlocks: number
  durationMs: number
  rawSizeBytes: number
  wireFormat: string | null
  fallbackUsed: number
  metadataJson: string
  createdAt: number
}

export interface ParserExecutionLogStore {
  logExecution(row: Omit<ParserExecutionLogRow, 'id' | 'createdAt'>): Promise<void>
  getRecentByProvider(providerId: string, limit?: number): Promise<ParserExecutionLogRow[]>
  getLowConfidenceEntries(threshold?: number, limit?: number): Promise<ParserExecutionLogRow[]>
  getStatsByProvider(providerId: string): Promise<{
    totalExecutions: number
    avgConfidence: number
    avgDurationMs: number
    fallbackRate: number
  } | null>
}
