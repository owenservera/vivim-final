# Task list

Tasks are ordered by dependency within the package. Effort estimates
use T-shirt sizes (S = half day, M = 1-3 days, L = 3+ days).

#### [UX8-T01] Transpile application.js.coffee to vanilla ES6+ application.js  (_effort: M_)

- **Acceptance**: No .coffee files remain in app/assets/javascripts/; the carousel and lightbox still work.

#### [UX8-T02] Replace turbolinks with @hotwired/turbo-rails  (_effort: M_)

- **Acceptance**: grep -r turbolinks app/ config/ returns 0 matches; page transitions still feel instant.

#### [UX8-T03] Remove jQuery and replace all $() calls with native DOM APIs  (_effort: L_)

- **Acceptance**: grep -rn 'jQuery\|\$(' app/assets/javascripts/ returns 0; bundle size drops by >= 90KB raw.

#### [UX8-T04] Add preconnect for Google Fonts and trim to 4 weights  (_effort: S_)

- **Acceptance**: Lighthouse 'eliminate render-blocking resources' shows the font as no longer blocking; font request size < 8KB.

#### [UX8-T05] Convert all 19 PNG screenshots to WebP + AVIF with <picture>  (_effort: M_)

- **Acceptance**: Lighthouse 'image formats' opportunity is 0KB; total image payload drops by >= 40%.

#### [UX8-T06] Rename application.css.sass to .scss and convert syntax  (_effort: S_)

- **Acceptance**: sass-convert succeeds; find app/assets -name '*.sass' returns 0 matches.

#### [UX8-T07] Audit and remove unused jQuery plugins (flexslider)  (_effort: S_)

- **Acceptance**: grep -r flexslider app/views/ returns 0 matches; flexslider JS removed from manifest.

#### [UX8-T08] Add crossorigin + integrity to Google Fonts link  (_effort: S_)

- **Acceptance**: View source shows crossorigin='anonymous' and integrity='sha384-...' on the font <link>.

## Definition of done

A task is done when:

1. Its acceptance criterion is met on a clean checkout.
2. The matching spec's verification step passes.
3. The change is covered by a test (new or existing).
4. The CHANGELOG has an entry under `[Unreleased]`.
