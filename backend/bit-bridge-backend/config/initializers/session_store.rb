# frozen_string_literal: true

if Rails.env.production? || Rails.env.staging?
  Rails.application.config.session_store :cookie_store,
    key: '_bit_bridge_session',
    domain: :all,     # allow cross-domain use (Netlify <-> Render)
    same_site: :none, # required for cross-site cookies
    secure: true      # required when SameSite=None
else
  # Local dev (localhost): keep it simple
  Rails.application.config.session_store :cookie_store,
    key: '_bit_bridge_session'
end