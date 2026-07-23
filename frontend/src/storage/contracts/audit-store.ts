/**
 * storage/contracts/audit-store.ts
 * --------------------------------------------------------------------
 * #8 Audit Trail Dashboard — store contract.
 */

import type { AuditEntry, AuditFilter, AuditStats } from '../../shared/audit';

export interface AuditStore {
  append(entry: Omit<AuditEntry, 'id' | 'createdAt'> & { id?: string }): Promise<AuditEntry>;
  get(id: string): Promise<AuditEntry | null>;
  list(filter?: AuditFilter): Promise<AuditEntry[]>;
  findByTrace(traceId: string): Promise<AuditEntry[]>;
  stats(filter?: AuditFilter): Promise<AuditStats>;
  /** Export as JSON lines (one entry per line). */
  export(filter?: AuditFilter): Promise<string>;
  clear(): Promise<void>;
}
