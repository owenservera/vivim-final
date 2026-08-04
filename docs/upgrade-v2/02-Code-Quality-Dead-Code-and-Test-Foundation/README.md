# Code Quality: Dead Code, Broken Assets, Test Foundation

> Upgrade package for **vivim** v0.1.0
> Package: 2 of 9 (deep analysis)
> Generated: 2026-08-02T23:40:45.608Z

## What this package is

Four empty view files, a typo'd image filename with a space, mixed tab/space indentation in a whitespace-sensitive template engine, a copyright stuck on 2014, a 19-byte README, and 0% test coverage (the test/ tree is all .keep files). This package cleans the rot and lays a test foundation.

## Why this package

Every dead file and broken asset is a maintenance landmine. The mixed indentation in Slim is a latent parse failure. The complete absence of tests means every future change is unverified. Cleaning this up is cheap and pays for itself the moment the next feature lands.

## Findings (each grounded in a specific file:line citation)

- [MEDIUM] CQ-01 - Four view files exist but are completely empty (0 bytes) (app/views/index/about_us.html.slim:1, app/views/index/contact_us.html.slim:1, app/views/index/experts.html.slim:1, app/views/index/projects.html.slim:1)
- [MEDIUM] CQ-02 - Image filename contains a typo ('develpment') AND a space (app/views/index/index.html.slim:68, app/views/index/index.html.slim:70, public/images/iPhone-app- develpment-company-denver.png:n/a (binary file))
- [HIGH] CQ-03 - Mixed tab and space indentation in a Slim template (whitespace-sensitive) (app/views/layouts/application.html.slim:7-8, app/views/layouts/application.html.slim:4-6)
- [MEDIUM] CQ-04 - Copyright year is hardcoded to 2014 (app/views/layouts/application.html.slim:73)
- [LOW] CQ-05 - README.md is 19 bytes and contains only the project name (README.md:1-5, README.rdoc:1-30)
- [HIGH] CQ-06 - Zero tests; the test/ tree contains only .keep placeholder files (test/controllers/.keep:1, test/fixtures/.keep:1, test/helpers/.keep:1, test/integration/.keep:1, test/mailers/.keep:1, test/models/.keep:1, test/test_helper.rb:1-13, db/schema.rb:14)
- [LOW] CQ-07 - Helper module uses tabs for indentation (Ruby convention is 2 spaces) (app/helpers/application_helper.rb:2-12)
- [LOW] CQ-08 - Unicorn 4.8.3 is deprecated; Puma is the Rails-default server since Rails 5 (Gemfile.lock:155-158, Gemfile:25-27, config/unicorn/production.rb:1-52)

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
