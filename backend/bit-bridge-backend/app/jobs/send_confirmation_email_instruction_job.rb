# frozen_string_literal: true

class SendConfirmationEmailInstructionJob < ApplicationJob
  queue_as :default

  def perform(*_args)
    UserMailer.welcome(self)

    # Do something later
  end
end
