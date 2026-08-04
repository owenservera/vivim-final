# UX: Mobile & Responsive Modernization

> Upgrade package for **vivim** v0.1.0
> Package: 6 of 9 (deep analysis)
> Generated: 2026-08-02T23:40:45.801Z

## What this package is

The site targets mobile users in its marketing copy ("150 times a day" phone-checks) but ships Bootstrap 3 navbar + img-responsive classes (BS3 was EOL July 2019), no srcset/sizes for the hero banner, no apple-touch-icon, no theme-color, no PWA manifest, and a carousel that ignores prefers-reduced-motion. On modern phones the site looks dated and cannot be installed as an app.

## Why this package

The hero image and the project carousel are the two largest visual surfaces on the site. Today both load full-resolution PNGs to every device, the carousel auto-plays on users who explicitly asked for reduced motion, and there is no app-icon when a user taps 'Add to Home Screen'. These are not nitpicks - they are the difference between a site that feels current and one that feels like 2014.

## Findings (each grounded in a specific file:line citation)

- [HIGH] UX6-01 - Bootstrap 3 navbar markup (navbar-toggle, icon-bar) - BS3 EOL July 2019 (app/views/layouts/application.html.slim:30-39)
- [HIGH] UX6-02 - Images use img-responsive (Bootstrap 3 class, removed in BS4/5) (app/views/index/index.html.slim:3, app/views/index/index.html.slim:13, app/views/layouts/application.html.slim:63)
- [HIGH] UX6-03 - Hero banner loads full-size PNG with no srcset/sizes (app/views/index/index.html.slim:2-4)
- [MEDIUM] UX6-04 - No apple-touch-icon, no theme-color, no PWA manifest (app/views/layouts/application.html.slim:5-15)
- [MEDIUM] UX6-05 - Carousel autoPlay:3000 ignores prefers-reduced-motion (app/assets/javascripts/application.js.coffee:11-13)
- [MEDIUM] UX6-06 - Colorbox lightbox has no touch/swipe support - mobile users cannot navigate (app/assets/javascripts/application.js.coffee:8-9, app/assets/stylesheets/colorbox.css:1-5)
- [LOW] UX6-07 - Copyright year hardcoded as '© 2014 - Vivim' - never updates (app/views/layouts/application.html.slim:84)
- [LOW] UX6-08 - viewport meta lacks viewport-fit=cover for notch/Dynamic Island (app/views/layouts/application.html.slim:6)

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
