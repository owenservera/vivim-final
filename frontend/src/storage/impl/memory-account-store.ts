/**
 * storage/impl/memory-account-store.ts
 */

import type { PlanTier } from '../../shared/route-context';
import type { AccountRow, AccountStore } from '../contracts/account-store';

export class MemoryAccountStore implements AccountStore {
  private rows = new Map<string, AccountRow>();

  async get(id: string): Promise<AccountRow | null> {
    return this.rows.get(id) ?? null;
  }

  async listForUser(userId: string): Promise<AccountRow[]> {
    return [...this.rows.values()].filter((r) => r.userId === userId);
  }

  async tierFor(accountId: string, providerId: string): Promise<PlanTier> {
    const acct = this.rows.get(accountId);
    if (!acct || acct.providerId !== providerId) return 'anonymous';
    return acct.planTier;
  }

  async upsert(row: AccountRow): Promise<AccountRow> {
    this.rows.set(row.id, row);
    return row;
  }
}
