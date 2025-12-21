# config/initializers/cors.rb

# Frontends in production / staging, from ENV (comma-separated)
ALLOWED_ORIGINS = ENV.fetch("FRONTEND_URL", "")
                     .split(",")
                     .map(&:strip)
                     .reject(&:empty?)
                     .freeze

# Local development frontends
DEV_ORIGINS = [
  "http://localhost:3000", # Rails / React dev
  "http://localhost:5173"  # Vite dev
].freeze

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins do |origin, _env|
  next true if origin.nil?

  allowed = (ALLOWED_ORIGINS + DEV_ORIGINS)
  allowed.any? { |o| origin.start_with?(o) }
end


    resource "*",
             headers: :any,
             methods: %i[get post put patch delete options head],
             credentials: true
  end
end
