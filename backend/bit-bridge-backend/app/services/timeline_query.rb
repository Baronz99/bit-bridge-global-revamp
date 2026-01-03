# frozen_string_literal: true

class TimelineQuery
  DEFAULT_LIMIT = 30
  MAX_LIMIT = 100

  def initialize(user:, limit: nil, cursor: nil, circle_id: nil, default_limit: DEFAULT_LIMIT, max_limit: MAX_LIMIT, include_card_events: nil)
    @user = user
    @circle_id = circle_id
    @default_limit = normalize_limit_value(default_limit, DEFAULT_LIMIT)
    @max_limit = normalize_limit_value(max_limit, MAX_LIMIT)
    @include_card_events = include_card_events
    @limit = normalize_limit(limit)
    @cursor = parse_cursor(cursor)
  end

  def call
    merged = circle_items
    merged += card_items if include_card_events?

    sorted =
      merged
      .sort_by { |entry| entry[:occurred_at] || Time.at(0) }
      .reverse

    limited = sorted.first(@limit)

    {
      items: limited,
      next_cursor: limited.last ? limited.last[:occurred_at]&.iso8601 : nil
    }
  end

  private

  def circle_items
    circle_transactions.map do |tx|
      {
        id: "circle-tx-#{tx.id}",
        kind: 'circle_transaction',
        label: timeline_label(tx.description, tx.kind),
        amount_cents: tx.amount_cents,
        status: nil,
        occurred_at: tx.occurred_at,
        actor: actor_json(tx.user),
        meta: {
          circle_id: tx.circle_id,
          circle_name: tx.circle&.name,
          activity_id: tx.circle_activity_id,
          activity_name: tx.circle_activity&.name,
          reference: tx.reference
        }
      }
    end
  end

  def card_items
    card_events.map do |event|
      occurred_at = event.transaction_at || event.created_at

      {
        id: "card-evt-#{event.id}",
        kind: 'card_event',
        label: timeline_label(event.description, event.event),
        amount_cents: amount_to_cents(event.amount),
        status: event.status,
        occurred_at: occurred_at,
        actor: actor_json(event.user),
        meta: {
          circle_id: nil,
          circle_name: nil,
          activity_id: nil,
          activity_name: nil,
          reference: event.transaction_reference
        }
      }
    end
  end

  def circle_transactions
    scope =
      CircleTransaction
      .includes(:circle, :user, :reactions, :circle_activity, dispute: :raised_by)

    if @circle_id
      scope = scope.where(circle_id: @circle_id)
    else
      scope = scope.where(circle_id: @user.circles.select(:id))
    end

    scope = scope.where('occurred_at < ?', @cursor) if @cursor

    scope.order(occurred_at: :desc).limit(@limit)
  end

  def card_events
    scope = CardEvent.includes(:user).where(user_id: @user.id)

    if @cursor
      scope = scope.where('COALESCE(transaction_at, created_at) < ?', @cursor)
    end

    scope.order(Arel.sql('COALESCE(transaction_at, created_at) DESC')).limit(@limit)
  end

  def actor_json(user)
    return nil unless user

    profile = user.user_profile
    name = [profile&.first_name, profile&.last_name].compact.join(' ').strip
    name = user.email if name.blank?

    {
      id: user.id,
      name: name,
      email: user.email
    }
  end

  def timeline_label(description, fallback)
    description.presence || fallback.to_s.tr('._', ' ').strip.presence || 'activity'
  end

  def amount_to_cents(amount)
    return nil if amount.nil?

    (amount.to_d * 100).to_i
  end

  def normalize_limit(raw)
    value = raw.to_i
    value = @default_limit if value <= 0
    [value, @max_limit].min
  end

  def normalize_limit_value(raw, fallback)
    value = raw.to_i
    value = fallback if value <= 0
    value
  end

  def parse_cursor(raw)
    return nil if raw.blank?

    Time.iso8601(raw.to_s)
  rescue ArgumentError
    nil
  end

  def include_card_events?
    return @include_card_events unless @include_card_events.nil?

    @circle_id.nil?
  end
end
