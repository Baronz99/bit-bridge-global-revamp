# frozen_string_literal: true

# Usage:
#   ADMIN_EMAIL=ops@bitbridge.com bundle exec rails runner script/create_founders_circle.rb
#
# Optional overrides:
#   NAME="BitBridge Founders Circle"
#   PURPOSE="Founding community"
#   DESCRIPTION="Early supporters and founding members coordinating contributions."
#   BADGE_LABEL="Founders Circle"
#   MAX_CONTRIBUTION_CENTS=500000
#   VISIBILITY=official_featured
#   KYC_MODE=flexible

admin_email = ENV.fetch('ADMIN_EMAIL').to_s.strip.downcase
raise 'ADMIN_EMAIL is required' if admin_email.blank?

owner = User.find_by(email: admin_email)
raise "Admin user not found for #{admin_email}" unless owner
raise "User #{admin_email} is not a BitBridge admin" unless owner.admin?

name = ENV.fetch('NAME', 'BitBridge Founders Circle').to_s.strip
purpose = ENV.fetch('PURPOSE', 'Founding community').to_s.strip
description = ENV.fetch(
  'DESCRIPTION',
  'Early supporters and founding members coordinating contributions through BitBridge.'
).to_s.strip
badge_label = ENV.fetch('BADGE_LABEL', 'Founders Circle').to_s.strip
kyc_mode = ENV.fetch('KYC_MODE', 'flexible').to_s.strip
visibility = ENV.fetch('VISIBILITY', 'official_featured').to_s.strip
max_contribution_cents = ENV['MAX_CONTRIBUTION_CENTS'].presence&.to_i

circle = Circle.find_or_initialize_by(name: name)
circle.assign_attributes(
  owner: owner,
  purpose: purpose,
  description: description,
  circle_type: 'official',
  kyc_mode: kyc_mode,
  visibility: visibility,
  badge_label: badge_label.presence,
  max_contribution_cents: max_contribution_cents
)
circle.save!

membership = circle.circle_memberships.find_or_initialize_by(user: owner)
membership.role = :admin
membership.save! if membership.new_record? || membership.changed?

puts "Founders Circle ready: id=#{circle.id} name=#{circle.name.inspect} circle_type=#{circle.circle_type} visibility=#{circle.visibility} kyc_mode=#{circle.kyc_mode} max_contribution_cents=#{circle.max_contribution_cents.inspect}"
