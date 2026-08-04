# Task list

Tasks are ordered by dependency within the package. Effort estimates
use T-shirt sizes (S = half day, M = 1-3 days, L = 3+ days).

#### [WEB-T01] Replace analytics.js with GA4 gtag.js  (_effort: S_)

- **Acceptance**: GA4 Realtime report shows a live visitor when the homepage loads; GA4 measurement ID from env var.

#### [WEB-T02] Move all marketing copy to config/locales/en.yml  (_effort: M_)

- **Acceptance**: grep -E "'Denver" app/helpers/ returns 0; all strings go through t().

#### [WEB-T03] Delete the meta keywords tag  (_effort: S_)

- **Acceptance**: grep 'keywords' app/views/layouts/ returns 0 (other than in comments).

#### [WEB-T04] Add canonical + Open Graph + Twitter Card tags  (_effort: S_)

- **Acceptance**: View source on homepage shows all 9 social meta tags; Facebook debugger renders a preview.

#### [WEB-T05] Add LocalBusiness JSON-LD structured data  (_effort: M_)

- **Acceptance**: Google Rich Results Test passes for the homepage; LocalBusiness card validates.

#### [WEB-T06] Fix Google Fonts URL to HTTPS  (_effort: S_)

- **Acceptance**: View source shows https://fonts; no mixed-content warning in browser console.

#### [WEB-T07] Externalize sitemap host and refresh on deploy  (_effort: S_)

- **Acceptance**: SITE_HOST env var changes the sitemap host; deploy triggers sitemap refresh.

#### [WEB-T08] Write real robots.txt with Sitemap directive  (_effort: S_)

- **Acceptance**: curl vivim.net/robots.txt returns non-commented rules and a Sitemap: line.

## Definition of done

A task is done when:

1. Its acceptance criterion is met on a clean checkout.
2. The matching spec's verification step passes.
3. The change is covered by a test (new or existing).
4. The CHANGELOG has an entry under `[Unreleased]`.
