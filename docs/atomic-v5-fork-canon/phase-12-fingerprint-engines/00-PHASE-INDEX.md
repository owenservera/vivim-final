# Phase 12: Fingerprint Spoofing Engines — Phase Index

**Units:** 4 | **Status:** [ ] pending | **Domain:** Canvas, WebGL, audio, font/screen spoofing

## Overview

Fingerprint spoofing: canvas noise perturbation, WebGL renderer/vendor spoofing,
audio context perturbation, font list + screen resolution spoofing.

## Units

| ID | Name | Priority | Status |
|----|------|----------|--------|
| 12.1 | Canvas Noise | HIGH | [ ] |
| 12.2 | WebGL Spoof | HIGH | [ ] |
| 12.3 | Audio Context | MEDIUM | [ ] |
| 12.4 | Font/Screen | MEDIUM | [ ] |

## Dependency Chain

```
12.1 → 12.2 → 12.3 → 12.4
```

## Key Design Decisions

1. **Canvas noise** — Perturb canvas fingerprint data
2. **WebGL spoof** — Fake GPU renderer + vendor strings
3. **Audio context** — Perturb audio fingerprint data
4. **Font/screen** — Spoof font list + screen resolution

## Spec References

- 12.1: `docs/atomic-v4/phase-12-fingerprint-engines/12.1-canvas-noise.md`
- 12.2: `docs/atomic-v4/phase-12-fingerprint-engines/12.2-webgl-spoof.md`
- 12.3: `docs/atomic-v4/phase-12-fingerprint-engines/12.3-audio-context.md`
- 12.4: `docs/atomic-v4/phase-12-fingerprint-engines/12.4-font-screen.md`

## Completion Criteria

- [ ] All 4 units marked [x] in tracker
- [ ] Canvas fingerprint perturbed
- [ ] WebGL renderer/vendor spoofed
- [ ] Audio fingerprint perturbed
- [ ] Font list + screen resolution spoofed
