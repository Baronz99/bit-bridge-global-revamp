# frozen_string_literal: true

module Api
  module V1
    class CurrenciesController < ApplicationController
      skip_before_action :authenticate_user!
      # before_action :set_wallet, only: %i[ show update destroy ]

      def get_currency
        from_curr = params[:from_curr]
        to_curr = params[:to_curr]
        amount = params[:amount]

        conversion = CurrencyService.new(from_curr, to_curr)
        # response = conversion.get_conversion

        response = conversion.get_calculated_rate(amount, from_curr, to_curr)


        if response[:status] == 'error'
          render json: { message: response[:message] }

        else
          render json: { data: response }

        end
      end
    end
  end
end
