# frozen_string_literal: true

namespace :bridgecard do
  desc 'Sync Bridgecard transactions for a card (usage: bridgecard:sync_card_transactions[card_uuid,page_limit])'
  task :sync_card_transactions, %i[card_uuid page_limit] => :environment do |_, args|
    card_uuid = args[:card_uuid].to_s
    page_limit = args[:page_limit].to_i

    card = Card.find_by(id: card_uuid)
    if card.blank?
      puts "Card not found: #{card_uuid}"
      next
    end

    result = Bridgecard::SyncCardTransactions.call(card: card, page_limit: page_limit)
    puts "status=#{result[:status]} count=#{result[:count]} message=#{result[:message]}"
  end
end
