# frozen_string_literal: true

namespace :anchor do
  desc 'Deactivate duplicate Anchor accounts for all users and keep one canonical account active'
  task dedupe_all_accounts: :environment do
    duplicate_user_ids = Account.where(vendor: 'anchor')
                                .group(:user_id)
                                .having('COUNT(*) > 1')
                                .pluck(:user_id)

    puts "anchor.dedupe_all_accounts: users_with_duplicates=#{duplicate_user_ids.size}"

    duplicate_user_ids.each do |user_id|
      scope = Account.where(user_id: user_id, vendor: 'anchor')
      canonical = scope.order(
        Arel.sql("CASE WHEN active = TRUE THEN 0 ELSE 1 END ASC"),
        Arel.sql("CASE WHEN account_number IS NOT NULL AND account_number <> '' THEN 0 WHEN useable_id IS NOT NULL AND useable_id <> '' THEN 1 ELSE 2 END ASC"),
        status: :desc,
        updated_at: :desc,
        created_at: :desc
      ).first

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

    canonical = scope.order(
      Arel.sql("CASE WHEN active = TRUE THEN 0 ELSE 1 END ASC"),
      Arel.sql("CASE WHEN account_number IS NOT NULL AND account_number <> '' THEN 0 WHEN useable_id IS NOT NULL AND useable_id <> '' THEN 1 ELSE 2 END ASC"),
      status: :desc,
      updated_at: :desc,
      created_at: :desc
    ).first

    ActiveRecord::Base.transaction do
      canonical.update!(active: true)
      scope.where.not(id: canonical.id).update_all(active: false, updated_at: Time.current)
    end

    puts "anchor.dedupe_user_accounts: user_id=#{user_id} canonical_account_id=#{canonical.id} deactivated=#{scope.where.not(id: canonical.id).count}"
  end
end
