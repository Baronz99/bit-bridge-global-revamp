#!/usr/bin/env ruby
# frozen_string_literal: true

require 'optparse'
require_relative '../../app/services/ledger/hold_invariant_repair_service'

options = {
  commit: false,
  reconcile_processing: false,
  reconcile_only: false,
  stale_processing: false,
  stale_processing_threshold_hours: 2
}

parser = OptionParser.new do |opts|
  opts.banner = "Usage: rails runner script/ledger/repair_hold_invariants.rb [--commit] [--reconcile-processing] [--reconcile-only] [--stale-processing] [--stale-processing-threshold HOURS]"
  opts.on('--commit', 'Create ledger entries for fixes') { options[:commit] = true }
  opts.on('--reconcile-processing', 'Attempt provider reconciliation for processing/initialized holds before repairs') { options[:reconcile_processing] = true }
  opts.on('--reconcile-only', 'Only run processing reconciliation (skip credit/release repairs)') { options[:reconcile_only] = true }
  opts.on('--stale-processing', 'Fallback: release processing/initialized holds older than threshold with no debit') { options[:stale_processing] = true }
  opts.on('--stale-processing-threshold HOURS', Integer, 'Age in hours for stale processing fallback (default: 2)') { |v| options[:stale_processing_threshold_hours] = v }
  opts.on('-h', '--help', 'Show this message') do
    puts opts
    exit
  end
end

parser.parse!(ARGV)

mode = options[:commit] ? 'commit' : 'dry-run'
if options[:commit] && options[:stale_processing]
  warn '[ledger_repair] WARNING: stale_processing enabled in COMMIT mode. Ensure providers are unreachable/irrecoverable before proceeding.'
end

service = Ledger::HoldInvariantRepairService.new(
  commit: options[:commit],
  reconcile_processing: options[:reconcile_processing],
  reconcile_only: options[:reconcile_only],
  stale_processing: options[:stale_processing],
  stale_processing_threshold_hours: options[:stale_processing_threshold_hours]
).run
summary = service.summary

puts "[ledger_repair] Mode=#{mode} overclosed=#{summary[:overclosed]} stale=#{summary[:stale]} reconciled_success=#{summary[:reconciled_success]} reconciled_failed=#{summary[:reconciled_failed]} stale_processing=#{summary[:stale_processing]}"
service.actions.each do |type, entries|
  next if entries.empty?
  puts "[ledger_repair] #{type} entries:"
  entries.each do |entry|
    puts "  bill_order=#{entry[:bill_order_id]} amount=#{entry[:amount]} applied=#{entry[:created]}"
  end
end

puts '[ledger_repair] Completed.'
