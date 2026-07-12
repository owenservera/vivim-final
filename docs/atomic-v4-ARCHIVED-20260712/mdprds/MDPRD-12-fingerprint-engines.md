> **⚠️ SUPERSEDED — See docs/atomic-v4-fork-canon/ (MASTER) for current phase specs.**
> This MDPRD has been migrated to fork-canon.

# MDPRD-12: Fingerprint Spoofing Engines

**Phase:** 12 | **Units:** 4 | **Goal:** Each fingerprint vector addressed by an independent engine

## Architecture

Each fingerprint engine is a standalone class that implements `StealthModule`:

```typescript
interface StealthModule {
  name: string
  detectionVector: string
  configSchema: z.ZodSchema
  apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void>
  verify?(ctx: StealthContext): Promise<boolean>
  description: string
}

interface StealthContext {
  cdp: CDPProxy
  slaveId: string
  logger?: StructuredLogger
}
```

Each engine registers with `StealthModuleEngine.registerModule()`. Profiles reference modules by name. New fingerprint vectors = new modules, no code changes to existing engines.

## Fingerprint Vectors Covered

| Vector | Engine | Detection Method |
|--------|--------|-----------------|
| Canvas rendering | CanvasNoiseEngine | `toDataURL()`, `toBlob()`, `getImageData()` |
| WebGL renderer | WebGlSpoofEngine | `getParameter(UNMASKED_RENDERER_WEBGL)` |
| Audio processing | AudioContextEngine | `AudioContext.createOscillator()` fingerprint |
| Font availability | FontScreenEngine | Font measurement probe |
| Screen resolution | FontScreenEngine | `screen.width`, `screen.height`, `devicePixelRatio` |

## Units

| Unit | Title | Engine |
|------|-------|--------|
| 12.1 | CanvasNoiseEngine | `src/engines/stealth/canvas-noise-engine.ts` |
| 12.2 | WebGlSpoofEngine | `src/engines/stealth/webgl-spoof-engine.ts` |
| 12.3 | AudioContextEngine | `src/engines/stealth/audio-context-engine.ts` |
| 12.4 | FontScreenEngine | `src/engines/stealth/font-screen-engine.ts` |

