// src/storage/contracts/registration-store.ts
// Store contract for RegistrationAuditor — manifest versions, events, drifts.

import type {
  ManifestDriftInput,
  ManifestDriftRow,
  ManifestVersionInput,
  ProviderManifestVersionRow,
  RegistrationEventInput,
  RegistrationEventRow,
} from '../../schema/types.js'

export interface RegistrationStore {
  createManifestVersion(input: ManifestVersionInput): Promise<ProviderManifestVersionRow>
  getLatestManifestVersion(
    providerId: string,
    file: string,
  ): Promise<ProviderManifestVersionRow | null>
  getManifestVersionHistory(
    providerId: string,
    limit?: number,
  ): Promise<ProviderManifestVersionRow[]>
  createRegistrationEvent(input: RegistrationEventInput): Promise<RegistrationEventRow>
  getRegistrationEvents(
    providerId: string,
    opts?: { limit?: number; since?: number },
  ): Promise<RegistrationEventRow[]>
  getRegistrationEventsByTable(
    table: string,
    opts?: { limit?: number },
  ): Promise<RegistrationEventRow[]>
  createManifestDrift(drift: ManifestDriftInput): Promise<ManifestDriftRow>
  getUnresolvedDrifts(providerId: string): Promise<ManifestDriftRow[]>
  resolveDrift(driftId: string, actor: string): Promise<void>
  getDriftHistory(providerId: string, limit?: number): Promise<ManifestDriftRow[]>
}
