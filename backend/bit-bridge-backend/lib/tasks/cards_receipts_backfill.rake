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
end
