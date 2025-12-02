# backend/bit-bridge-backend/config/initializers/cors.rb

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins 'http://localhost:3000',
        'http://localhost:5173',
        'https://keen-gelato-4f27c8.netlify.app',
        'https://poetic-figolla-35655e.netlify.app'


    resource '*',
             headers: :any,
             methods: %i[get post put patch delete options head],
             expose: ['Authorization'],
             credentials: true
  end
end
