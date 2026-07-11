// src/storage/contracts/knowledge-ingestion-store.ts
// KnowledgeIngestionStore — data access contract for KnowledgeIngestionEngine.

export interface KnowledgeIngestionStore {
  createImportJob(job: {
    id: string; source: string; filePath: string; status: string;
    configJson: string; startedAt: number;
  }): Promise<void>
  updateImportJob(id: string, patch: {
    status?: string; resultJson?: string; completedAt?: number; error?: string;
  }): Promise<void>
  getImportJob(id: string): Promise<{
    id: string; source: string; filePath: string; status: string;
    configJson: string; resultJson: string | null; startedAt: number; completedAt: number | null;
  } | null>
  listImportJobs(opts?: { limit?: number }): Promise<Array<{
    id: string; source: string; status: string; startedAt: number; completedAt: number | null;
  }>>
  findExistingConversation(sourceProviderId: string, externalId: string): Promise<string | null>
}
