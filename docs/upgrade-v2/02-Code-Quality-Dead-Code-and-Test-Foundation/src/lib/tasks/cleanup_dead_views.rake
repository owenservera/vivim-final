# Run via: bin/rails cleanup:dead_views
# Removes the four empty view files identified in CQ-01.
namespace :cleanup do
  desc 'Delete empty .slim view files (0 bytes)'
  task dead_views: :environment do
    dead = Dir.glob('app/views/**/*.slim').select do |f|
      File.size(f).zero?
    end
    if dead.empty?
      puts 'No dead views found.'
    else
      dead.each do |f|
        File.delete(f)
        puts "Deleted #{f}"
      end
    end
  end
end
