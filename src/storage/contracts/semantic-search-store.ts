// src/storage/contracts/semantic-search-store.ts
// SemanticSearchStore — data access for embeddings.

export interface SemanticSearchStore {
  upsertEmbedding(input: {
    id: string; entityType: string; entityId: string;
    embedding: string; model: string; dimensions: number;
    contentHash: string; createdAt: number;
  }): Promise<void>
  getEmbedding(entityType: string, entityId: string): Promise<{
    id: string; embedding: string; model: string; dimensions: number;
  } | null>
  searchByEmbedding(embedding: number[], opts: {
    limit?: number; threshold?: number; entityType?: string;
  }): Promise<Array<{ entityId: string; entityType: string; score: number }>>
  deleteEmbedding(entityType: string, entityId: string): Promise<void>
  countEmbeddings(opts?: { entityType?: string }): Promise<number>
}
