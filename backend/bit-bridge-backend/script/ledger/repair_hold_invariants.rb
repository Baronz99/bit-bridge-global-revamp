#!/usr/bin/env ruby
# frozen_string_literal: true

require 'optparse'
require_relative '../../app/services/ledger/hold_invariant_repair_service'

options = { commit: false }

parser = OptionParser.new do |opts|
  opts.banner = "Usage: rails runner script/ledger/repair_hold_invariants.rb [--commit]"
  opts.on('--commit', 'Create ledger entries for fixes') do
    options[:commit] = true
  end
  opts.on('-h', '--help', 'Show this message') do
    puts opts
    exit
  end
end

parser.parse!(ARGV)

mode = options[:commit] ? 'commit' : 'dry-run'
service = Ledger::HoldInvariantRepairService.new(commit: options[:commit]).run
summary = service.summary

puts "[ledger_repair] Mode=#{mode} overclosed=#{summary[:overclosed]} stale=#{summary[:stale]}"
service.actions.each do |type, entries|
  next if entries.empty?
  puts "[ledger_repair] #{type} entries:"
  entries.each do |entry|
    puts "  bill_order=#{entry[:bill_order_id]} amount=#{entry[:amount]} applied=#{entry[:created]}"
  end
end

puts '[ledger_repair] Completed.'
