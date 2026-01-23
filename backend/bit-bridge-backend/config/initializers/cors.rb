# config/initializers/cors.rb

# Production frontends only
ALLOWED_ORIGINS = [
  "https://bitbridgeglobal.com",
  "https://www.bitbridgeglobal.com"
].freeze

# Local development frontends
DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173"
].freeze

ORIGINS = (Rails.env.production? ? ALLOWED_ORIGINS : (ALLOWED_ORIGINS + DEV_ORIGINS)).freeze

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(*ORIGINS)


    resource "/api/*",
             headers: :any,
             methods: %i[get post put patch delete options head],
             credentials: false
  end
end
