# Fix Plan — Frontend-Backend Wiring Repair

## Date: 2026-07-24 (All 12 gaps fixed)

## Phase Order: dependency-driven (fix the base issue first, everything else depends on it)

---

## Phase 0 — Quick Wins ✅ ALL DONE

### 0.1 Gap 4: Call `autoPopulateActions()` at boot ✅ DONE
### 0.2 Gap 3: Register canvas-level catalog components ✅ DONE

---

## Phase 1 — Core Transport Fix ✅ DONE

### 1.1 Gap 1: Add backend proxy rewrites to `next.config.ts` ✅ DONE

---

## Phase 2 — Store + Engine Alignment ✅ ALL DONE

### 2.1 Gap 6: Sync shared type contracts — MONITOR (no drift detected)
### 2.2 Gap 10: Decide DB ownership per table ✅ DONE

---

## Phase 3 — Architecture Hardening ✅ ALL DONE

### 3.1 Gap 8: Decouple `agent-canvas-router.ts` cross-import ✅ DONE
### 3.2 Gap 2: Add optional `apiBase` to `BrowserUnifiedIO` ✅ DONE
### 3.3 Gap 9: Add `apiBase` to SDK `unified-io-client.ts` ✅ DONE
### 3.4 Gap 5: Migrate direct `fetch()` calls to `useIO()` ✅ DONE
### 3.5 Gap 11: Fix DevConsole WebSocket wrong port ✅ DONE
### 3.6 Gap 12: Fix SurfaceContent broken backend routes ✅ DONE

---

## Phase 4 — Polish ✅ ALL DONE

### 4.1 Gap 7: Fix stale port comment in `start-all.ps1` ✅ DONE

---

## Execution Order Summary

| Order | Gap | Effort | Risk | Status |
|-------|-----|--------|------|--------|
| 0.1 | Gap 4 — autoPopulateActions | 1 line | None | ✅ DONE |
| 0.2 | Gap 3 — canvas catalog keys | ~25 lines | Low | ✅ DONE |
| 1.1 | Gap 1 — backend proxy rewrites | 8 lines | Medium | ✅ DONE |
| 3.2 | Gap 2 — apiBase in BrowserUnifiedIO | 10 lines | Low | ✅ DONE |
| 3.4 | Gap 5 — migrate direct fetch | ~50 lines | Medium | ✅ DONE |
| 3.3 | Gap 9 — apiBase in unified-io-client | 10 lines | Low | ✅ DONE |
| 3.5 | Gap 11 — DevConsole WebSocket | 3 lines | Low | ✅ DONE |
| 3.6 | Gap 12 — SurfaceContent broken routes | ~30 lines | Low | ✅ DONE |
| 3.1 | Gap 8 — decouple cross-import | ~20 lines | Low | ✅ DONE |
| 2.2 | Gap 10 — DB ownership | ~50 lines | Low | ✅ DONE |
| 4.1 | Gap 7 — stale port comment | 1 line | None | ✅ DONE |
| 2.1 | Gap 6 — type sync | Varies | Low | MONITOR |

**Completed:** All 12 gaps fixed (Gaps 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)

---

*Updated 2026-07-24*
