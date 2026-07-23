/**
 * storage/contracts/account-store.ts
 * --------------------------------------------------------------------
 * Account store + plan-tier lookup (bundle 02 §B.2 step 6, S09/S50/S86).
 */

import type { PlanTier } from '../../shared/route-context';

export interface AccountRow {
  id: string;
  providerId: string;
  userId: string;
  planTier: PlanTier;
}

export interface AccountStore {
  get(id: string): Promise<AccountRow | null>;
  listForUser(userId: string): Promise<AccountRow[]>;
  tierFor(accountId: string, providerId: string): Promise<PlanTier>;
  upsert(row: AccountRow): Promise<AccountRow>;
}
