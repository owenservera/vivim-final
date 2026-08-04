# Specifications

Every fix in this package has a testable spec. A spec is only satisfied
when its verification step passes on a clean checkout of main.

#### UX8-S1

- **Requirement**: No .coffee files MAY exist in app/assets/javascripts/.
- **Verification**: find app/assets -name '*.coffee' returns 0 matches.

#### UX8-S2

- **Requirement**: No turbolinks references MAY exist in app/, config/, or Gemfile.
- **Verification**: grep -ri turbolinks app/ config/ Gemfile returns 0 matches.

#### UX8-S3

- **Requirement**: No jQuery globals MAY be loaded (no jquery-rails gem, no $ global).
- **Verification**: grep -E "gem 'jquery-rails'" Gemfile returns 0 matches; console.log(typeof $) in browser console returns 'undefined' on a fresh page load.

#### UX8-S4

- **Requirement**: The Google Fonts <link> MUST be preceded by preconnect to fonts.googleapis.com and fonts.gstatic.com.
- **Verification**: curl -s vivim.net/ | grep -B2 'fonts.googleapis.com' shows both preconnect lines.

#### UX8-S5

- **Requirement**: All <img> tags in app/views/index/index.html.slim MUST be wrapped in <picture> with WebP and AVIF sources.
- **Verification**: grep -c '<picture>' app/views/index/index.html.slim is >= 10 (one per carousel image).

#### UX8-S6

- **Requirement**: No .sass files MAY exist in app/assets/stylesheets/ (only .scss or .css).
- **Verification**: find app/assets -name '*.sass' returns 0 matches.

#### UX8-S7

- **Requirement**: The total JS payload on the homepage (gzipped) MUST be < 40KB.
- **Verification**: Lighthouse 'reduce JavaScript execution time' shows total <= 40KB gzipped; or: curl the JS bundle, pipe through gzip -c | wc -c, result is < 40960.

#### UX8-S8

- **Requirement**: No jQuery plugin (flexslider, colorbox, owl.carousel) MAY be required in application.js or application.css.
- **Verification**: grep -E 'flexslider|colorbox|owl.carousel' app/assets/javascripts/ app/assets/stylesheets/ returns 0 matches.
