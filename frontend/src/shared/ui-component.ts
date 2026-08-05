/**
 * shared/ui-component.ts
 * --------------------------------------------------------------------
 * UiComponent DB shape (bundle 01 §3.4) — one row per (primitive, scope,
 * owner, variant) encoding all 6 resolution tiers via @@unique.
 */

import type { PrimitiveScope } from './conceptual-model';
import type { RegionRect } from './conceptual-model';

export type UiComponentStatus = 'draft' | 'published' | 'deprecated';
export type UiComponentAuthor = 'system' | 'user' | 'agent';
export type ComponentArchetype = 'list' | 'form' | 'display' | 'overlay' | 'card' | 'grid';

export interface ComponentConstraints {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  aspectRatio?: number;
  resizable: boolean;
  resizeAxes: 'both' | 'x' | 'y' | 'none';
}

export interface ComponentContract {
  inputs: Record<string, { type: string; required: boolean; description?: string; default?: unknown }>;
  outputs: Array<{ event: string; payload?: Record<string, string>; description?: string }>;
  subscriptions: string[];
}

export interface UiComponent {
  id: string;
  primitiveId: string;
  scope: PrimitiveScope;
  ownerId: string; // familyId | providerId | 'global'
  variant: string | null;
  componentKey: string;
  displayName: string;
  html: string;
  css: string;
  scriptUrl: string | null;
  sandboxJson: string;
  constraintsJson: string;
  contractJson: string;
  archetype: ComponentArchetype | null;
  version: number;
  status: UiComponentStatus;
  author: UiComponentAuthor;
  defaultRegion: RegionRect | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/** Build the unique key for a UiComponent row (used by store + tests). */
export function uiComponentKey(parts: {
  primitiveId: string;
  scope: PrimitiveScope;
  ownerId: string;
  variant: string | null;
}): string {
  return [parts.primitiveId, parts.scope, parts.ownerId, parts.variant ?? '_'].join('|');
}
