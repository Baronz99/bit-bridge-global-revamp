# frozen_string_literal: true

namespace :config do
  desc "Validate critical configuration for billing + background jobs"
  task sanity: :environment do
    # Recommended values:
    # - staging: BUYPOWER_BASE_URL=https://idev.buypower.ng/v2 + test token
    # - production: BUYPOWER_BASE_URL=https://api.buypower.ng/v2 + live token
    failures = []

    def present_env?(key)
      ENV[key].to_s.strip != ""
    end

    puts "BUYPOWER_TOKEN: #{present_env?("BUYPOWER_TOKEN") ? "present" : "missing"}"
    puts "BUYPOWER_BASE_URL: #{present_env?("BUYPOWER_BASE_URL") ? "present" : "missing"}"
    puts "BILLS_CONFIRMATION_MODE: #{ENV["BILLS_CONFIRMATION_MODE"].to_s.strip.presence || "(default)"}"

    begin
      Config::Bills.validate!
      puts "Config::Bills: OK (base_url=#{Config::Bills.base_url})"
    rescue StandardError => e
      failures << e.message
      puts "Config::Bills: FAIL - #{e.message}"
    end

    prembly_enabled = %w[true 1 yes].include?(ENV["ENABLE_PREMBLY"].to_s.downcase)
    if prembly_enabled
      api_key_present = present_env?("PREMBLY_API_KEY")
      app_id_present = present_env?("PREMBLY_APP_ID")
      puts "PREMBLY_API_KEY: #{api_key_present ? "present" : "missing"}"
      puts "PREMBLY_APP_ID: #{app_id_present ? "present" : "missing"}"

      unless api_key_present && app_id_present
        failures << "Missing Prembly env vars. Set PREMBLY_API_KEY and PREMBLY_APP_ID."
      end
    else
      puts "ENABLE_PREMBLY: disabled"
    end

    adapter = ActiveJob::Base.queue_adapter_name.to_s
    puts "ActiveJob adapter: #{adapter}"
    if Rails.env.production? && adapter == "async"
      failures << "ActiveJob adapter is async in production. Use a persistent adapter (e.g., sidekiq)."
    end

    redis_present = present_env?("REDIS_URL")
    puts "REDIS_URL: #{redis_present ? "present" : "missing"}"
    failures << "Missing REDIS_URL." unless redis_present

    if failures.any?
      puts "Config sanity check failed:"
      failures.each { |msg| puts "- #{msg}" }
      exit(1)
    end

    puts "Config sanity check passed."
  end
end
