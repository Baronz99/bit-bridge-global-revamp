# frozen_string_literal: true

require 'test_helper'

class UserProfilesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user_profile = user_profiles(:one)
  end

  test 'should get index' do
    get user_profiles_url, as: :json
    assert_response :success
  end

  test 'should create user_profile' do
    assert_difference('UserProfile.count') do
      post user_profiles_url,
           params: { user_profile: { first_name: @user_profile.first_name, last_name: @user_profile.last_name, phone_number: @user_profile.phone_number, user_id: @user_profile.user_id } }, as: :json
    end

    assert_response :created
  end

  test 'should show user_profile' do
    get user_profile_url(@user_profile), as: :json
    assert_response :success
  end

  test 'should update user_profile' do
    patch user_profile_url(@user_profile),
          params: { user_profile: { first_name: @user_profile.first_name, last_name: @user_profile.last_name, phone_number: @user_profile.phone_number, user_id: @user_profile.user_id } }, as: :json
    assert_response :success
  end

  test 'should destroy user_profile' do
    assert_difference('UserProfile.count', -1) do
      delete user_profile_url(@user_profile), as: :json
    end

    assert_response :no_content
  end
end
