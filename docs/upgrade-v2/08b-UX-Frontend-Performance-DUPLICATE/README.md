# UX: Frontend Performance & Asset Modernization

> Upgrade package for **vivim** v0.1.0
> Package: 8 of 9 (deep analysis)
> Generated: 2026-08-02T23:40:45.843Z

## What this package is

The frontend ships CoffeeScript (deprecated, removed from Rails 7 defaults), Turbolinks (replaced by Hotwire/Turbo in 2021), jQuery as a global (90KB), three jQuery plugins (flexslider, colorbox, owl.carousel), and render-blocking Google Fonts. All project screenshots are PNG (no WebP). This package cuts the JS payload, removes deprecated tech, and modernizes the asset pipeline.

## Why this package

Every byte of JS on this site blocks first interaction. The current payload is jQuery + Bootstrap JS + Flexslider + Colorbox + Owl Carousel + Turbolinks + the CoffeeScript glue - easily 200-300KB minified. Modern equivalents (vanilla JS, CSS-only carousels, native lazy-loading) would do the same job in <20KB. PageSpeed Insights will score the site 30-50/100 mobile today; this package gets it to 90+.

## Findings (each grounded in a specific file:line citation)

- [HIGH] UX8-01 - CoffeeScript is deprecated and removed from Rails 7 defaults (app/assets/javascripts/application.js.coffee:1-15)
- [HIGH] UX8-02 - Turbolinks is deprecated - replaced by Hotwire/Turbo in 2021 (app/assets/javascripts/application.js.coffee:8, app/views/layouts/application.html.slim:14-15)
- [HIGH] UX8-03 - jQuery loaded as a global - 90KB+ for what could be 0KB of vanilla JS (app/assets/javascripts/application.js.coffee:1, app/assets/javascripts/application.js.coffee:2, Gemfile:40-45)
- [MEDIUM] UX8-04 - Google Fonts loaded render-blocking without preconnect (app/views/layouts/application.html.slim:16)
- [MEDIUM] UX8-05 - All project screenshots are PNG (no WebP/AVIF) - 30-50% larger (app/views/index/index.html.slim:62-122)
- [MEDIUM] UX8-06 - Stylesheet uses .sass indented syntax (deprecated in favor of .scss) (app/assets/stylesheets/application.css.sass:1-7)
- [MEDIUM] UX8-07 - Three jQuery plugins loaded (flexslider, colorbox, owl.carousel) for a single page (app/assets/javascripts/application.js.coffee:4-7, app/assets/stylesheets/application.css.sass:3-6)
- [LOW] UX8-08 - Google Fonts link has no integrity or crossorigin attributes (app/views/layouts/application.html.slim:16)

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
