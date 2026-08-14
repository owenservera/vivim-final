// src/arch/index.ts
// Barrel export for the architectural boundary guard system.
//
// This module provides build-time enforcement of import rules between
// VIVIM's architectural layers. Use `scanBoundaryViolations()` from a
// DevOps script or CI pipeline to catch cross-layer coupling violations.

export {
  BOUNDARY_RULES,
  type BoundaryRule,
  classifyPath,
  getRule,
  type ImportVerdict,
  isImportAllowed,
  resolveAlias,
} from './boundary-rules.js'

export {
  type ScanOptions,
  type ScanResult,
  scanBoundaryViolations,
  scanFile,
  type Violation,
} from './boundary-scanner.js'
