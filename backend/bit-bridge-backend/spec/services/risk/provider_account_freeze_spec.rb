# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Risk::ProviderAccountFreeze do
  let(:user) { create(:user, :confirmed, email: 'provider-freeze@example.com') }
  let(:control) { user.create_user_risk_control!(monitoring_enabled: true, restricted: true) }
  let!(:account) do
    Account.create!(
      user: user,
      vendor: 'anchor',
      useable_id: '172286425432341-anc_acc',
      account_number: '1234567890',
      account_name: 'Test User',
      active: true
    )
  end

  it 'marks provider freeze as frozen when anchor freeze succeeds' do
    service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(service)
    allow(service).to receive(:freeze_deposit_account).and_return(status: :ok, data: {})

    result = described_class.freeze_for_user!(user: user, control: control, reason: 'risk hold')

    expect(result[:status]).to eq(:ok)
    expect(control.reload.provider_freeze_status).to eq('frozen')
    expect(control.provider_freeze_requested_at).to be_present
  end

  it 'marks provider freeze as released when anchor unfreeze succeeds' do
    control.update!(provider_freeze_status: 'frozen', provider_freeze_requested_at: Time.current)
    service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(service)
    allow(service).to receive(:unfreeze_deposit_account).and_return(status: :ok, data: {})

    result = described_class.unfreeze_for_user!(user: user, control: control)

    expect(result[:status]).to eq(:ok)
    expect(control.reload.provider_freeze_status).to eq('released')
  end
end
