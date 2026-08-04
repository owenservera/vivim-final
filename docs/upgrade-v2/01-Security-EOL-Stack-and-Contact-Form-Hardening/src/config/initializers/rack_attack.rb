# Rate limiting for the contact form to prevent the open-spam-relay
# pattern flagged in SEC-04.
class Rack::Attack
  # Allow 3 contact form submissions per IP per 5 minutes.
  throttle('contacts/ip', limit: 3, period: 300.seconds) do |req|
    req.ip if req.path == '/contact' && req.post?
  end

  # Allow 60 requests per IP per minute for everything else.
  throttle('req/ip', limit: 60, period: 60.seconds) do |req|
    req.ip
  end

  # Block obviously bad user agents.
  blocklist('block bad user agents') do |req|
    req.user_agent =~ /curl|wget|python-requests|nikto|nmap/i
  end
end

# Log throttled requests so we can see attack patterns.
ActiveSupport::Notifications.subscribe('throttle.rack_attack') do |_, _, _, _, payload|
  Rails.logger.warn("rack-attack throttle: #{payload[:request].ip} -> #{payload[:request].path}")
end
