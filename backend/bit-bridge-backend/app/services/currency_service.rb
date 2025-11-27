# frozen_string_literal: true

# require "uri"
# require 'json'
require 'ostruct'


class CurrencyService
  include HTTParty

  base_uri 'https://api.coingecko.com/api/v3'

  def initialize(from_curr, to_curr)
    @from_curr = from_curr
    @to_curr = to_curr
  end

  def get_conversion
    currency = Currency.first


    begin
      if currency.present?
        if Time.now - Time.parse(currency['rate_time_stamp']) > 3.minutes

          response = self.class.get('/exchange_rates')
          time = Time.now

          currency.update(currency_rates: response, rate_time_stamp: time)

          json_parse = JSON.parse(currency['currency_rates'])
          from_rate = json_parse['rates'][@from_curr]['value']
          to_rate = json_parse['rates'][@to_curr]['value']
          OpenStruct.new(from_rate: from_rate, to_rate: to_rate)

          # return {response: conversion.table}
          return json_parse



        end





      # return {response: conversion.table}

      else

        response = self.class.get('/exchange_rates')


        time = Time.now

        currency = Currency.create(currency_rates: response, rate_time_stamp: time)





        # return {response: conversion.table}


      end
      json_string = JSON.parse(currency['currency_rates'])
      from_rate = json_string['rates'][@from_curr]['value']
      to_rate = json_string['rates'][@to_curr]['value']
      OpenStruct.new(from_rate: from_rate, to_rate: to_rate)
      json_string
    rescue StandardError => e
      raise e.message
    end
  end

  def get_calculated_rate(amount, from_curr, to_curr)
    from_value = get_conversion['rates'][from_curr]['value']
    to_value = get_conversion['rates'][to_curr]['value']



    # to_value = get_conversion[:response][:to_rate]
    # from_value = get_conversion[:response][:from_rate]


    calculated_rate = (to_value * amount.to_i) / from_value


    { from_curr: from_value, to_curr: to_value, rate: calculated_rate }
  rescue StandardError => e
    { message: e.message.to_s, status: 'error' }
  end
end
