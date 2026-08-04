# vivim

Marketing website for Vivim, a Denver-based mobile and web development
studio. Built with Ruby on Rails.

## Prerequisites

- Ruby 3.3.4 (check .ruby-version)
- PostgreSQL 14+
- Node.js 20+ (for asset compilation)
- Bun (for JS bundling)

## Setup

\`\`\`bash
git clone https://github.com/vivim/vivim.git
cd vivim
bundle install
cp config/database.yml.example config/database.yml
cp config/secrets.yml.example config/secrets.yml
# Edit database.yml and secrets.yml with your local values
bin/rails db:setup
bin/rails server
\`\`\`

Visit http://localhost:3000.

## Tests

\`\`\`bash
bundle exec rspec
bundle exec brakeman
\`\`\`

## Deploy

Production deploys run via GitHub Actions on push to main. The workflow
runs tests, brakeman, and bundle-audit, then deploys via SSH to the
production host.

## License

MIT.
