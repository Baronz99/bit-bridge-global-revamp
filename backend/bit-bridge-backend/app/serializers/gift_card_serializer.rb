# frozen_string_literal: true

class GiftCardSerializer < ActiveModel::Serializer
  attributes :id, :provider, :provision, :value, :header_info, :description, :rating, :notice_info, :alert_info,
             :value_max, :value_min
end
