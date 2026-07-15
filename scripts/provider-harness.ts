// scripts/provider-harness.ts
// Unit 32.1 — `bun run providers:smoke` entry point.
// Runs the provider test harness against the real DB and exits non-zero on any
// provider regression (so it can gate CI / `bun run devops gate`).

import { getDb } from "../src/storage/db.js";
import { ProviderStoreImpl } from "../src/storage/impl/provider-store-impl.js";
import { runProviderHarness, formatHarnessMatrix } from "../src/cli/provider-harness.js";

const db = getDb();
const store = new ProviderStoreImpl(db);
const report = await runProviderHarness({ store });

console.log(formatHarnessMatrix(report));

if (report.failed > 0) {
  process.exit(1);
}
