# frozen_string_literal: true

require 'test_helper'

class UserProfileTest < ActiveSupport::TestCase
  test 'normalizes phone_number and phone_e164 before validation' do
    profile = UserProfile.new(user: users(:one), phone_number: ' 08133385157 ')

    assert profile.valid?
    assert_equal '08133385157', profile.phone_number
    assert_equal '2348133385157', profile.phone_e164
  end

  test 'rejects duplicate canonical phone even with formatting differences' do
    UserProfile.create!(user: users(:one), phone_number: '08133385157')

    duplicate = UserProfile.new(user: users(:two), phone_number: '+234 813 338 5157')

    assert_not duplicate.valid?
    assert duplicate.errors.of_kind?(:phone_e164, :taken)
  end
end
