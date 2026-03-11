# frozen_string_literal: true

module Core
  module Catalog
    class ServiceCatalogQuery
      def initialize(section: nil, category: nil)
        @section = normalize_value(section)
        @category = normalize_value(category)
      end

      def call
        provisions
          .filter_map { |provision| catalog_entry(provision) }
          .select { |entry| include_entry?(entry) }
          .sort_by { |entry| [entry[:section].to_s, entry[:label].to_s, entry[:provider].to_s] }
      end

      private

      def provisions
        Provision.includes(:product).where.not(product_id: nil)
      end

      def catalog_entry(provision)
        product = provision.product
        return nil if product.blank?
        return nil if product.provider.to_s.strip.blank?

        Core::Catalog::ServicePolicy.new(product: product, provision: provision).call
      end

      def include_entry?(entry)
        category_matches?(entry) && section_matches?(entry)
      end

      def category_matches?(entry)
        return true if @category.blank?

        entry[:category].to_s == @category
      end

      def section_matches?(entry)
        return true if @section.blank?

        entry[:section].to_s == @section
      end

      def normalize_value(value)
        value.to_s.strip.presence
      end
    end
  end
end
