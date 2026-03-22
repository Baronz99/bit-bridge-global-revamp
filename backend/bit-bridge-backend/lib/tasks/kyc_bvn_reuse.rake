# frozen_string_literal: true

namespace :kyc do
  desc 'List users whose BVN is marked verified but is not reusable'
  task audit_non_reusable_bvn: :environment do
    scope = UserKyc.where(bvn_status: 'verified').where.not(bvn_verified_at: nil).where(bvn_encrypted: [nil, ''])

    puts "non_reusable_verified_bvn_count=#{scope.count}"

    scope.includes(:user).find_each do |kyc|
      puts({
        user_id: kyc.user_id,
        email: kyc.user&.email,
        kyc_level: kyc.user&.kyc_level,
        bvn_status: kyc.bvn_status,
        bvn_verified_at: kyc.bvn_verified_at,
        updated_at: kyc.updated_at
      }.to_json)
    end
  end
end
