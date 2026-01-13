# frozen_string_literal: true

class AnchorWebhookJob < ApplicationJob
  queue_as :default

  def perform(payload, raw_body = nil)
    AnchorWebhookProcessor.call(payload: payload, raw_body: raw_body)
  end
end
