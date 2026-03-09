module Api
  module V1
    module Bridge
      class WalletTransfersController < Api::V1::WalletsController
        def send_money
          super
        end
      end
    end
  end
end
