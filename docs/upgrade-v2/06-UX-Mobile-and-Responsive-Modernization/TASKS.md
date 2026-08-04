# Task list

Tasks are ordered by dependency within the package. Effort estimates
use T-shirt sizes (S = half day, M = 1-3 days, L = 3+ days).

#### [UX6-T01] Upgrade Bootstrap 3 -> 5.3 and update navbar markup  (_effort: L_)

- **Acceptance**: Navbar collapses/expands on mobile; no BS3 classes remain in markup; bundle size < 80KB CSS gzipped.

#### [UX6-T02] Replace all 22 img-responsive classes with img-fluid  (_effort: S_)

- **Acceptance**: grep -rn 'img-responsive' app/views/ returns 0; transitional .img-responsive alias in _responsive.scss keeps any missed usage working.

#### [UX6-T03] Generate WebP variants and add srcset/sizes to hero + features  (_effort: M_)

- **Acceptance**: Lighthouse 'properly size images' opportunity is < 50KB; PageSpeed Insights mobile score >= 90.

#### [UX6-T04] Add apple-touch-icon, theme-color, and manifest.json  (_effort: S_)

- **Acceptance**: iOS 'Add to Home Screen' shows the Vivim icon; Chrome devtools Application > Manifest shows no errors.

#### [UX6-T05] Make Owl Carousel respect prefers-reduced-motion and add nav controls  (_effort: S_)

- **Acceptance**: Toggle OS reduced motion -> carousel stops auto-playing; prev/next arrows are visible and clickable.

#### [UX6-T06] Replace Colorbox with GLightbox (touch + swipe)  (_effort: M_)

- **Acceptance**: Tapping a project screenshot opens lightbox; swipe left/right advances; tap outside closes.

#### [UX6-T07] Make copyright year dynamic  (_effort: S_)

- **Acceptance**: View source shows the current year, not 2014.

#### [UX6-T08] Add viewport-fit=cover and safe-area-inset padding  (_effort: S_)

- **Acceptance**: iPhone X+ landscape shows no black bars; footer reaches the screen edge.

## Definition of done

A task is done when:

1. Its acceptance criterion is met on a clean checkout.
2. The matching spec's verification step passes.
3. The change is covered by a test (new or existing).
4. The CHANGELOG has an entry under `[Unreleased]`.
