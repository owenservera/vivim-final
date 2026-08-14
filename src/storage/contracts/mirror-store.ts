// src/storage/contracts/mirror-store.ts
// MirrorStore — re-exports the contract defined in mirror-engine.ts

export type {
  LatencyMeasurementInput,
  LatencyReport,
  MirrorStateInput,
  MirrorStateRow,
  MirrorStore,
  OptimisticUpdateInput,
  OptimisticUpdateRow,
  SnapshotInput,
  SnapshotRow,
} from '../../engines/mirror-engine.js'
