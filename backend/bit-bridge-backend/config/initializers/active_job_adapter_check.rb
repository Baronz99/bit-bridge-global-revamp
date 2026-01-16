# frozen_string_literal: true

if Rails.env.production?
  # BVN retry requires a persistent ActiveJob adapter (e.g., Sidekiq) and running workers.
  adapter = ActiveJob::Base.queue_adapter_name
  if adapter.to_s == "async"
    Rails.logger.warn("[BVN] ActiveJob adapter is async in production; BVN retries require a persistent queue + workers.")
  end
end
