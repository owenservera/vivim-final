# Quickstart: First-Run Onboarding

**Feature**: 005-first-run-onboarding | **Date**: 2025-07-17

## Validation Scenarios

### 1. Verify first-run detection works

```powershell
# Start with empty DB (no provider accounts)
# Navigate to app → should show FirstRunWizard

# Add a provider via wizard
# Reload → should skip wizard and show canvas
```

### 2. Verify feature tour

```powershell
# Complete the wizard
# Feature tour should appear with 3 highlighted areas
# Click through all 3 steps
# Reload → tour should NOT reappear (localStorage flag)
```

### 3. Verify skip behavior

```powershell
# Add a provider outside the wizard (via CLI or settings)
# Reload the app → wizard should NOT show (providerCount > 0)
```

## Files Touched

```
web/ui/src/features/canvas/
├── useFirstRun.ts      # NEW — first-run detection hook
├── FeatureTour.tsx     # NEW — 3-step tour overlay
└── FirstRunWizard.tsx  # MODIFIED — wire to provider-setup-wizard
```
