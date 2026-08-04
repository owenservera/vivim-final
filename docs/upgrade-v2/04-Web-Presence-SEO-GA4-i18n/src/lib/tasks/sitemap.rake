namespace :sitemap do
  desc 'Refresh the sitemap (run on deploy)'
  task refresh: :environment do
    DynamicSitemaps.refresh_sitemap
    puts "Sitemap refreshed for host: #{ENV.fetch('SITE_HOST', 'www.vivim.net')}"
  end
end
