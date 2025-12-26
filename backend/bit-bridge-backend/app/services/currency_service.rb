# frozen_string_literal: true

require 'bigdecimal'
require 'bigdecimal/util'

class CurrencyService
  include HTTParty

  base_uri 'https://api.coingecko.com/api/v3'
  DEFAULT_TTL = 3.minutes

  def initialize(from_curr = 'ngn', to_curr = 'usd', ttl: DEFAULT_TTL)
    @from_curr = normalize(from_curr)
    @to_curr   = normalize(to_curr)
    @ttl       = ttl
  end

  # Public: returns a stable, production-friendly hash
  #
  # Example:
  # {
  #   status: "ok",
  #   from: "ngn",
  #   to: "usd",
  #   amount: "15000.0",
  #   rate: "0.00066",
  #   calc: "9.90",
  #   source: "coingecko",
  #   fetched_at: "2025-12-23T08:20:00Z",
  #   cached: true
  # }
  def convert(amount:, from: @from_curr, to: @to_curr)
    from = normalize(from)
    to   = normalize(to)

    amt = BigDecimal(amount.to_s)
    return error('amount must be greater than 0') if amt <= 0

    data = fetch_exchange_rates!
    rates = data.fetch('rates')

    from_rate = dig_rate_value(rates, from)
    to_rate   = dig_rate_value(rates, to)

    # CoinGecko "exchange_rates" values represent rates vs BTC.
    # Conversion formula (matching your old logic):
    # to_amount = (to_value / from_value) * amount
    # Also: rate = to_value / from_value
    rate = (to_rate / from_rate)
    calc = (rate * amt)

    ok(
      from: from,
      to: to,
      amount: amt,
      rate: rate,
      calc: calc,
      fetched_at: data.fetch('fetched_at'),
      cached: data.fetch('cached'),
      source: data.fetch('source')
    )
  rescue KeyError => e
    error("Unsupported currency code: #{e.message}")
  rescue StandardError => e
    error(e.message)
  end

  # Backward-compatible wrapper (so your existing controller can keep calling it)
  # Keeps the same name you already use: get_calculated_rate(amount, from_curr, to_curr)
  def get_calculated_rate(amount, from_curr, to_curr)
    convert(amount: amount, from: from_curr, to: to_curr)
  end

  private

  def normalize(code)
    code.to_s.strip.downcase
  end

  def ok(from:, to:, amount:, rate:, calc:, fetched_at:, cached:, source:)
    {
      status: 'ok',
      from:,
      to:,
      amount: amount.to_s('F'),
      rate: rate.to_s('F'),
      calc: calc.round(2).to_s('F'),
      source:,
      fetched_at: fetched_at.iso8601,
      cached:
    }
  end

  def error(message)
    { status: 'error', message: message.to_s }
  end

  # Returns:
  # {
  #   "rates" => {...},
  #   "fetched_at" => Time,
  #   "cached" => true/false,
  #   "source" => "coingecko"
  # }
  def fetch_exchange_rates!
    record = Currency.first || Currency.create!(exchange_rates: nil, rate_time_stamp: nil)

    # Prefer datetime column; yours is string now, so handle both
    last_ts =
      begin
        ts = record.rate_time_stamp
        ts.is_a?(Time) || ts.is_a?(ActiveSupport::TimeWithZone) ? ts : (ts.present? ? Time.parse(ts.to_s) : nil)
      rescue StandardError
        nil
      end

    if record.exchange_rates.present? && last_ts.present? && (Time.current - last_ts) <= @ttl
      return {
        'rates' => record.exchange_rates['rates'] || record.exchange_rates[:rates],
        'fetched_at' => last_ts,
        'cached' => true,
        'source' => 'coingecko'
      }
    end

    response = self.class.get('/exchange_rates')

    unless response.respond_to?(:success?) && response.success?
      raise "CoinGecko exchange_rates failed (status #{response&.code})"
    end

    payload = response.parsed_response
    raise 'CoinGecko response missing rates' unless payload.is_a?(Hash) && payload['rates'].is_a?(Hash)

    now = Time.current

    record.update!(
      exchange_rates: payload,
      rate_time_stamp: now
    )

    {
      'rates' => payload['rates'],
      'fetched_at' => now,
      'cached' => false,
      'source' => 'coingecko'
    }
  end

  def dig_rate_value(rates, code)
    node = rates.fetch(code) # raises KeyError if unsupported
    val = node['value'] || node[:value]
    raise KeyError, code if val.nil?
    BigDecimal(val.to_s)
  end
end
