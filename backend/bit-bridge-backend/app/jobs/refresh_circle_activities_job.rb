# frozen_string_literal: true

class RefreshCircleActivitiesJob < ApplicationJob
  queue_as :default

  def perform
    CircleActivity.find_each do |act|
      act.refresh_status!
    rescue StandardError => e
      Rails.logger.error("[RefreshCircleActivitiesJob] #{act.id} #{e.class}: #{e.message}")
    end
  end
end
