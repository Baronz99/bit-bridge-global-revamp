# frozen_string_literal: true

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

    host = ENV['STAGING_BACKEND_HOST'] || ENV['BACKEND_HOST'] || 'localhost:3000'
    return unless host.present?

    Rails.application.routes.url_helpers.rails_blob_url(object.id_document, host: host)
  end

  def proof_of_address_url
    return unless object.respond_to?(:proof_of_address) && object.proof_of_address.attached?

    host = ENV['STAGING_BACKEND_HOST'] || ENV['BACKEND_HOST'] || 'localhost:3000'
    return unless host.present?

    Rails.application.routes.url_helpers.rails_blob_url(object.proof_of_address, host: host)
  end
end
