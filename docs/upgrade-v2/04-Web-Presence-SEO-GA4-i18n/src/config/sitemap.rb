# WEB-03 fix: host from env, regenerated on every deploy.
host ENV.fetch('SITE_HOST', 'www.vivim.net')

sitemap :site do
  url root_url, last_mod: Time.now, change_freq: 'daily', priority: 1.0
  url mobile_url, last_mod: Time.now, change_freq: 'weekly', priority: 0.7
  url why_ror_url, last_mod: Time.now, change_freq: 'weekly', priority: 0.7
end

ping_with "https://#{host}/sitemap.xml" if Rails.env.production?
