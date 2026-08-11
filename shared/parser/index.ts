// shared/parser/index.ts — Barrel export for declarative parser
// Harvested from edge-pwa

export { parseObject, parseArray } from './engine.js'
export {
  jsonParse,
  trim,
  toTimestamp,
  stripHtml,
  extractLinks,
  extractAttachments,
} from './transforms.js'
export { safeGet, parsePath } from './paths.js'
export type {
  PathSegment,
  ArrayPath,
  PreprocessorType,
  TransformType,
  SelectorRule,
  Schema,
  Attachment,
  Link,
  ToolCall,
  WebSearchItem,
  WebSearch,
  MessageMetadata,
  ParserFixture,
  ProviderParserBlueprint,
} from './types.js'
