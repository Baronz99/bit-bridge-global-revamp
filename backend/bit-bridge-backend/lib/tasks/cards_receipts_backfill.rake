# frozen_string_literal: true

namespace :cards do
  desc 'Backfill card_debit_event receipt breakdown metadata using current pricing logic. DRY_RUN=1 LIMIT=1000 EMAIL=user@example.com FROM=2026-02-01 TO=2026-02-28'
  task backfill_debit_receipt_breakdown: :environment do
    dry_run = ENV.fetch('DRY_RUN', '1').to_s != '0'
    limit = ENV.fetch('LIMIT', '1000').to_i
    email = ENV['EMAIL'].to_s.strip
    from = ENV['FROM'].to_s.strip
    to = ENV['TO'].to_s.strip

    scope = CardEvent.where(event_name: 'card_debit_event').where.not(raw_payload: nil)
    if email.present?
      user = User.find_by(email: email)
      if user.blank?
        puts({ dry_run: dry_run, message: "user_not_found email=#{email}" }.inspect)
        next
      end
      scope = scope.where(user_id: user.id)
    end

    if from.present?
      from_time = Time.zone.parse(from) rescue nil
      scope = scope.where('created_at >= ?', from_time) if from_time
    end

    if to.present?
      to_time = Time.zone.parse(to) rescue nil
      scope = scope.where('created_at <= ?', to_time) if to_time
    end

    scope = scope.order(created_at: :asc)
    scope = scope.limit(limit) if limit.positive?

    stats = {
      dry_run: dry_run,
      scanned: 0,
      changed: 0,
      updated: 0,
      skipped_no_payload: 0,
      skipped_zero_principal: 0,
      errors: 0,
      samples: []
    }

    scope.find_each(batch_size: 200) do |event|
      stats[:scanned] += 1

      raw_payload = event.raw_payload.is_a?(Hash) ? event.raw_payload : {}
      pricing_payload = raw_payload['data'].is_a?(Hash) ? raw_payload['data'] : raw_payload
      unless pricing_payload.is_a?(Hash) && pricing_payload.present?
        stats[:skipped_no_payload] += 1
        next
      end

      quote = Pricing::CardPricing.quote(pricing_payload)
      principal = quote[:principal_usd].to_d
      if principal <= 0
        stats[:skipped_zero_principal] += 1
        next
      end

      metadata = event.metadata.is_a?(Hash) ? event.metadata.deep_dup : {}
      old_vals = {
        principal_usd: metadata['principal_usd'],
        provider_fee_usd: metadata['provider_fee_usd'],
        bitbridge_fee_usd: metadata['bitbridge_fee_usd'],
        fx_markup_usd: metadata['fx_markup_usd'],
        total_debit_usd: metadata['total_debit_usd']
      }

      new_vals = {
        'principal_usd' => quote[:principal_usd].to_f,
        'provider_fee_usd' => quote[:provider_fee_usd].to_f,
        'bitbridge_fee_usd' => quote[:bitbridge_fee_usd].to_f,
        'fx_markup_usd' => quote[:fx_markup_usd].to_f,
        'total_debit_usd' => quote[:total_debit_usd].to_f,
        'provider_fee_rule' => quote[:provider_fee_rule],
        'bitbridge_fee_rule' => quote[:bitbridge_fee_rule],
        'receipt_breakdown_backfilled_at' => Time.current.iso8601
      }

      changed = old_vals.any? do |key, old_value|
        old_dec = BigDecimal(old_value.to_s) rescue nil
        new_dec = BigDecimal(new_vals[key.to_s].to_s) rescue nil
        old_dec.nil? || new_dec.nil? || (old_dec - new_dec).abs > BigDecimal('0.0001')
      end
      next unless changed

      stats[:changed] += 1
      if stats[:samples].size < 10
        stats[:samples] << {
          id: event.id,
          user_id: event.user_id,
          card_id: event.card_id,
          status: event.status,
          old: old_vals,
          new: {
            principal_usd: new_vals['principal_usd'],
            provider_fee_usd: new_vals['provider_fee_usd'],
            bitbridge_fee_usd: new_vals['bitbridge_fee_usd'],
            fx_markup_usd: new_vals['fx_markup_usd'],
            total_debit_usd: new_vals['total_debit_usd']
          }
        }
      end

      next if dry_run

      metadata.merge!(new_vals)
      event.update!(metadata: metadata)
      stats[:updated] += 1
    rescue StandardError => e
      stats[:errors] += 1
      Rails.logger.warn("[cards:backfill_debit_receipt_breakdown] event_id=#{event&.id} #{e.class}: #{e.message}")
    end

    puts stats.inspect
  end

  desc 'Backfill card event transaction_at and enrichment metadata. DRY_RUN=1 LIMIT=1000 ENRICH_REMOTE=0 EMAIL=user@example.com FROM=2026-02-01 TO=2026-02-28'
  task backfill_event_enrichment: :environment do
    dry_run = ENV.fetch('DRY_RUN', '1').to_s != '0'
    limit = ENV.fetch('LIMIT', '1000').to_i
    email = ENV['EMAIL'].to_s.strip
    from = ENV['FROM'].to_s.strip
    to = ENV['TO'].to_s.strip
    enrich_remote = ENV.fetch('ENRICH_REMOTE', '0').to_s == '1'
    force_remote = ENV.fetch('FORCE_REMOTE', '0').to_s == '1'

    scope = CardEvent.where(event_name: %w[card_debit_event card_credit_event card_unload_event]).where.not(card_id: [nil, ''])
    if email.present?
      user = User.find_by(email: email)
      if user.blank?
        puts({ dry_run: dry_run, message: "user_not_found email=#{email}" }.inspect)
        next
      end
      scope = scope.where(user_id: user.id)
    end

    if from.present?
      from_time = Time.zone.parse(from) rescue nil
      scope = scope.where('created_at >= ?', from_time) if from_time
    end

    if to.present?
      to_time = Time.zone.parse(to) rescue nil
      scope = scope.where('created_at <= ?', to_time) if to_time
    end

    scope = scope.order(created_at: :asc)
    scope = scope.limit(limit) if limit.positive?

    stats = {
      dry_run: dry_run,
      enrich_remote: enrich_remote,
      force_remote: force_remote,
      scanned: 0,
      changed: 0,
      updated: 0,
      transaction_at_updated: 0,
      merchant_updated: 0,
      fx_updated: 0,
      remote_enriched: 0,
      skipped_no_payload: 0,
      skipped_no_card: 0,
      errors: 0,
      samples: []
    }

    scope.find_each(batch_size: 200) do |event|
      stats[:scanned] += 1
      attrs_to_update = {}
      metadata = event.metadata.is_a?(Hash) ? event.metadata.deep_dup : {}
      payload = candidate_payload_for_event(event)

      if payload.blank?
        stats[:skipped_no_payload] += 1
        next
      end

      parsed_tx_at = CardEvent.parse_transaction_time(payload)
      if parsed_tx_at.present?
        existing_tx_at = event.transaction_at
        tx_changed =
          existing_tx_at.nil? ||
          (existing_tx_at.to_i - parsed_tx_at.to_i).abs >= 1
        if tx_changed
          attrs_to_update[:transaction_at] = parsed_tx_at
          stats[:transaction_at_updated] += 1
        end
      end

      merged_merchant = extract_merchant_metadata(payload)
      if merged_merchant.present?
        existing_merchant = metadata['merchant'].is_a?(Hash) ? metadata['merchant'] : {}
        new_merchant = existing_merchant.merge(merged_merchant).compact
        if new_merchant != existing_merchant
          metadata['merchant'] = new_merchant
          stats[:merchant_updated] += 1
        end
      end

      fx_data = CardEvent.extract_fx_fields(
        payload,
        settled_currency: payload['currency'] || payload['transaction_currency'] || event.currency,
        settled_amount: payload['amount'] || event.amount
      )

      fx_attrs = {
        merchant_amount: fx_data[:merchant_amount],
        merchant_currency: fx_data[:merchant_currency],
        billing_amount: fx_data[:billing_amount],
        billing_currency: fx_data[:billing_currency],
        fx_implied_rate: fx_data[:fx_implied_rate],
        fx_reference_rate: fx_data[:fx_reference_rate],
        fx_margin_usd: fx_data[:fx_margin_usd],
        fx_markup_usd: fx_data[:fx_markup_usd]
      }.compact

      fx_changed = fx_attrs.any? do |key, value|
        current = event.public_send(key)
        current_dec = BigDecimal(current.to_s) rescue nil
        new_dec = BigDecimal(value.to_s) rescue nil
        if current_dec && new_dec
          (current_dec - new_dec).abs > BigDecimal('0.000001')
        else
          current.to_s != value.to_s
        end
      end
      if fx_changed
        attrs_to_update.merge!(fx_attrs)
        stats[:fx_updated] += 1
      end

      metadata['fx_discovery_present'] = fx_data[:fx_discovery_present] unless fx_data[:fx_discovery_present].nil?
      metadata['is_foreign'] = fx_data[:is_foreign] unless fx_data[:is_foreign].nil?
      metadata['enrichment_backfilled_at'] = Time.current.iso8601
      attrs_to_update[:metadata] = metadata if metadata != (event.metadata || {})

      if enrich_remote
        should_remote_enrich =
          force_remote ||
          metadata.dig('merchant', 'name').blank? ||
          event.merchant_currency.blank? ||
          event.billing_currency.blank?

        if should_remote_enrich
          card = Card.find_by(card_id: event.card_id)
          if card.blank?
            stats[:skipped_no_card] += 1
          elsif !dry_run
            result = Bridgecard::EnrichTransactionDetails.call(
              card: card,
              provider_transaction_reference: event.provider_transaction_reference,
              card_event: event,
              force: force_remote
            )
            stats[:remote_enriched] += 1 if result[:ok] && !result[:skipped]
          end
        end
      end

      next if attrs_to_update.empty?

      stats[:changed] += 1
      if stats[:samples].size < 10
        stats[:samples] << {
          id: event.id,
          event_name: event.event_name,
          card_id: event.card_id,
          transaction_at_before: event.transaction_at&.iso8601,
          transaction_at_after: attrs_to_update[:transaction_at]&.iso8601,
          merchant_name_after: attrs_to_update[:metadata]&.dig('merchant', 'name'),
          fx_after: {
            merchant_currency: attrs_to_update[:merchant_currency],
            billing_currency: attrs_to_update[:billing_currency]
          }.compact
        }.compact
      end

      next if dry_run

      event.update!(attrs_to_update)
      stats[:updated] += 1
    rescue StandardError => e
      stats[:errors] += 1
      Rails.logger.warn("[cards:backfill_event_enrichment] event_id=#{event&.id} #{e.class}: #{e.message}")
    end

    puts stats.inspect
  end

  def candidate_payload_for_event(event)
    metadata = event.metadata.is_a?(Hash) ? event.metadata : {}
    raw = event.raw_payload.is_a?(Hash) ? event.raw_payload : {}

    detail_payload = metadata['raw_payload_details']
    return detail_payload if detail_payload.is_a?(Hash) && detail_payload.present?

    data_payload = raw['data']
    return data_payload if data_payload.is_a?(Hash) && data_payload.present?

    return raw if raw.present?

    {}
  end

  def extract_merchant_metadata(payload)
    return {} unless payload.is_a?(Hash)

    enriched = payload['enriched_data'].is_a?(Hash) ? payload['enriched_data'] : {}
    merchant = enriched['merchant'].is_a?(Hash) ? enriched['merchant'] : {}

    {
      name: merchant['name'] || enriched['merchant_name'] || payload['merchant_name'],
      website: merchant['website'] || enriched['merchant_website'],
      code: merchant['code'] || enriched['merchant_code'],
      city: merchant['city'] || enriched['merchant_city'],
      country: merchant['country'] || payload['merchant_country'],
      logo: merchant['logo'] || enriched['merchant_logo'],
      group: merchant['group'] || enriched['transaction_group'],
      category: merchant['category'] || enriched['transaction_category'],
      recurring: enriched.key?('is_recurring') ? enriched['is_recurring'] : merchant['recurring']
    }.compact
  end
end
