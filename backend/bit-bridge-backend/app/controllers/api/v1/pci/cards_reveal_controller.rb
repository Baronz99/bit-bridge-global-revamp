# frozen_string_literal: true

module Api
  module V1
    module Pci
      class CardsRevealController < ApplicationController
        before_action :authenticate_user!
        before_action :ensure_bridge_cards_enabled!
        before_action -> { ensure_tier2!(message: "Complete Tier 2 verification to use cards.") }

        # POST /api/v1/pci/cards/:id/reveal
        def create
          # Step-up: require PIN (DO NOT use 401 for failures)
          raw_pin =
            params.dig(:card, :transaction_pin).presence ||
            params.dig(:card, :pin).presence ||
            params[:transaction_pin].presence ||
            ""

          return unless require_transaction_pin!(raw_pin)

          card = current_user.cards.find(params[:id])
          if card.card_id.blank?
            return render json: { message: "card_id not available" }, status: :unprocessable_entity
          end

          # ---- Server-side throttle (per-user + per-card) ----
          # Keep it simple: 6 reveals / 60 seconds per card per user
          throttle_key = "pci:reveal:user=#{current_user.id}:card=#{card.id}"
          count = Rails.cache.read(throttle_key).to_i
          if count >= 6
            return render json: { message: "Too many reveal attempts. Please wait and try again." },
                          status: :too_many_requests
          end
          Rails.cache.write(throttle_key, count + 1, expires_in: 60)

          # ---- Prevent caching anywhere (browser, proxies, CDNs) ----
          response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
          response.headers["Pragma"] = "no-cache"
          response.headers["Expires"] = "0"

          # ---- Hardening headers for sensitive PCI reveal ----
          response.headers["X-Frame-Options"] = "DENY"
          response.headers["X-Content-Type-Options"] = "nosniff"

          service = BridgeCardService.new
          service_response = service.card_details_reveal(card.card_id)

          if service_response[:status] == :ok
            # IMPORTANT: do not persist this data anywhere.
            render json: { data: service_response[:data], status: :ok }, status: :ok
          else
            render json: { message: service_response[:message] }, status: :unprocessable_entity
          end
        end

        private

        def ensure_bridge_cards_enabled!
          return if FeatureFlags.bridge_cards?

          # Don't raise -> avoid 500s in network
          render json: { message: "BRIDGE cards are disabled" }, status: :forbidden
        end
      end
    end
  end
end
