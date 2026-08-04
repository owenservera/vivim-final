# Error tracking - addresses REL-02.
Sentry.init do |config|
  config.dsn = ENV.fetch('SENTRY_DSN', nil)
  config.breadcrumbs_logger = [:active_support_logger, :http_logger]
  config.traces_sample_rate = 0.1
  config.release = ENV.fetch('GIT_SHA', 'unknown')
  config.environment = Rails.env

  # Scrub PII before sending.
  config.before_send = lambda do |event, _hint|
    # Remove request body parameters that may contain user contact info.
    if event.request && event.request[:data]
      scrubbed = event.request[:data].to_s
        .gsub(/"email"\s*=>\s*"[^"]+"/, '"email"=>"[REDACTED]"')
        .gsub(/"phone"\s*=>\s*"[^"]+"/, '"phone"=>"[REDACTED]"')
      event.request[:data] = scrubbed
    end
    event
  end
end if Rails.env.production? && ENV['SENTRY_DSN']
