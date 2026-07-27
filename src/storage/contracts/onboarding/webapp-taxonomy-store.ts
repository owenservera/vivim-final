// src/storage/contracts/onboarding/webapp-taxonomy-store.ts
// Contract for the WebAppTaxonomy store. Prisma impl lives at
// src/storage/impl/onboarding/webapp-taxonomy-store-impl.ts.

export interface WebAppTaxonomyRow {
  id: string
  slug: string
  origin: 'curated' | 'auto_generated'
  displayName: string
  centroidVectorJson: string
  capabilityTemplateJson: string
  confidence: number
  sampleCount: number
}

export interface WebAppTaxonomyCreateInput {
  id: string
  slug: string
  origin: 'curated' | 'auto_generated'
  displayName: string
  centroidVectorJson: string
  capabilityTemplateJson: string
  confidence: number
  sampleCount: number
}

export interface WebAppTaxonomyStoreContract {
  listAll(): Promise<WebAppTaxonomyRow[]>
  getById(id: string): Promise<WebAppTaxonomyRow | null>
  create(row: WebAppTaxonomyCreateInput): Promise<void>
  incrementSampleCount(id: string): Promise<void>
}
