// src/router/index.ts
// Barrel export for Router subsystem.

export type {
  DiffRouteSpec,
  ListRouteSpec,
  PresetName,
  PresetRouteSpec,
  RouteSpec,
  RouteSpecKind,
  RouteTarget,
  SingleRouteSpec,
} from './route-grammar.js'

// Route grammar parser — parse route spec strings like "claude,gemini" or "@ready -chatgpt".
export { parseRouteSpec, stringifyRouteSpec } from './route-grammar.js'
export type { RouteDispatcher, RouteInput, RouteResult } from './router.js'
export { Router } from './router.js'
