# Add to CI: bundle exec brakeman -z -q --no-progress --exit-on-warn
# This initializer documents the policy; the actual scan runs in GitHub Actions.
#
# .github/workflows/security.yml
# name: security
# on: [push, pull_request]
# jobs:
#   brakeman:
#     runs-on: ubuntu-latest
#     steps:
#       - uses: actions/checkout@v4
#       - uses: ruby/setup-ruby@v1
#         with:
#           ruby-version: '3.3.4'
#           bundler-cache: true
#       - run: bundle exec brakeman -z -q --no-progress --exit-on-warn
#   bundle-audit:
#     runs-on: ubuntu-latest
#     steps:
#       - uses: actions/checkout@v4
#       - uses: ruby/setup-ruby@v1
#         with:
#           ruby-version: '3.3.4'
#           bundler-cache: true
#       - run: bundle exec bundle-audit check --update
