# frozen_string_literal: true

require 'uri'

class UserProfileSerializer < ActiveModel::Serializer
  attributes :id,
             :first_name,
             :last_name,
             :phone_number,
             :date_of_birth,          # used on ProfilePage
             :address_line1,
             :address_line2,
             :city,
             :state,
             :country,
             :postal_code,
             :proof_of_address_type,
             :id_document_url,        # read-only URL for ID doc
             :proof_of_address_url    # read-only URL for proof of address

  # --- Helpers for document URLs ---

  def id_document_url
    return unless object.respond_to?(:id_document) && object.id_document.attached?

    host, protocol = url_host_and_protocol
    return unless host.present?

    Rails.application.routes.url_helpers.rails_blob_url(
      object.id_document,
      host: host,
      protocol: protocol
    )
  end

  def proof_of_address_url
    return unless object.respond_to?(:proof_of_address) && object.proof_of_address.attached?

    host, protocol = url_host_and_protocol
    return unless host.present?

    Rails.application.routes.url_helpers.rails_blob_url(
      object.proof_of_address,
      host: host,
      protocol: protocol
    )
  end

  private

  # Resolves host + protocol from env, safely handling both:
  #   BACKEND_HOST = "api.myapp.com"
  #   BACKEND_HOST = "https://api.myapp.com"
  #
  # Falls back to localhost for dev.
  def url_host_and_protocol
    raw = ENV['STAGING_BACKEND_HOST'] || ENV['BACKEND_HOST'] || 'localhost:3000'
    return [nil, nil] if raw.blank?

    if raw.include?('://')
      uri = URI.parse(raw)
      [uri.host, uri.scheme || default_protocol]
    else
      [raw, default_protocol]
    end
  rescue URI::InvalidURIError
    [raw, default_protocol]
  end

  def default_protocol
    Rails.env.production? || Rails.env.staging? ? 'https' : 'http'
  end
end
