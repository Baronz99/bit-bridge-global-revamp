# frozen_string_literal: true

class UserProfileSerializer < ActiveModel::Serializer
  attributes :id,
             :first_name,
             :last_name,
             :phone_number,
             :date_of_birth,          # 👈 already used on ProfilePage
             :address_line1,
             :address_line2,
             :city,
             :state,
             :country,
             :postal_code,
             :proof_of_address_type,
             :id_document_url,        # 👈 NEW – read-only URL for ID doc
             :proof_of_address_url    # 👈 NEW – read-only URL for proof of address

  # If you don't want to expose the full user object, keep this commented out
  # has_one :user

  # --- Helpers for document URLs ---

  def id_document_url
    return unless object.respond_to?(:id_document) && object.id_document.attached?

    host = ENV['STAGING_BACKEND_HOST'] || ENV['BACKEND_HOST'] || 'localhost:3000'
    Rails.application.routes.url_helpers.rails_blob_url(object.id_document, host: host)
  end

  def proof_of_address_url
    return unless object.respond_to?(:proof_of_address) && object.proof_of_address.attached?

    host = ENV.fetch('STAGING_BACKEND_HOST', ENV.fetch('BACKEND_HOST', nil))

return unless host.present?

    def id_document_url
  return unless object.id_document.attached?

  host = ENV['STAGING_BACKEND_HOST'] || ENV['BACKEND_HOST']
  return unless host.present?

  Rails.application.routes.url_helpers.rails_blob_url(object.id_document, host: host, protocol: "https")
end
end
