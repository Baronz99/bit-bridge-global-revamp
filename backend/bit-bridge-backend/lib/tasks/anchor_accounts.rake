# frozen_string_literal: true

namespace :anchor do
  def canonical_anchor_account(scope)
    scope.order(
      Arel.sql("CASE WHEN active = TRUE THEN 0 ELSE 1 END ASC"),
      Arel.sql("CASE WHEN account_number IS NOT NULL AND account_number <> '' THEN 0 WHEN useable_id IS NOT NULL AND useable_id <> '' THEN 1 ELSE 2 END ASC"),
      status: :desc,
      updated_at: :desc,
      created_at: :desc
    ).first
  end

  def extract_deposit_account_ids_from_events(account)
    return [] if account.blank?

    events = AnchorWebhookEvent.where(
      event_type: %w[accountNumber.created virtualNuban.opened account.opened account.initiated],
      reference: account.account_id
    ).order(updated_at: :desc)

    ids = []
    events.each do |event|
      payload = event.payload.is_a?(Hash) ? event.payload : {}
      candidate_ids = [
        payload.dig('relationships', 'account', 'data', 'id'),
        payload.dig('relationships', 'settlementAccount', 'data', 'id'),
        payload.dig('attributes', 'payment', 'settlementAccount', 'accountId'),
        payload.dig('attributes', 'settlementAccount', 'accountId')
      ].compact.map(&:to_s).select { |value| value.end_with?('-anc_acc') }
      ids.concat(candidate_ids)
    end

    ids.uniq
  rescue StandardError
    []
  end

  desc 'Deactivate duplicate Anchor accounts for all users and keep one canonical account active'
  task dedupe_all_accounts: :environment do
    duplicate_user_ids = Account.where(vendor: 'anchor')
                                .group(:user_id)
                                .having('COUNT(*) > 1')
                                .pluck(:user_id)

    puts "anchor.dedupe_all_accounts: users_with_duplicates=#{duplicate_user_ids.size}"

    duplicate_user_ids.each do |user_id|
      scope = Account.where(user_id: user_id, vendor: 'anchor')
      canonical = canonical_anchor_account(scope)

      next if canonical.blank?

      ActiveRecord::Base.transaction do
        canonical.update!(active: true)
        scope.where.not(id: canonical.id).update_all(active: false, updated_at: Time.current)
      end

      puts "user_id=#{user_id} canonical_account_id=#{canonical.id}"
    rescue StandardError => e
      warn "user_id=#{user_id} dedupe_failed=#{e.message}"
    end
  end

  desc 'Deactivate duplicate Anchor accounts for a specific user. Usage: rake anchor:dedupe_user_accounts[user_uuid]'
  task :dedupe_user_accounts, [:user_id] => :environment do |_task, args|
    user_id = args[:user_id].to_s.strip
    raise ArgumentError, 'user_id is required' if user_id.blank?

    scope = Account.where(user_id: user_id, vendor: 'anchor')
    raise "No Anchor accounts found for user_id=#{user_id}" if scope.blank?

    canonical = canonical_anchor_account(scope)

    ActiveRecord::Base.transaction do
      canonical.update!(active: true)
      scope.where.not(id: canonical.id).update_all(active: false, updated_at: Time.current)
    end

    puts "anchor.dedupe_user_accounts: user_id=#{user_id} canonical_account_id=#{canonical.id} deactivated=#{scope.where.not(id: canonical.id).count}"
  end

  desc 'Reconcile completed Anchor accounts missing account_number using webhook-linked deposit account ids'
  task reconcile_missing_account_numbers: :environment do
    service = AnchorService.new
    scope = Account.where(vendor: 'anchor', status: :completed, account_number: [nil, ''])

    puts "anchor.reconcile_missing_account_numbers: candidates=#{scope.count}"

    reconciled = 0
    unresolved = 0
    failed = 0

    scope.find_each do |account|
      begin
        deposit_ids = []
        deposit_ids << account.useable_id.to_s if account.useable_id.to_s.end_with?('-anc_acc')
        deposit_ids.concat(extract_deposit_account_ids_from_events(account))
        deposit_ids.uniq!

        details = nil
        selected_deposit_id = nil
        deposit_ids.each do |deposit_id|
          candidate = service.send(:fetch_account_number_details_by_account_id, deposit_id)
          if candidate.present? && candidate[:account_number].to_s.match?(/\A\d{10}\z/)
            selected_deposit_id = deposit_id
            details = candidate
            break
          end
        end

        if details.blank?
          unresolved += 1
          puts "account_id=#{account.id} user_id=#{account.user_id} unresolved=true candidate_deposit_ids=#{deposit_ids.join(',')}"
          next
        end

        updates = {
          useable_id: selected_deposit_id,
          account_number: details[:account_number],
          account_name: details[:account_name].presence || account.account_name,
          bank_name: details[:bank_name].presence || account.bank_name,
          bank_code: details[:bank_code].presence || account.bank_code,
          active: true
        }.compact
        account.update!(updates)

        reconciled += 1
        puts "account_id=#{account.id} user_id=#{account.user_id} reconciled=true useable_id=#{selected_deposit_id} account_number=#{details[:account_number]}"
      rescue StandardError => e
        failed += 1
        warn "account_id=#{account.id} user_id=#{account.user_id} reconcile_failed=#{e.message}"
      end
    end

    puts "anchor.reconcile_missing_account_numbers: reconciled=#{reconciled} unresolved=#{unresolved} failed=#{failed}"
  end

  desc 'Report Anchor accounts that are completed but missing account_number'
  task report_missing_account_numbers: :environment do
    scope = Account.where(vendor: 'anchor', status: :completed, account_number: [nil, ''])
    count = scope.count
    puts "anchor.report_missing_account_numbers: count=#{count}"
    scope.order(updated_at: :desc).limit(50).pluck(:id, :user_id, :account_id, :useable_id, :updated_at).each do |row|
      puts "account_id=#{row[0]} user_id=#{row[1]} customer_id=#{row[2]} useable_id=#{row[3]} updated_at=#{row[4]}"
    end
  end
end
