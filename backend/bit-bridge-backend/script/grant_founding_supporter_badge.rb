# frozen_string_literal: true

# Usage:
#   GRANTED_BY_EMAIL=2016rocket@gmail.com CIRCLE_ID=<founders-circle-id> bundle exec rails runner script/grant_founding_supporter_badge.rb
#
# Optional overrides:
#   BADGE_KEY=founding_supporter
#   BADGE_NAME="Founding Supporter"
#   BADGE_DESCRIPTION="Awarded to early supporters of the BitBridge Founders Circle."
#   CUTOFF_AT=2026-04-30T23:59:59Z
#   MIN_TOTAL_CONTRIBUTION_CENTS=5000000
#   SOURCE_RULE=founders_circle_support_v1
#   DRY_RUN=1

granted_by_email = ENV.fetch('GRANTED_BY_EMAIL').to_s.strip.downcase
raise 'GRANTED_BY_EMAIL is required' if granted_by_email.blank?

granted_by = User.find_by(email: granted_by_email)
raise "Admin user not found for #{granted_by_email}" unless granted_by
raise "User #{granted_by_email} is not a BitBridge admin" unless granted_by.admin?

circle =
  if ENV['CIRCLE_ID'].present?
    Circle.find(ENV['CIRCLE_ID'])
  else
    Circle.find_by!(name: ENV.fetch('CIRCLE_NAME', 'BitBridge Founders Circle'))
  end

badge_key = ENV.fetch('BADGE_KEY', 'founding_supporter').to_s.strip
badge_name = ENV.fetch('BADGE_NAME', 'Founding Supporter').to_s.strip
badge_description = ENV.fetch(
  'BADGE_DESCRIPTION',
  'Awarded to early supporters of the BitBridge Founders Circle.'
).to_s.strip
source_rule = ENV.fetch('SOURCE_RULE', 'founders_circle_support_v1').to_s.strip
cutoff_at = ENV['CUTOFF_AT'].present? ? Time.zone.parse(ENV['CUTOFF_AT']) : nil
min_total_contribution_cents = ENV['MIN_TOTAL_CONTRIBUTION_CENTS'].presence&.to_i || 0
dry_run = ENV['DRY_RUN'] == '1'

badge = Badge.find_or_initialize_by(key: badge_key)
badge.name = badge_name
badge.description = badge_description
badge.active = true if badge.new_record?
badge.save! unless dry_run

scope = circle.circle_transactions.where(direction: CircleTransaction.directions[:credit], kind: 'fund')
scope = scope.where('occurred_at <= ?', cutoff_at) if cutoff_at.present?

contributors = scope
               .group(:user_id)
               .select(
                 :user_id,
                 'SUM(amount_cents) AS total_contributed_cents',
                 'COUNT(*) AS contribution_count',
                 'MIN(occurred_at) AS first_contributed_at',
                 'MAX(occurred_at) AS last_contributed_at'
               )
               .having('SUM(amount_cents) >= ?', min_total_contribution_cents)
               .order(Arel.sql('SUM(amount_cents) DESC, MAX(occurred_at) DESC'))

stats = {
  circle_id: circle.id,
  badge_key: badge_key,
  scanned: contributors.size,
  granted: 0,
  skipped_existing: 0,
  dry_run: dry_run
}

contributors.each do |summary|
  existing = UserBadge.find_by(user_id: summary.user_id, badge_id: badge.id, source_circle_id: circle.id) unless dry_run
  if existing.present?
    stats[:skipped_existing] += 1
    next
  end

  attrs = {
    user_id: summary.user_id,
    badge_id: badge.id,
    granted_by_user_id: granted_by.id,
    source_circle_id: circle.id,
    source_rule: source_rule,
    granted_at: Time.current,
    metadata: {
      total_contributed_cents: summary.total_contributed_cents.to_i,
      contribution_count: summary.contribution_count.to_i,
      first_contributed_at: summary.first_contributed_at,
      last_contributed_at: summary.last_contributed_at,
      cutoff_at: cutoff_at,
      badge_key: badge_key
    }.compact
  }

  if dry_run
    stats[:granted] += 1
  else
    UserBadge.create!(attrs)
    stats[:granted] += 1
  end
end

unless dry_run
  AdminAuditEvent.create!(
    admin_user_id: granted_by.id,
    action: 'admin.badges.founding_supporter.grant',
    metadata: stats.merge(
      cutoff_at: cutoff_at,
      min_total_contribution_cents: min_total_contribution_cents,
      request_source: 'rails_runner'
    )
  )
end

puts stats.inspect
