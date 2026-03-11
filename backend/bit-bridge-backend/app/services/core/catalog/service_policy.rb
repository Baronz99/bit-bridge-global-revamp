# frozen_string_literal: true

require 'cgi'

module Core
  module Catalog
    class ServicePolicy
      SERVICE_TYPE_LABELS = {
        'VTU' => 'Airtime',
        'DATA' => 'Data',
        'TV' => 'Cable TV',
        'ELECTRICITY' => 'Electricity',
        'UTILITY' => 'Utilities'
      }.freeze

      SECTION_ROUTE_MAPPINGS = {
        'VTU' => {
          section: 'bridge',
          route: '/dashboard/bridge',
          launcher_route: '/dashboard/utilities/mobile-top-up',
          admin_route: '/admin/products?category=mobile%20provider'
        },
        'DATA' => {
          section: 'bridge',
          route: '/dashboard/bridge',
          launcher_route: '/dashboard/utilities/mobile-top-up',
          admin_route: '/admin/products?category=mobile%20provider'
        },
        'TV' => {
          section: 'bridge',
          route: '/dashboard/bridge',
          launcher_route: '/dashboard/utilities/cable',
          admin_route: '/admin/products?category=utility'
        },
        'ELECTRICITY' => {
          section: 'bridge',
          route: '/dashboard/bridge',
          launcher_route: '/dashboard/utilities/buy-power',
          admin_route: '/admin/products?category=power'
        },
        'UTILITY' => {
          section: 'bridge',
          route: '/dashboard/bridge',
          launcher_route: '/dashboard/bridge/utilities',
          admin_route: '/admin/products?category=utility'
        }
      }.freeze

      CATEGORY_ROUTE_MAPPINGS = {
        'gift card' => {
          section: 'tunnel',
          route: '/dashboard/tunnel'
        },
        'crypto' => {
          section: 'tunnel',
          route: '/dashboard/tunnel'
        },
        'service' => {
          section: 'bridge',
          route: '/dashboard/bridge'
        }
      }.freeze

      def initialize(product:, provision:)
        @product = product
        @provision = provision
      end

      def call
        {
          key: catalog_key,
          label: label,
          section: section,
          category: product.category,
          provider: product.provider,
          currency: normalized_currency,
          service_type: normalized_service_type,
          product_id: product.id,
          provision_id: provision.id,
          route: route,
          launcher_route: launcher_route,
          admin_route: admin_route,
          active: true
        }.compact
      end

      private

      attr_reader :product, :provision

      def normalized_service_type
        provision.service_type.to_s.upcase.presence
      end

      def section_mapping
        SECTION_ROUTE_MAPPINGS[normalized_service_type] || CATEGORY_ROUTE_MAPPINGS[product.category]
      end

      def section
        section_mapping&.fetch(:section, nil) || fallback_section
      end

      def route
        section_mapping&.fetch(:route, nil) || "/dashboard/#{section}"
      end

      def launcher_route
        section_mapping&.fetch(:launcher_route, nil)
      end

      def admin_route
        section_mapping&.fetch(:admin_route, nil) || "/admin/products?category=#{CGI.escape(product.category.to_s)}"
      end

      def fallback_section
        normalized_currency == 'usd' ? 'tunnel' : 'bridge'
      end

      def label
        SERVICE_TYPE_LABELS[normalized_service_type] || provision.name.presence || product.provision.presence || product.provider
      end

      def normalized_currency
        provision.currency.presence || product.currency.presence || 'ngn'
      end

      def catalog_key
        [
          section,
          product.provider.to_s.parameterize,
          normalized_service_type.to_s.parameterize.presence || provision.name.to_s.parameterize
        ].compact.join(':')
      end
    end
  end
end
