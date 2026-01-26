# config/initializers/cors.rb

# Production frontends only
ALLOWED_ORIGINS = [
  "https://bitbridgeglobal.com",
  "https://www.bitbridgeglobal.com",
  "https://bitbridge-staging.netlify.app"
].freeze

# Local development frontends
DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173"
].freeze

DEV_ORIGINS_ENABLED = ActiveModel::Type::Boolean.new.cast(ENV['ALLOW_DEV_ORIGINS'])

ORIGINS =
  if Rails.env.production?
    (ALLOWED_ORIGINS + (DEV_ORIGINS_ENABLED ? DEV_ORIGINS : [])).freeze
  else
    (ALLOWED_ORIGINS + DEV_ORIGINS).freeze
  end

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(*ORIGINS)


    resource "/api/*",
             headers: :any,
             methods: %i[get post put patch delete options head],
             credentials: false
  end
end
