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
      # Allow non-browser clients (no Origin header, e.g. curl, Postman)
      next true if origin.nil?

      # Allow if origin is one of:
      # - Netlify / other frontends from ENV
      # - Local dev hosts
      ALLOWED_ORIGINS.include?(origin) || DEV_ORIGINS.include?(origin)
    end

    resource "*",
             headers: :any,
             methods: %i[get post put patch delete options head],
             credentials: true
  end
end
