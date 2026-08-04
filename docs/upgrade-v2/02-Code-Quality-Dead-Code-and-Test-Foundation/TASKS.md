# Task list

Tasks are ordered by dependency within the package. Effort estimates
use T-shirt sizes (S = half day, M = 1-3 days, L = 3+ days).

#### [CQ-T01] Delete the 4 empty view files  (_effort: S_)

- **Acceptance**: find app/views -name '*.slim' -empty returns 0 results.

#### [CQ-T02] Rename the typo'd image and update its 2 references  (_effort: S_)

- **Acceptance**: git grep 'develpment' returns 0; new file has no space in name.

#### [CQ-T03] Normalize Slim indentation to 2-space  (_effort: S_)

- **Acceptance**: grep -Pn '^\t' app/views/**/*.slim returns 0 matches; slim-lint clean.

#### [CQ-T04] Make copyright year dynamic  (_effort: S_)

- **Acceptance**: Footer shows current year; grep '2014' in app/views returns 0 (other than historical refs).

#### [CQ-T05] Replace README.md with real setup instructions; delete README.rdoc  (_effort: S_)

- **Acceptance**: README.md > 500 bytes; README.rdoc does not exist.

#### [CQ-T06] Adopt RSpec + SimpleCov with 80% gate  (_effort: L_)

- **Acceptance**: bundle exec rspec passes with >= 80% coverage on app/.

#### [CQ-T07] Switch from Unicorn to Puma  (_effort: M_)

- **Acceptance**: config/unicorn/ deleted; config/puma.rb present; puma boots the app.

#### [CQ-T08] Add RuboCop + slim-lint to CI  (_effort: S_)

- **Acceptance**: PR with a rubocop offense fails CI; PR with tab-indentation in .slim fails.

## Definition of done

A task is done when:

1. Its acceptance criterion is met on a clean checkout.
2. The matching spec's verification step passes.
3. The change is covered by a test (new or existing).
4. The CHANGELOG has an entry under `[Unreleased]`.
