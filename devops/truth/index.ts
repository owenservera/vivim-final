// devops/truth/index.ts
// Barrel export for truth grounding system

export type { FileClassification, FileReport, ScanResult } from './scanner.ts'
export type { DesignClaim, DesignComparisonResult } from './design-comparator.ts'
export type { InterfaceComparisonResult, InterfaceComparison, MethodStatus } from './interface-comparator.ts'
export type { Gap, GapReport, GapSeverity, GapType } from './gap-generator.ts'

export { scanRoot, scanFile, scanDirectory } from './scanner.ts'
export { loadDesignDocs, compareDesignToCode } from './design-comparator.ts'
export { compareInterfaces } from './interface-comparator.ts'
export { generateGapReport } from './gap-generator.ts'
export { runTruthCommand } from './cli.ts'
