module Api
  module V1
    module Tunnel
      class FxConversionsController < Api::V1::WalletsController
        def convert_ngn_to_usd
          super
        end

        def convert_usd_to_ngn
          super
        end
      end
    end
  end
end
