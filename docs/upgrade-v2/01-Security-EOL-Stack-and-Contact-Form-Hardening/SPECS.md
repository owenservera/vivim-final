# Specifications

Every fix in this package has a testable spec. A spec is only satisfied
when its verification step passes on a clean checkout of main.

#### SEC-S1

- **Requirement**: Ruby version in .ruby-version MUST be 3.3.4 or newer.
- **Verification**: cat .ruby-version | awk '$1 > 3.3.3' exits 0.

#### SEC-S2

- **Requirement**: Rails version in Gemfile.lock MUST be >= 7.1.0.
- **Verification**: bundle exec rails version | awk '$1 >= 7.1.0' exits 0.

#### SEC-S3

- **Requirement**: Brakeman scan MUST report 0 warnings of confidence High or Medium.
- **Verification**: bundle exec brakeman -z --only-models,controllers exits 0.

#### SEC-S4

- **Requirement**: Contact form MUST reject emails without a valid RFC 5321 local@domain structure.
- **Verification**: POST /contact with email=invalid returns 422 with form error.

#### SEC-S5

- **Requirement**: Contact form MUST rate-limit to 3 submissions per IP per 5 minutes.
- **Verification**: 4th POST /contact within 5 min returns 429.

#### SEC-S6

- **Requirement**: Production MUST redirect HTTP to HTTPS with HSTS.
- **Verification**: curl -sI http://vivim.net/ | grep -E '301|Strict-Transport-Security' both present.

#### SEC-S7

- **Requirement**: No file in the repo MUST contain Kernel#open with a non-File receiver.
- **Verification**: grep -rnE '[^.]open\(' app/ config/ lib/ returns 0 matches.
