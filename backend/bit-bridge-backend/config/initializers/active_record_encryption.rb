# frozen_string_literal: true

# Configure Active Record Encryption from ENV.
# This avoids needing credentials:edit on Windows.
Rails.application.config.active_record.encryption.primary_key =
  ENV["ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY"]

Rails.application.config.active_record.encryption.deterministic_key =
  ENV["ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY"]

Rails.application.config.active_record.encryption.key_derivation_salt =
  ENV["ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT"]
