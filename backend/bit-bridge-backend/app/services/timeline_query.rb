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
    merged += wallet_items if include_global_items?
    merged += bill_items if include_global_items?
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

  def wallet_items
    wallet_transactions.map do |tx|
      record = tx.transaction_record

      {
        id: "wallet-tx-#{tx.id}",
        kind: 'wallet_transaction',
        label: wallet_label(tx, record),
        amount_cents: amount_to_cents(tx.amount),
        status: tx.status,
        occurred_at: tx.created_at,
        actor: actor_json(tx.user),
        meta: {
          wallet_type: tx.wallet&.wallet_type,
          currency: tx.wallet&.currency,
          transaction_type: tx.transaction_type,
          coin_type: tx.coin_type,
          address: tx.address,
          bank: tx.bank,

          # ✅ IMPORTANT: Transaction model does NOT have `reference`.
          # Only use TransactionRecord.reference as the bank-grade receipt reference.
          reference: record&.reference,

          # ✅ helpful fallbacks for UI
          description: (record&.description.presence || tx.description),
          account_name: record&.customer_name,
          account_number: record&.account_number,

          # ✅ safe correlation fields (helps debug card funding etc.)
          transaction_record_reference: record&.reference,
          transaction_record_id: record&.id,
          unique_transaction_id: tx.unique_transaction_id,
          bridge_card_id: tx.bridge_card_id
        }
      }
    end
  end

  def bill_items
    bill_orders.map do |order|
      {
        id: "bill-#{order.id}",
        kind: 'bill_order',
        label: timeline_label(order.description, order.service_type),
        amount_cents: amount_to_cents(order.total_amount || order.amount),
        status: order.status,
        occurred_at: order.updated_at,
        actor: actor_json(order.user),
        meta: {
          service_type: order.service_type,
          biller: order.biller,
          payment_method: order.payment_method,
          reference: order.transaction_id,
          token: order.token,
          meter_number: order.meter_number,
          phone: order.phone,
          usd_amount: order.usd_amount,
          currency: 'NGN'
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
          reference: event.transaction_reference,
          currency: 'USD'
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

  def wallet_transactions
    scope =
      Transaction
      .joins(:wallet)
      .includes(:wallet, :transaction_record, :user)
      .where(wallets: { user_id: @user.id })

    scope = scope.where('transactions.created_at < ?', @cursor) if @cursor

    scope.order(created_at: :desc).limit(@limit)
  end

  def bill_orders
    scope = BillOrder.includes(:user).where(user_id: @user.id)

    scope = scope.where('updated_at < ?', @cursor) if @cursor

    scope.order(updated_at: :desc).limit(@limit)
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

  def wallet_label(tx, record)
    return record.description if record&.description.present?

    base = tx.transaction_type == 'deposit' ? 'Wallet deposit' : 'Wallet withdrawal'
    return base if tx.address.blank?

    suffix = tx.transaction_type == 'deposit' ? "from #{tx.address}" : "to #{tx.address}"
    "#{base} #{suffix}"
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

  def include_global_items?
    @circle_id.nil?
  end
end
