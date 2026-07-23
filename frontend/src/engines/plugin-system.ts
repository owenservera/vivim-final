/**
 * engines/plugin-system.ts
 * --------------------------------------------------------------------
 * Self-describing provider escape hatch (bundle 04 plugin-system.ts).
 * A `ProviderPlugin` registers hooks for capability resolution / actions
 * / parsing. PluginSystem manages the in-memory registry.
 */

export interface ProviderPlugin {
  providerId: string;
  onRegister?(manifest: unknown): Promise<void>;
  onResolveCapabilities?(providerId: string, planTier: string): Promise<Record<string, unknown>[] | null>;
  onAction?(action: Record<string, unknown>): Promise<Record<string, unknown> | null>;
}

export class PluginManager {
  private plugins = new Map<string, ProviderPlugin>();

  register(plugin: ProviderPlugin): void {
    this.plugins.set(plugin.providerId, plugin);
  }

  unregister(providerId: string): void {
    this.plugins.delete(providerId);
  }

  getPlugin(providerId: string): ProviderPlugin | null {
    return this.plugins.get(providerId) ?? null;
  }

  list(): ProviderPlugin[] {
    return [...this.plugins.values()];
  }
}
