module Api
  module V1
    module Tunnel
      class FxQuotesController < Api::V1::WalletsController
        def quote_ngn_to_usd
          super
        end

        def quote_usd_to_ngn
          super
        end
      end
    end
  end
end
