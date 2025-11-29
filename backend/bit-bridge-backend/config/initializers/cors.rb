# backend/bit-bridge-backend/config/initializers/cors.rb

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins 'http://localhost:3000',
            'http://localhost:5173',
            'https://startling-quokka-158897.netlify.app'

    resource '*',
             headers: :any,
             expose: ['Authorization'],
             methods: %i[get post put patch delete options head]
  end
end
