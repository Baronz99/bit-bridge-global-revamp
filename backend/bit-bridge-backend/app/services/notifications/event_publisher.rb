# frozen_string_literal: true

module Notifications
  class EventPublisher
    def self.call(**kwargs)
      new(**kwargs).call
    end

    def initialize(user:, event_type:, resource_type:, resource_id:, state:, title:, body:, idempotency_key:, occurred_at: Time.current, priority: 'normal', reference: nil, deeplink: nil, metadata: {})
      @user = user
      @event_type = event_type
      @resource_type = resource_type
      @resource_id = resource_id
      @reference = reference
      @state = state
      @title = title
      @body = body
      @deeplink = deeplink
      @priority = priority
      @idempotency_key = idempotency_key
      @occurred_at = occurred_at
      @metadata = metadata || {}
    end

    def call
      return if @user.blank?

      event = create_or_find_event
      return if event.blank?
      return event unless event.queued?

      Notifications::DispatchJob.perform_later(event.id)
    rescue StandardError => e
      Rails.logger.warn("[Notifications::EventPublisher] dispatch enqueue failed event_id=#{event&.id} error=#{e.class}: #{e.message}")
    ensure
      event
    end

    private

    def create_or_find_event
      NotificationEvent.create!(
        user: @user,
        event_type: @event_type,
        resource_type: @resource_type,
        resource_id: @resource_id.to_s,
        reference: @reference,
        state: @state,
        title: @title,
        body: @body,
        deeplink: @deeplink,
        priority: @priority,
        idempotency_key: @idempotency_key,
        occurred_at: @occurred_at,
        metadata: @metadata
      )
    rescue ActiveRecord::RecordNotUnique
      NotificationEvent.find_by(idempotency_key: @idempotency_key)
    rescue ActiveRecord::RecordInvalid => e
      existing = NotificationEvent.find_by(idempotency_key: @idempotency_key)
      return existing if existing.present?

      Rails.logger.warn("[Notifications::EventPublisher] skipped error=#{e.class} message=#{e.message}")
      nil
    end
  end
end
