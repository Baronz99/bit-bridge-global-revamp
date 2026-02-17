# frozen_string_literal: true

namespace :anchor do
  desc 'Backfill Anchor account display fields from /account-numbers canonical source'
  task backfill_account_metadata: :environment do
    dry_run = ENV['DRY_RUN'].to_s.strip.downcase == 'true'
    email = ENV['EMAIL'].to_s.strip.downcase

    scope = Account.where(vendor: 'anchor').where.not(useable_id: [nil, '']).where.not(account_number: [nil, ''])
    scope = scope.joins(:user).where('lower(users.email)=?', email) if email.present?

    service = AnchorService.new
    scanned = 0
    changed = 0

    scope.find_each(batch_size: 100) do |account|
      scanned += 1
      before = account.attributes.slice('account_number', 'bank_name', 'bank_code', 'account_name')
      details = service.send(:fetch_account_number_details_by_account_id, account.useable_id)
      next if details.blank?

      updates = {}
      updates[:account_number] = details[:account_number] if details[:account_number].present? && details[:account_number] != account.account_number
      updates[:bank_name] = details[:bank_name] if details[:bank_name].present? && details[:bank_name] != account.bank_name
      updates[:bank_code] = details[:bank_code] if details[:bank_code].present? && details[:bank_code] != account.bank_code
      updates[:account_name] = details[:account_name] if details[:account_name].present? && details[:account_name] != account.account_name
      next if updates.empty?

      changed += 1
      if dry_run
        puts({ mode: 'dry_run', account_id: account.id, useable_id: account.useable_id, before: before, after: before.merge(updates.stringify_keys) }.to_json)
      else
        account.update!(updates)
      end
    end

    puts({ scanned: scanned, changed: changed, dry_run: dry_run, email: email.presence || 'all' }.to_json)
  end
end
