# frozen_string_literal: true

require "net/http"
require "json"

class TermiiClient
  ENDPOINT = "https://api.ng.termii.com/api/sms/send"

  def initialize(api_key: ENV["TERMII_API_KEY"])
    @api_key = api_key
  end

  def send_otp_sms!(to_e164:, code:)
    payload = {
      to: to_e164,
      from: "N-Alert",
      sms: "Your BitBridge Global verification code is #{code}. Expires in 5 minutes. Do not share this code.",
      type: "plain",
      channel: "dnd",
      api_key: @api_key
    }

    uri = URI(ENDPOINT)
    req = Net::HTTP::Post.new(uri)
    req["Content-Type"] = "application/json"
    req.body = payload.to_json

    res  = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |http| http.request(req) }
    body = JSON.parse(res.body) rescue {}

    ok = res.is_a?(Net::HTTPSuccess) && (
      body["code"].to_s.downcase == "ok" ||
      body["status"].to_s.downcase == "success" ||
      body["message"].to_s.downcase.include?("success")
    )

    message_id = extract_message_id(body)
    provider_status = ok ? "queued" : "failed"

    if defined?(Rails)
      Rails.logger.info(
        "[Termii] sms response http_status=#{res.code} ok=#{ok} message_id=#{message_id} body=#{body.to_json}"
      )
    end

    {
      ok: ok,
      body: body,
      http_status: res.code.to_i,
      message_id: message_id,
      provider_status: provider_status
    }
  rescue StandardError => e
    {
      ok: false,
      body: { "error" => e.message },
      http_status: 0,
      message_id: nil,
      provider_status: "failed"
    }
  end

  private

  # Termii responses vary; try common keys safely
  def extract_message_id(body)
    return nil unless body.is_a?(Hash)

    body["message_id"] ||
      body["messageId"] ||
      body["sms_id"] ||
      body.dig("data", "message_id") ||
      body.dig("data", "messageId") ||
      body.dig("data", "sms_id") ||
      body.dig("data", "id")
  end
end
