module Api
  module V1
    module Tunnel
      class WalletController < Api::V1::WalletsController
        def activate_tunnel
          super
        end
      end
    end
  end
end
