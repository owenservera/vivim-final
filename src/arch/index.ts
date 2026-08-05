// src/arch/index.ts
// Barrel export for the architectural boundary guard system.
//
// This module provides build-time enforcement of import rules between
// VIVIM's architectural layers. Use `scanBoundaryViolations()` from a
// DevOps script or CI pipeline to catch cross-layer coupling violations.

export {
  BOUNDARY_RULES,
  classifyPath,
  getRule,
  isImportAllowed,
  resolveAlias,
  type BoundaryRule,
  type ImportVerdict,
} from './boundary-rules.js'

export {
  scanBoundaryViolations,
  scanFile,
  type Violation,
  type ScanResult,
  type ScanOptions,
} from './boundary-scanner.js'
