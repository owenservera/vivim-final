// shared/parser/types.ts — TypeScript Definitions for Declarative Parser
// Harvested from edge-pwa/shared/parser/types.ts

export type PathSegment = string | number;
export type ArrayPath = PathSegment[];

/** Built-in named pre-processor triggers */
export type PreprocessorType = 'jsonParse' | 'trim';

/** Built-in named post-processing transform triggers */
export type TransformType =
  | 'trim'
  | 'toTimestamp'
  | 'stripHtml'
  | 'extractLinks'
  | 'extractAttachments';

/** Single Selector Rule inside a parsing Schema */
export interface SelectorRule<T = any> {
  /** Single path to target a field (e.g. 'mapping.message.content' or [0, 1, 2]) */
  path?: string | ArrayPath;
  /** Fallback paths to search sequentially if the primary path is missing or null */
  paths?: (string | ArrayPath)[];
  /** Optional default value if all paths result in undefined/null */
  defaultValue?: T;
  /** Preprocessor to execute before extracting nested properties */
  preprocess?: PreprocessorType | ((val: any) => any);
  /** Nested schema to run on the extracted value */
  schema?: Schema<any>;
  /** Flags that the extracted value is a collection/array */
  array?: boolean;
  /** Pipeline transformations (runs on the extracted & parsed value) */
  transform?: TransformType | ((val: any, context?: any) => T | null);
}

/** Parsing Schema: a map of target fields to SelectorRules or constants */
export type Schema<T> = {
  [K in keyof T]: SelectorRule<any> | T[K] | Schema<any>;
};

// ── Rich Metadata Schemas ───────────────────────────────────────────────

export interface Attachment {
  id?: string;
  name: string;
  mimeType?: string;
  size?: number;
  url?: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'file' | 'code' | 'artifact';
  content?: string;
}

export interface Link {
  url: string;
  title?: string;
  type: 'external' | 'artifact' | 'file' | 'conversation';
}

export interface ToolCall {
  name: string;
  arguments?: any;
  output?: any;
}

export interface WebSearchItem {
  title: string;
  url: string;
  snippet?: string;
}

export interface WebSearch {
  query: string;
  results: WebSearchItem[];
}

export interface MessageMetadata {
  model?: string;
  attachments?: Attachment[];
  links?: Link[];
  tools?: ToolCall[];
  webSearch?: WebSearch;
  tokens?: {
    input?: number;
    output?: number;
    total?: number;
  };
  latencyMs?: number;
  [key: string]: any;
}

// ── Parser Blueprints ──────────────────────────────────────────────────

export interface ParserFixture {
  name: string;
  type: 'header' | 'conversation' | 'message' | 'raw';
  payload: any;
}

/** Self-contained package representing all parsing logic and tests for a provider */
export interface ProviderParserBlueprint {
  serviceId: string;
  customTransforms?: Record<string, (val: any, context?: any) => any>;
  schemas: {
    header: Schema<any>;
    conversation: Schema<any>;
    message: Schema<any>;
    [customSchemaKey: string]: Schema<any>;
  };
  fixtures?: ParserFixture[];
}
