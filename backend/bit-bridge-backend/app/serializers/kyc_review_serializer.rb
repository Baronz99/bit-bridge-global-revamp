# frozen_string_literal: true

class KycReviewSerializer < ActiveModel::Serializer
  attributes :id,
             :kyc_type,
             :status,
             :reason,
             :notes,
             :assigned_to_admin_id,
             :decided_by_admin_id,
             :decided_at,
             :created_at,
             :updated_at

  belongs_to :user
end
