# frozen_string_literal: true
require "pp"

scope = Transaction.joins(:transaction_record).where(transaction_records: { event_type: nil })

puts "TOTAL=#{scope.count}"

refs = scope.limit(50).pluck("transaction_records.reference")
puts "SAMPLE_REFERENCES:"
pp refs

patterns = refs.compact.map(&:to_s).group_by do |r|
  if r.start_with?("mon", "MON", "MNF")
    "monnify_like"
  elsif r.start_with?("anc", "ANC", "anchor")
    "anchor_like"
  elsif r.include?("-") || r.match?(/[a-f0-9]{8}-[a-f0-9]{4}/i)
    "uuidish_or_hyphen"
  else
    "other"
  end
end.transform_values(&:count)

puts "PATTERN_COUNTS_IN_SAMPLE:"
pp patterns
