# Puma config - replaces config/unicorn/production.rb (CQ-08)
max_threads_count = ENV.fetch('RAILS_MAX_THREADS', 5)
min_threads_count = ENV.fetch('RAILS_MIN_THREADS') { max_threads_count }
threads min_threads_count, max_threads_count

worker_timeout = ENV.fetch('RAILS_WORKER_TIMEOUT', 30).to_i
if ENV.fetch('RAILS_ENV', 'development') == 'development'
  worker_timeout = 3600
end

port ENV.fetch('PORT', 3000)
environment ENV.fetch('RAILS_ENV', 'development')
pidfile ENV.fetch('PIDFILE', 'tmp/pids/server.pid')
workers ENV.fetch('WEB_CONCURRENCY', 2).to_i
preload_app!

plugin :tmp_restart
