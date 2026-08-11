// src/router/index.ts
// Barrel export for Router subsystem.

export { Router } from './router.js'
export type { RouteInput, RouteResult, RouteDispatcher } from './router.js'

// Route grammar parser — parse route spec strings like "claude,gemini" or "@ready -chatgpt".
export { parseRouteSpec, stringifyRouteSpec } from './route-grammar.js'
export type { RouteSpec, RouteTarget, RouteSpecKind, SingleRouteSpec, ListRouteSpec, PresetRouteSpec, DiffRouteSpec } from './route-grammar.js'
export type { PresetName } from './route-grammar.js'
