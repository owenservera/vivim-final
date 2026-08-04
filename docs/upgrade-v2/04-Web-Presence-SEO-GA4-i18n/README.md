# Web Presence: SEO, GA4, i18n Refresh

> Upgrade package for **vivim** v0.1.0
> Package: 4 of 9 (deep analysis)
> Generated: 2026-08-02T23:40:45.700Z

## What this package is

Google Analytics Universal (analytics.js) was sunset in July 2023 - the site collects zero analytics today. Marketing copy is hardcoded in Ruby helper methods instead of i18n files. The sitemap config is hardcoded to vivim.net. There is no JSON-LD structured data, no canonical tags, and robots.txt is fully commented out.

## Why this package

A marketing website's only job is to be found and convert. Today the site is invisible to modern analytics, partially indexed by search engines, and every copy change requires a Ruby deploy. Fixing this package restores measurement, improves discoverability, and unblocks non-technical content edits.

## Findings (each grounded in a specific file:line citation)

- [HIGH] WEB-01 - Google Analytics Universal (analytics.js) was sunset July 2023 (app/views/layouts/_google_analytics_js.html.erb:2-9)
- [MEDIUM] WEB-02 - All marketing copy is hardcoded in Ruby helper methods, not i18n (app/helpers/application_helper.rb:2-12, config/locales/en.yml:1-20)
- [MEDIUM] WEB-03 - Sitemap config hardcoded to www.vivim.net (config/sitemap.rb:1-9, public/sitemaps/sitemap.xml:1)
- [MEDIUM] WEB-04 - robots.txt is fully commented out (public/robots.txt:1-5)
- [LOW] WEB-05 - No canonical URL or Open Graph tags (app/views/layouts/application.html.slim:1-18)
- [LOW] WEB-06 - No JSON-LD structured data (app/views/layouts/application.html.slim:1-18, app/views/index/index.html.slim:1-135)
- [LOW] WEB-07 - Google Fonts loaded over HTTP (not HTTPS) (app/views/layouts/application.html.slim:16)

## How to apply this package

1. Unzip the package into a working directory.
2. Read `ANALYSIS.md` end to end - it documents every defect with the
   exact file and line number where it was found.
3. Read `ARCHITECTURE.md` for the proposed changes and their order.
4. Work through `TASKS.md` in order; each task cites the finding it fixes.
5. For each task, verify the matching spec in `SPECS.md` before marking it done.
6. `EVIDENCE.json` is the machine-readable list of every citation; use it
   to cross-check claims or feed an automated verifier.
7. `src/` contains the patched or new files; copy them into the repo,
   resolving any conflicts with the current state.

## Truth-grounded guarantee

Every claim in this package is backed by a citation to a real file and
line number in the cloned vivim repository (commit 71886e9,
2014-12-22). If a claim cannot be verified by reading the cited file at
the cited line, it should be treated as invalid and discarded.

## Source repository

- **Name**: vivim
- **URL**:  https://github.com/vivim/vivim
- **Version**: 0.1.0
- **Commit inspected**: 71886e93f5743ed49d3b7ca3380644e9e054f60b
- **Commit date**: 2014-12-22

## License

Contents inherit the vivim repository's license. New files are MIT.
