# Phase 8: SOTA — Shape-Agnostic Registration (6 units)

**Phase:** 8 | **Depends:** Phase 1-7 | **Source:** SOTA-02

## 8.1: CapabilityShapeRegistry (`src/engines/capability-shape-registry.ts`)
Meta-registry of known capability archetypes. Providers adopt or extend shapes.

```typescript
class CapabilityShapeRegistry {
  getShape(shapeId: string): CapabilityShape | null;
  listShapes(): CapabilityShape[];
  registerShape(shape: CapabilityShape): void;
  getAdapter(shapeId: string): CapabilityAdapter | null;
  matchShape(domIndicators: DomIndicator[]): { shapeId: string; confidence: number } | null;
}

interface CapabilityShape {
  id: string; name: string;
  expectedCapabilities: Record<string, 'required' | 'optional' | 'extended'>;
  discoveryHints: { urlPatterns: string[]; domIndicators: DomIndicator[]; interactiveElementPatterns: InteractiveElementPattern[] };
  projectionRules: { composer: ProjectionRule; modelSelector?: ProjectionRule; messageList: ProjectionRule };
  parserExpectations: { responseFormat: 'sse' | 'json' | 'html' | 'websocket' | 'custom'; parserArchetype: string; fallbackStrategy: 'plain_text' | 'html_extract' | 'raw' };
}
```

**Built-in shapes:** chat_app, coding_ide, search_engine, design_tool, data_dashboard, custom

## 8.2: ProviderDiscoveryEngine (`src/engines/provider-discovery.ts`)
Explore URL → infer capabilities → generate draft manifest.

```typescript
class ProviderDiscoveryEngine {
  async discover(url: string, opts?: DiscoveryOptions): Promise<DiscoverySession>;
  async getDiscoverySession(sessionId: string): Promise<DiscoverySession | null>;
  async approveDiscovery(sessionId: string, edits?: ManifestEdits, approver: string): Promise<RegisterResult>;
  async interactiveDiscover(url: string): Promise<InteractiveDiscoverySession>;
}
```

**Discovery flow:** Navigate→DOM Snapshot→Shape Detection→Capability Inference→Interactive Probe→Parser Format Detection→Manifest Generation→Operator Review

## 8.3: ManifestInferenceEngine (`src/engines/manifest-inference.ts`)
Transform discovery results → valid ProviderManifest JSON.

```typescript
class ManifestInferenceEngine {
  async infer(session: DiscoverySession): Promise<InferredManifest>;
  async applyEdits(manifest: ProviderManifest, edits: ManifestEdits): Promise<ProviderManifest>;
  async validate(manifest: ProviderManifest): Promise<ValidationResult>;
}
```

## 8.4: Polymorphic Capability Resolution
Extended CapabilityResolutionEngine uses adapters to transform shape-specific capabilities into universal ResolvedCapability.

```typescript
interface CapabilityAdapter {
  shapeId: string;
  toUniversal(shapeSpecific: ShapeSpecificCapability, shapeContext: CapabilityShape): ResolvedCapability;
  fromUniversal(action: MirrorAction, shapeContext: CapabilityShape): HarnessDAG;
  projectState(rawState: Record<string, unknown>, shapeContext: CapabilityShape): Partial<MirrorState>;
}
```

## 8.5: Plugin System (Escape Hatch)
```typescript
interface ProviderPlugin {
  providerId: string;
  onRegister(manifest: ProviderManifest): Promise<void>;
  onResolveCapabilities(providerId: string, planTier: PlanTier): Promise<ResolvedCapability[] | null>;
  onAction(action: MirrorAction): Promise<MirrorAction | null>;
  onProjectState(rawState: Record<string, unknown>): Promise<Record<string, unknown>>;
  onParse(rawBody: string): Promise<ContentBlock[] | null>;
}
```

## 8.6: Schema Delta (SOTA-07 Phase 8 tables)
New tables: provider_archetype, provider_shape_binding, discovery_session, discovery_result, capability_shape, capability_shape_binding. Modified: provider_definition (+archetype_id, +discovery_session_id, +is_self_describing), capability_taxonomy (+shape_id, +is_discovered).

## Gate
- Discovery engine finds capabilities for known provider with >0.8 confidence
- ManifestInferenceEngine produces valid ProviderManifest
- Self-describing protocol registration works end-to-end
- Plugin hooks execute in correct order
- Polymorphic resolution works with adapters
