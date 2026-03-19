# frozen_string_literal: true

module Risk
  class ProviderAccountFreeze
    class << self
      def freeze_for_user!(user:, control:, reason:)
        account = canonical_anchor_account_for(user)
        return { status: :noop, reason: 'no_anchor_deposit_account' } if account.blank?

        control.update!(
          provider_freeze_requested_at: Time.current,
          provider_freeze_status: 'pending',
          provider_freeze_error: nil
        )

        response = AnchorService.new.freeze_deposit_account(
          account_id: account.useable_id,
          freeze_reason: 'FRAUD',
          freeze_description: reason.to_s.presence || 'Risk restriction'
        )

        if response[:status] == :ok
          control.update!(
            provider_freeze_status: 'frozen',
            provider_freeze_error: nil
          )
        else
          control.update!(
            provider_freeze_status: 'failed',
            provider_freeze_error: response[:message].to_s.presence || 'Provider freeze failed'
          )
        end

        response
      rescue StandardError => e
        control.update!(
          provider_freeze_status: 'failed',
          provider_freeze_error: e.message.to_s
        )
        { status: :bad_request, message: e.message.to_s }
      end

      def unfreeze_for_user!(user:, control:)
        account = canonical_anchor_account_for(user)
        return { status: :noop, reason: 'no_anchor_deposit_account' } if account.blank?

        response = AnchorService.new.unfreeze_deposit_account(account_id: account.useable_id)

        if response[:status] == :ok
          control.update!(
            provider_freeze_status: 'released',
            provider_freeze_error: nil
          )
        else
          control.update!(
            provider_freeze_status: 'failed',
            provider_freeze_error: response[:message].to_s.presence || 'Provider unfreeze failed'
          )
        end

        response
      rescue StandardError => e
        control.update!(
          provider_freeze_status: 'failed',
          provider_freeze_error: e.message.to_s
        )
        { status: :bad_request, message: e.message.to_s }
      end

      private

      def canonical_anchor_account_for(user)
        return nil if user.blank?

        user.accounts
            .where(vendor: 'anchor')
            .where("useable_id IS NOT NULL AND useable_id <> ''")
            .order(
              Arel.sql("CASE WHEN active = TRUE THEN 0 ELSE 1 END ASC"),
              Arel.sql("CASE WHEN account_number IS NOT NULL AND account_number <> '' THEN 0 WHEN useable_id IS NOT NULL AND useable_id <> '' THEN 1 ELSE 2 END ASC"),
              status: :desc,
              updated_at: :desc,
              created_at: :desc
            )
            .detect { |account| account.useable_id.to_s.end_with?('-anc_acc') }
      end
    end
  end
end
