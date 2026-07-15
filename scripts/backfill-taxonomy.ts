// scripts/backfill-taxonomy.ts
// Unit 1.3 — One-shot backfill: provider capability blobs → taxonomy rows.
// Run after adding CapabilityOverride/CapabilityIntent tables.

import { getDb, setDb } from '../src/storage/db.js';
import { ProviderStoreImpl } from '../src/storage/impl/provider-store-impl.js';

async function backfill() {
  const db = getDb();
  const store = new ProviderStoreImpl(db);

  // Get all providers with their capability blobs
  const providers = await db.prisma.providerDefinition.findMany({
    select: { id: true, slug: true, capabilitiesJson: true },
  });

  let totalTaxonomyRows = 0;

  for (const prov of providers) {
    const caps = JSON.parse(prov.capabilitiesJson || '{}');
    for (const [slug, cap] of Object.entries(caps) as Array<[string, unknown]>) {
      const capDef = cap as {
        title?: string;
        description?: string;
        category?: string;
        intent?: string;
        selector?: string;
        version?: string;
      };
      const result = await store.registerCapability({
        providerId: prov.id,
        slug,
        title: capDef.title ?? slug,
        description: capDef.description,
        category: capDef.category,
        intent: capDef.intent,
        selector: capDef.selector,
        version: capDef.version,
      });
      console.log(`Backfilled capability: ${prov.slug}/${slug} → ${result.id}`);
      totalTaxonomyRows++;
    }
  }

  // Reconcile: ensure row count matches sum of blob caps
  const taxonomyCount = await db.prisma.capabilityTaxonomy.count();
  console.log(`Done. Taxonomy rows: ${taxonomyCount} (expected >= ${totalTaxonomyRows})`);

  if (taxonomyCount < totalTaxonomyRows) {
    console.error('ERROR: taxonomy row count mismatch');
    process.exit(1);
  }
}

if (import.meta.main) {
  backfill().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
}