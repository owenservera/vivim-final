# Data Model: First-Run Onboarding

**Feature**: 005-first-run-onboarding | **Date**: 2025-07-17

## Frontend State (React + localStorage)

### OnboardingState

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| showWizard | boolean | useFirstRun() hook | Computed: true if providerCount === 0 && !localStorage flag |
| providerCount | number | GET /api/providers | Number of configured provider accounts |
| onboardingComplete | boolean | localStorage `vivim.onboarding_complete` | Persisted flag set on wizard completion |
| tourComplete | boolean | localStorage `vivim.tour_complete` | Persisted flag set when user completes feature tour |
| currentStep | WizardStep | FirstRunWizard state | welcome → providers → workspace → import → done |
| installStatus | Record<string,string> | FirstRunWizard state | Per-provider install result ('ok' / error message) |

## No DB Entities Needed

This is a frontend-only feature. All backend data (providers, accounts, canvas layers) already exists in Prisma schema. No new tables or store contracts required.
