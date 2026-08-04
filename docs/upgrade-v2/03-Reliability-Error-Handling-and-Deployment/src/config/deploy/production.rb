# Production stage - all values from CI environment.
set :stage, :production
set :rails_env, :production

server ENV.fetch('VIVIM_PRODUCTION_HOST'),
       user: ENV.fetch('VIVIM_DEPLOY_USER'),
       roles: %i[app web db],
       ssh_options: {
         port: ENV.fetch('VIVIM_SSH_PORT', 22).to_i,
         keys: [ENV.fetch('VIVIM_SSH_KEY_PATH')],
       }

set :deploy_to, ENV.fetch('VIVIM_DEPLOY_PATH', '/home/deployer/vivim')
