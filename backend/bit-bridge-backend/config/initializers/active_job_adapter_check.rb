# frozen_string_literal: true

if Rails.env.production?
  adapter = ActiveJob::Base.queue_adapter_name
  if adapter.to_s == "async"
    Rails.logger.warn("[BVN] ActiveJob adapter is async in production; BVN retry jobs will not run reliably.")
  end
end
