/**
 * VIVIM AI Gateway — Plugin Manager Contract
 * @module ai/plugins/manager
 *
 * Neither prior draft actually specified this, despite the PRD spending
 * five sections (§38–43) on packaging, manifests, and supply-chain
 * security. A provider only ever becomes installable through this path —
 * the Gateway's installProvider() (see gateway/gateway.ts) delegates here.
 *
 * Trust model: "signed" answers "is this the package the publisher built
 * and did they say who they are", not "is this software safe to run".
 * Keep that distinction in any UI copy built on top of this contract.
 */

import type { PluginDescriptor, PluginId, PluginState, ProviderManifest } from '../core/types';

export interface PluginPackageRef {
  /** Local file path or registry URI — resolution is the implementation's concern. */
  readonly source: string;
  readonly expectedChecksum?: string;
}

export type PluginValidationResult =
  | { readonly valid: true; readonly manifest: ProviderManifest }
  | { readonly valid: false; readonly reason: string };

export interface IPluginManager {
  discover(source: PluginPackageRef): Promise<PluginValidationResult>;

  /** Verifies signature/checksum before anything is written to disk. Must return a PLUGIN_UNTRUSTED-coded failure rather than throwing raw crypto errors — see core/errors.ts. */
  install(source: PluginPackageRef): Promise<PluginDescriptor>;

  uninstall(pluginId: PluginId): Promise<void>;

  enable(pluginId: PluginId): Promise<void>;
  disable(pluginId: PluginId): Promise<void>;

  get(pluginId: PluginId): Promise<PluginDescriptor | undefined>;
  list(filter?: { readonly state?: PluginState }): Promise<readonly PluginDescriptor[]>;

  /** Re-runs the compliance suite (protocol/streaming/cancellation/error/capability/security tests) referenced in the PRD's certification section. */
  certify(pluginId: PluginId): Promise<{ readonly passed: boolean; readonly report: readonly string[] }>;
}
