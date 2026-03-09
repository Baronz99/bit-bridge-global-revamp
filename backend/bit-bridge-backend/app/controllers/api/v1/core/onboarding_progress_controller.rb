# frozen_string_literal: true

module Api
  module V1
    module Core
      class OnboardingProgressController < Api::V1::UsersController
        def onboarding_stage
          super
        end

        def use_case
          super
        end
      end
    end
  end
end
