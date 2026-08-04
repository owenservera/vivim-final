# Task list

Tasks are ordered by dependency within the package. Effort estimates
use T-shirt sizes (S = half day, M = 1-3 days, L = 3+ days).

#### [SEC-T01] Upgrade Ruby 2.1.2 -> 3.3.4 and remove .ruby-gemset  (_effort: M_)

- **Acceptance**: .ruby-version reads 3.3.4; .ruby-gemset removed; bundle exec rails runner succeeds.

#### [SEC-T02] Upgrade Rails 4.1.1 -> 7.1.4 (multi-hop)  (_effort: L_)

- **Acceptance**: Gemfile.lock pins rails 7.1.4; rails app:update run cleanly; site boots and renders the homepage.

#### [SEC-T03] Replace Kernel#open with File.read in sitemap action  (_effort: S_)

- **Acceptance**: grep -rn 'open(' app/ config/ returns only File.open and IO.open; brakeman clean.

#### [SEC-T04] Add ContactForm validator + rack-attack rate limiting  (_effort: M_)

- **Acceptance**: Submitting 4 forms in 5 minutes from same IP returns 429; invalid email rejected with form error.

#### [SEC-T05] Strip committed secret_key_base values from secrets.yml.example  (_effort: S_)

- **Acceptance**: git grep -E '^[a-f0-9]{128}$' returns nothing; CI check added.

#### [SEC-T06] Move production deploy config to env vars  (_effort: M_)

- **Acceptance**: config/deploy/production.rb has no IP address or key filename; deploy still works via SSH config.

#### [SEC-T07] Enable config.force_ssl in production  (_effort: S_)

- **Acceptance**: curl -I http://vivim.net returns 301 to https; HSTS header present.

#### [SEC-T08] Wire Brakeman + bundle-audit to CI  (_effort: S_)

- **Acceptance**: GitHub Actions workflow runs brakeman --exit-on-warn on every PR.

## Definition of done

A task is done when:

1. Its acceptance criterion is met on a clean checkout.
2. The matching spec's verification step passes.
3. The change is covered by a test (new or existing).
4. The CHANGELOG has an entry under `[Unreleased]`.
