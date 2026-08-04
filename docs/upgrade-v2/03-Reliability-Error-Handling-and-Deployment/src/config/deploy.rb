# Modern Capistrano 3.18 config - addresses REL-03.
# All sensitive values come from environment variables set in CI;
# nothing in this file is secret.
lock '~> 3.18.0'

set :application, 'vivim'
set :repo_url, ENV.fetch('VIVIM_REPO_URL', 'git@github.com:vivim/vivim.git')
set :branch, ENV.fetch('VIVIM_DEPLOY_BRANCH', 'main')

set :linked_dirs, fetch(:linked_dirs, []) + %w[log tmp/pids tmp/cache tmp/sockets public/system public/sitemaps]
set :linked_files, %w[config/database.yml config/secrets.yml config/master.key]

set :keep_releases, 5
set :ssh_options, { forward_agent: true }
