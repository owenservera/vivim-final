// src/storage/contracts/mirror-store.ts
// MirrorStore — re-exports the contract defined in mirror-engine.ts

export type {
  MirrorStore,
  MirrorStateRow,
  MirrorStateInput,
  OptimisticUpdateRow,
  OptimisticUpdateInput,
  LatencyMeasurementInput,
  LatencyReport,
  SnapshotRow,
  SnapshotInput,
} from '../../engines/mirror-engine.js'
