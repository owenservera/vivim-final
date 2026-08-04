# Specifications

Every fix in this package has a testable spec. A spec is only satisfied
when its verification step passes on a clean checkout of main.

#### WEB-S1

- **Requirement**: The GA4 measurement ID MUST be read from ENV, not hardcoded.
- **Verification**: git grep -E 'G-[A-Z0-9]{8,}' returns 0 matches in app/ or config/.

#### WEB-S2

- **Requirement**: Every user-facing string in app/views and app/helpers MUST go through t() or I18n.t.
- **Verification**: Static scan of app/helpers and app/views for literal marketing strings returns 0 hits.

#### WEB-S3

- **Requirement**: The homepage MUST include a valid LocalBusiness JSON-LD block.
- **Verification**: Google Rich Results Test on https://vivim.net returns 0 errors and detects LocalBusiness.

#### WEB-S4

- **Requirement**: The homepage MUST include rel=canonical and 9 social meta tags.
- **Verification**: curl -s vivim.net | grep -cE 'rel="canonical"|og:title|og:description|og:url|og:image|og:type|twitter:card|twitter:title|twitter:description|twitter:image' outputs >= 10.

#### WEB-S5

- **Requirement**: robots.txt MUST contain a Sitemap: directive and Disallow /up.
- **Verification**: curl vivim.net/robots.txt | grep -c 'Sitemap:\|Disallow: /up' outputs >= 2.

#### WEB-S6

- **Requirement**: No asset URL in the layout MAY use http:// (all must be https:// or protocol-relative).
- **Verification**: grep -E 'http://[^"]+' app/views/layouts/ returns 0 matches.
