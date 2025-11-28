# lib/tasks/assets.rake

namespace :assets do
  desc "No-op assets:precompile task for environments without Sprockets"
  task :precompile do
    puts "Skipping assets:precompile (no Sprockets / asset pipeline configured)"
  end
end
