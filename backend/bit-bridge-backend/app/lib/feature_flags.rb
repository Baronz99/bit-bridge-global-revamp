# frozen_string_literal: true

module FeatureFlags
  def self.enabled?(key)
    %w[true 1 yes].include?(ENV[key].to_s.downcase)
  end

  def self.termii?
    enabled?('ENABLE_TERMII')
  end

  def self.prembly?
    enabled?('ENABLE_PREMBLY')
  end

  def self.bridge_cards?
    enabled?('ENABLE_BRIDGE_CARDS')
  end
end
