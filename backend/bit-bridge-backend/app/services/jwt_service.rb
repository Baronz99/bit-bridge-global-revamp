# frozen_string_literal: true

require_relative './core/jwt_service'

JwtService = Core::JwtService unless defined?(JwtService)
