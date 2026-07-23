/**
 * storage/contracts/canvas-definition-store.ts
 * --------------------------------------------------------------------
 * CanvasDefinition store contract. Definitions are published rows
 * (`html, css, scriptUrl, bindingsJson, layoutJson, sandboxJson, status`).
 * No build step between imagining a layer and running it (invariant 7).
 */

import type { CanvasDefinition, LayerStatus } from '../../shared/canvas-types';

export interface CanvasDefinitionInput {
  slug: string;
  name: string;
  description: string;
  category: CanvasDefinition['category'];
  html: string;
  css: string;
  scriptUrl?: string;
  bindings?: CanvasDefinition['bindings'];
  layout?: CanvasDefinition['layout'];
  sandbox?: CanvasDefinition['sandbox'];
  author?: CanvasDefinition['author'];
  status?: LayerStatus;
  tags?: string[];
}

export interface CanvasDefinitionStore {
  define(input: CanvasDefinitionInput): Promise<CanvasDefinition>;
  get(id: string): Promise<CanvasDefinition | null>;
  getBySlug(slug: string): Promise<CanvasDefinition | null>;
  list(filter?: { category?: string; status?: LayerStatus }): Promise<CanvasDefinition[]>;
  update(id: string, patch: Partial<CanvasDefinitionInput>): Promise<CanvasDefinition>;
  deprecate(id: string): Promise<boolean>;
}
