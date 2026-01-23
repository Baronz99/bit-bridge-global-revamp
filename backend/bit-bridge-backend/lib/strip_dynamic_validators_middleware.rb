# frozen_string_literal: true

class StripDynamicValidatorsMiddleware
  def initialize(app)
    @app = app
  end

  def call(env)
    status, headers, body = @app.call(env)

    if strip_for_path?(env['PATH_INFO'])
      headers.delete('ETag')
      headers.delete('Last-Modified')
    end

    [status, headers, body]
  end

  private

  def strip_for_path?(path)
    return false if path.blank?

    return true if path == '/api/v1/wallets/user'

    path.match?(%r{\A/api/v1/bill_orders/[^/]+/initialize_confirm_payment\z})
  end
end
