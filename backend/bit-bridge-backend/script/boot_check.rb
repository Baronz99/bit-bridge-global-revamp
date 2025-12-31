# frozen_string_literal: true

ENV["RAILS_ENV"] ||= "production"
ENV["BOOT_CHECK"] = "1"
ENV["BOOT_HTTP_GUARD"] = "1"

require_relative "../config/environment"

raise "BootSafety guard still enabled after initialize" if defined?(BootSafety) && BootSafety.http_guard_enabled

puts "boot ok"

ActiveRecord::Base.connection.execute("SELECT 1")
puts "db ok"
