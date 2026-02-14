# frozen_string_literal: true

class TimelineQuery
  DEFAULT_LIMIT = 30
  MAX_LIMIT = 100

  def initialize(
    user:,
    limit: nil,
    cursor: nil,
    circle_id: nil,
    default_limit: DEFAULT_LIMIT,
    max_limit: MAX_LIMIT,
    include_card_events: nil
  )
    @user = user
    @circle_id = circle_id
    @default_limit = normalize_limit_value(default_limit, DEFAULT_LIMIT)
    @max_limit = normalize_limit_value(max_limit, MAX_LIMIT)
    @include_card_events = include_card_events
    @limit = normalize_limit(limit)
    @cursor = parse_cursor(cursor)
  end

  # GET /api/v1/timeline
  def call
    merged = circle_items
    merged += wallet_items if include_global_items?
    merged += bill_items if include_global_items?
    merged += card_items if include_card_events?

    merged = collapse_circle_fund_groups(merged)

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

  # GET /api/v1/timeline/:id
  # Returns a single timeline item in the same shape as index items.
  def find_item(id)
    key = id.to_s.strip
    return nil if key.blank?

    prefix, raw_id = key.split('-', 3).values_at(0, 2) # e.g. "wallet", "tx", "UUID"
    # handle ids like "wallet-tx-<uuid>" / "circle-tx-<uuid>" / "bill-<uuid>" / "card-evt-<uuid>"
    if key.start_with?('wallet-tx-')
      tx_id = key.sub('wallet-tx-', '')
      tx = wallet_transactions_unscoped.find_by(id: tx_id)
      return nil unless tx
      return wallet_item(tx)
    end

    if key.start_with?('circle-tx-')
      tx_id = key.sub('circle-tx-', '')
      tx = circle_transactions_unscoped.find_by(id: tx_id)
      return nil unless tx
      return circle_item(tx)
    end

    if key.start_with?('bill-')
      order_id = key.sub('bill-', '')
      order = bill_orders_unscoped.find_by(id: order_id)
      return nil unless order
      return bill_item(order)
    end

    if key.start_with?('card-evt-')
      event_id = key.sub('card-evt-', '')
      event = card_events_unscoped.find_by(id: event_id)
      return nil unless event
      return card_item(event)
    end

    nil
  end

  private

  # -------------------------
  # Item builders
  # -------------------------

  def circle_items
    circle_transactions.map { |tx| circle_item(tx) }
  end

  def circle_item(tx)
    metadata = tx.metadata.is_a?(Hash) ? tx.metadata.symbolize_keys : {}
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

        # circle tx reference (not always a canonical receipt ref, but keep it)
        reference: tx.reference,
        group_reference: metadata[:group_reference],

        # if circle tx is linked to a transaction_record, expose it (optional)
        transaction_record_reference: nil
      }.compact
    }
  end

  def wallet_items
    wallet_transactions.map { |tx| wallet_item(tx) }
  end

  def wallet_item(tx)
    record = tx.transaction_record
    safe_description = record&.description.presence || tx.address
    metadata = tx.metadata.is_a?(Hash) ? tx.metadata.symbolize_keys : {}

    amount_cents = amount_to_cents(tx.amount)
    if anchor_transfer_component?(metadata) && metadata[:subtype].to_s == 'principal'
      amount_cents = amount_to_cents(tx.amount.to_d + sibling_fee_amount(tx, metadata).to_d)
    end

    {
      id: "wallet-tx-#{tx.id}",
      kind: 'wallet_transaction',
      label: wallet_label(tx, record),
      amount_cents: amount_cents,
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
        group_reference: metadata[:group_reference],

        # canonical receipt reference (preferred)
        reference: record&.reference,
        transaction_record_reference: record&.reference,
        transaction_record_id: record&.id,

        description: safe_description,
        account_name: record&.customer_name,
        account_number: record&.account_number,

        unique_transaction_id: tx.unique_transaction_id,
        transfer_reference: metadata[:transfer_reference],
        transfer_component: metadata[:subtype],
        show_in_primary_feed: !(anchor_transfer_component?(metadata) && metadata[:subtype].to_s == 'fee'),

        # used for card receipt / card history correlation (provider-side)
        bridge_card_id: tx.bridge_card_id
      }.compact
    }
  end

  def bill_items
    bill_orders.map { |order| bill_item(order) }
  end

  def bill_item(order)
    record = order.transaction_record

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

        # provider id / transaction_id isn't always the canonical receipt reference
        reference: record&.reference.presence || order.transaction_id,

        # canonical receipt reference (preferred)
        transaction_record_reference: record&.reference,

        token: order.token,
        meter_number: order.meter_number,
        phone: (order.respond_to?(:phone_number) ? order.phone_number : order.phone),
        usd_amount: order.usd_amount,
        currency: (order.respond_to?(:currency) ? order.currency : nil) || 'NGN'
      }.compact
    }
  end

  def card_items
    card_events.map { |event| card_item(event) }
  end

  def card_item(event)
    occurred_at = event.transaction_at || event.created_at

    # Map provider card_id -> local Card.id when possible
    local_card = begin
      Card.find_by(user_id: @user.id, card_id: event.card_id)
    rescue StandardError
      nil
    end

    {
      id: "card-evt-#{event.id}",
      kind: 'card_event',
      label: timeline_label(event.description, event.event),
      amount_cents: amount_to_cents(event.amount),
      status: event.status,
      occurred_at: occurred_at,
      actor: actor_json(event.user),
      meta: {
        currency: (event.respond_to?(:currency) ? event.currency : nil) || 'USD',

        # card mapping for mobile: local Card.id used for /cards/:id/details and /cards/:id/history
        card_id: local_card&.id,

        # provider transaction reference (not always receipt ref, but used for receipts)
        reference: event.transaction_reference || event.provider_transaction_reference || event.id
      }.compact
    }
  end

  # -------------------------
  # Scopes
  # -------------------------

  def circle_transactions
    scope = circle_transactions_unscoped
    scope = scope.where('occurred_at < ?', @cursor) if @cursor
    scope.order(occurred_at: :desc).limit(@limit)
  end

  def circle_transactions_unscoped
    scope =
      CircleTransaction
        .includes(:circle, :user, :reactions, :circle_activity, dispute: :raised_by)

    if @circle_id
      scope.where(circle_id: @circle_id)
    else
      scope.where(circle_id: @user.circles.select(:id))
    end
  end

  def card_events
    scope = card_events_unscoped
    scope = scope.where('COALESCE(transaction_at, created_at) < ?', @cursor) if @cursor
    scope.order(Arel.sql('COALESCE(transaction_at, created_at) DESC')).limit(@limit)
  end

  def card_events_unscoped
    CardEvent.includes(:user).where(user_id: @user.id)
  end

  def wallet_transactions
    scope = wallet_transactions_unscoped
    scope = scope.where('transactions.created_at < ?', @cursor) if @cursor
    scope.order(created_at: :desc).limit(@limit)
  end

  def wallet_transactions_unscoped
    Transaction
      .joins(:wallet)
      .includes(:wallet, :transaction_record, :user)
      .where(wallets: { user_id: @user.id })
      .where("COALESCE(metadata ->> 'subtype', '') <> ?", 'fee')
      .where.not(<<~SQL.squish)
        transactions.status = #{Transaction.statuses[:initialized]}
        AND COALESCE(transactions.metadata ->> 'provider', '') = 'anchor'
        AND COALESCE(transactions.metadata ->> 'purpose', '') = 'wallet_fund'
        AND COALESCE(transactions.metadata ->> 'checkout_state', '') = 'settled'
      SQL
  end

  def bill_orders
    scope = bill_orders_unscoped
    scope = scope.where('updated_at < ?', @cursor) if @cursor
    scope.order(updated_at: :desc).limit(@limit)
  end

  def bill_orders_unscoped
    scope =
      BillOrder
      .includes(:user, :transaction_record)
      .where(user_id: @user.id)

    if bill_order_metadata_column?
      scope.where.not(
        "(COALESCE(metadata ->> 'source', '') = :source) OR (LOWER(COALESCE(description, '')) LIKE :hold_label)",
        source: 'anchor_transfer',
        hold_label: 'anchor ngn transfer hold%'
      )
    else
      scope.where.not("LOWER(COALESCE(description, '')) LIKE ?", 'anchor ngn transfer hold%')
    end
  end

  def bill_order_metadata_column?
    BillOrder.column_names.include?('metadata')
  end

  # -------------------------
  # Helpers
  # -------------------------

  def actor_json(user)
    return nil unless user

    profile = user.user_profile
    name = [profile&.first_name, profile&.last_name].compact.join(' ').strip
    name = user.email if name.blank?

    { id: user.id, name: name, email: user.email }
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

  def anchor_transfer_component?(metadata)
    metadata[:provider].to_s == 'anchor' && metadata[:transfer_reference].present?
  end

  def sibling_fee_amount(tx, metadata)
    return 0.to_d unless metadata[:transfer_reference].present?

    Transaction
      .where(wallet_id: tx.wallet_id)
      .where("metadata ->> 'transfer_reference' = ?", metadata[:transfer_reference])
      .where("metadata ->> 'subtype' = ?", 'fee')
      .order(created_at: :desc)
      .limit(1)
      .pick(:amount).to_d
  end

  # Collapse wallet + circle legs that belong to the same group_reference (circle funding)
  def collapse_circle_fund_groups(items)
    grouped = items.group_by { |item| item.dig(:meta, :group_reference) }

    grouped.flat_map do |group_ref, group_items|
      if group_ref.present?
        wallet_leg = group_items.find { |i| i[:kind] == 'wallet_transaction' }
        circle_leg = group_items.find { |i| i[:kind] == 'circle_transaction' }

        if wallet_leg && circle_leg
          build_circle_fund_group_item(group_ref, wallet_leg, circle_leg)
        else
          group_items
        end
      else
        group_items
      end
    end
  end

  def build_circle_fund_group_item(group_ref, wallet_leg, circle_leg)
    amount_cents = wallet_leg[:amount_cents].to_i * -1
    occurred_at = [wallet_leg[:occurred_at], circle_leg[:occurred_at]].compact.max
    status = derive_group_status([wallet_leg, circle_leg])
    circle_name = circle_leg.dig(:meta, :circle_name)

    merged_meta =
      (wallet_leg[:meta] || {})
      .merge(circle_leg[:meta] || {})
      .merge(
        group_reference: group_ref,
        wallet_timeline_id: wallet_leg[:id],
        circle_timeline_id: circle_leg[:id]
      )
    merged_meta[:reference] ||= wallet_leg[:id]

    [{
      id: "circle-fund-#{group_ref}",
      kind: 'circle_fund_group',
      label: circle_name.present? ? "Funded #{circle_name}" : wallet_leg[:label],
      amount_cents: amount_cents,
      status: status,
      occurred_at: occurred_at,
      actor: wallet_leg[:actor] || circle_leg[:actor],
      meta: merged_meta.compact
    }]
  end

  def derive_group_status(items)
    statuses = items.map { |i| i[:status].to_s }.compact
    return 'pending' if statuses.empty?

    return 'failed' if statuses.any? { |s| %w[failed declined].include?(s) }
    return 'pending' if statuses.any? { |s| %w[pending initialized].include?(s) }

    'approved'
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
