# frozen_string_literal: true

class HandleEventJob < ApplicationJob
  queue_as :default

  def perform(*args)
    # Do something later
  end
end
