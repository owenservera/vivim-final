/**
 * shared/canvas-types.ts
 * --------------------------------------------------------------------
 * Contract bridge between Bun/Next backend and React frontend.
 * Mirrors bundle 01 §3.1 (CanvasDefinition / LayerHost / SandboxPolicy).
 * No `any`, no runtime deps, safe to import from both sides.
 */

export type PrimitiveKind =
  | 'workspace'
  | 'projects'
  | 'knowledge'
  | 'agents'
  | 'providers'
  | 'conversations';

export type LayerCategory =
  | 'system'
  | 'chat'
  | 'automation'
  | 'agents'
  | 'projects'
  | 'knowledge'
  | 'designer'
  | 'plugin';

export type LayerAuthor = 'system' | 'user' | 'agent';
export type LayerStatus = 'draft' | 'published' | 'deprecated';
export type InstanceStatus = 'mounting' | 'live' | 'dismissed' | 'error';

/**
 * P8 sandbox policy. `allowInlineScript` is a literal `false` so that any
 * attempt to override it to `true` fails type-check AND schema validation.
 */
export interface SandboxPolicy {
  csp: string;
  allowNetwork: boolean;
  allowCapabilities: string[];
  budgetMs: number;
  allowInlineScript: false;
}

export interface CanvasLayout {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  minimized?: boolean;
  detailZoom?: number;
}

export interface LayerBinding {
  regionId: string;
  role: string;
  selector: string;
  primitive?: PrimitiveKind;
  capabilitySlug?: string;
  direction: 'read' | 'write' | 'bidirectional';
}

export interface CanvasDefinition {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: LayerCategory;
  version: number;
  html: string;
  css: string;
  scriptUrl?: string;
  bindings: LayerBinding[];
  layout: CanvasLayout;
  author: LayerAuthor;
  sandbox: SandboxPolicy;
  status: LayerStatus;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface LayerHost {
  mount(instanceId: string, def: CanvasDefinition): Promise<{ hostNodeId: string }>;
  unmount(instanceId: string): Promise<void>;
  isMounted(instanceId: string): boolean;
}

/**
 * Default CSP: deny everything except the sandboxed script (loaded from
 * `scriptUrl` Blob) and inline styles (sandboxed CSS is shipped as a Blob
 * too). Inline scripts are NEVER allowed (P8).
 */
export const DEFAULT_SANDBOX_CSP =
  "default-src 'none'; script-src 'self' blob:; style-src 'unsafe-inline' blob:; img-src 'self' data: blob:; connect-src 'none';";

/** Build a sandbox policy that always forces `allowInlineScript: false`. */
export function buildSandboxPolicy(input: {
  allowCapabilities?: string[];
  allowNetwork?: boolean;
  budgetMs?: number;
  csp?: string;
}): SandboxPolicy {
  return {
    csp: input.csp ?? DEFAULT_SANDBOX_CSP,
    allowNetwork: input.allowNetwork ?? false,
    allowCapabilities: input.allowCapabilities ?? [],
    budgetMs: input.budgetMs ?? 5_000,
    // Hard-coded — never overridable. S93 invariant.
    allowInlineScript: false,
  };
}
