# BitBridge Fees Inventory  Current State + Next Steps

This document reflects fee and pricing logic confirmed in code. Any uncertain or environment-specific values are marked as UNKNOWN with code pointers.

## A. Summary Table (quick view)

| Fee name | Product/flow | Trigger condition | Who pays | Formula | Rounding | Debited? | Stored where | Displayed where | Source-of-truth code locations |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tunnel conversion fee (1%) | Tunnel FX (NGN<->USD) | Quote/convert | User | fee = amount_in * 0.01 | NGN: 0dp, USD: 2dp | Yes (amount_after_fee) | FxQuote.fee_amount / amount_after_fee | Quote response + UI | backend/bit-bridge-backend/app/services/fx_desk/pricing.rb#quote_ngn_to_usd, #quote_usd_to_ngn; backend/bit-bridge-backend/app/services/fx_desk/money.rb |
| Tunnel markup/spread | Tunnel FX (NGN<->USD) | Quote/convert | User (implicit in rate) | markup = max(45, base*0.008) + tier_add; execution_rate = base +/- markup | markup 0dp, rate 6dp | Yes (rate) | FxQuote.markup/execution_rate | Quote response + UI | backend/bit-bridge-backend/app/services/fx_desk/pricing.rb#markup_for_usd_notional, #ask_rate, #bid_rate |
| Anchor transfer fee | NGN bank transfer (Anchor) | initiate_fund_transfer | User | tiered total_fee; stamp duty 50 if amount >= 10000 | 2dp in response | Yes (separate fee txn) | Transaction.metadata.fee_breakdown | Transfer response + Fees UI | backend/bit-bridge-backend/app/services/pricing/engine.rb; backend/bit-bridge-backend/app/services/transfers/anchor_ngn_transfer_service.rb |
| Stamp duty | NGN bank transfer (Anchor) | amount >= 10000 | User | stamp_duty = 50; total_fee includes | 2dp in response | Yes (part of fee txn) | Transaction.metadata.fee_breakdown | Fees UI | backend/bit-bridge-backend/app/services/pricing/engine.rb#stamp_duty_ngn |
| Card spend provider fee | Cards (Bridgecard spend) | Card debit event settled | User | USD: min(1%, $10); non-USD: 1.5% | 2dp | Yes (ledger withdrawal) | CardEvent.metadata + Transaction | Card history UI | backend/bit-bridge-backend/app/services/pricing/card_pricing.rb; backend/bit-bridge-backend/app/services/cards/ledger/post_card_settlement.rb |
| Card spend BitBridge fee | Cards (USD spend) | Card debit event settled | User | USD: min(1%, $5) | 2dp | Yes (ledger withdrawal) | CardEvent.metadata + Transaction | Card history UI | backend/bit-bridge-backend/app/services/pricing/card_pricing.rb; backend/bit-bridge-backend/app/services/cards/ledger/post_card_settlement.rb |
| Card spend FX markup | Cards (non-USD spend) | Card debit event settled | User | non-USD: 1.2% | 2dp | Yes (ledger withdrawal) | CardEvent.metadata + Transaction | Card history UI | backend/bit-bridge-backend/app/services/pricing/card_pricing.rb; backend/bit-bridge-backend/app/services/cards/ledger/post_card_settlement.rb |
| Card creation fee | Cards (create) | Create card (USD tunnel) | User | fixed $4 | 2dp | Yes (wallet withdrawal) | Transaction + Card.meta_data | Card UI | backend/bit-bridge-backend/app/services/bridge_card_service.rb#CARD_CREATION_FEE_USD, #create_card; frontend/bit-bridge-frontend/src/components/cardView/CardView.jsx |
| Card funding fee | Cards (fund) | Fund card | User | bps of amount, capped | 2dp | Yes (separate fee txn) | Transaction.metadata.fee_breakdown | Card UI | backend/bit-bridge-backend/app/services/pricing/card_fee_policy.rb; backend/bit-bridge-backend/app/services/bridge_card_service.rb#fund_wallet |
| Card withdrawal fee | Cards (unload) | Unload card | User | bps of amount, capped; net credit = amount - fee | 2dp | Yes (fee txn + net credit) | Transaction.metadata.fee_breakdown | Card UI | backend/bit-bridge-backend/app/services/pricing/card_fee_policy.rb; backend/bit-bridge-backend/app/services/bridge_card_service.rb#unload_wallet; backend/bit-bridge-backend/app/services/cards/unload_fee_applier.rb |
| Card monthly maintenance | Cards (monthly) | Monthly batch | User | fixed USD from settings | 2dp | Yes (wallet withdrawal) | Transaction.metadata.fee_breakdown | Transactions (if surfaced) | backend/bit-bridge-backend/app/services/cards/monthly_maintenance_charger.rb |
| Bills service charge | Bills/Utilities | Bill order (non-VTU/DATA) | User | NGN 100 | NGN int | Yes (part of total_amount) | BillOrder.service_charge/total_amount | Bill order UI | backend/bit-bridge-backend/app/models/bill_order.rb#calc_service_charge |
| Bills commission (wallet) | Bills/Utilities | Completed bill order | Platform credit to user wallet | 1% of amount (non-electricity) | 2dp | No (credit) | Wallet.commission | Bill order UI | backend/bit-bridge-backend/app/models/bill_order.rb#commission, #save_commission |

## B. Card Pricing (Bridgecard / card spends)

### USD spend pricing breakdown
- Provider fee: min(principal * 1%, $10)
- BitBridge fee: min(principal * 1%, $5)
- FX markup: 0
- Total debit: principal + provider_fee + bitbridge_fee
- Rounding: 2dp
- Code: `backend/bit-bridge-backend/app/services/pricing/card_pricing.rb#quote`
- Ledger posting (idempotent): `backend/bit-bridge-backend/app/services/cards/ledger/post_card_settlement.rb` creates separate withdrawal transactions for principal/provider fee/bitbridge fee.

### Non-USD spend pricing breakdown
- Provider fee: principal * 1.5%
- BitBridge fee: 0
- FX markup: principal * 1.2%
- Total debit: principal + provider_fee + fx_markup
- Rounding: 2dp
- Code: `backend/bit-bridge-backend/app/services/pricing/card_pricing.rb#quote`

### Card creation fee
- Fixed USD 4 on create (tunnel/USD only). Stored in card meta_data and a wallet withdrawal.
- Code: `backend/bit-bridge-backend/app/services/bridge_card_service.rb#CARD_CREATION_FEE_USD`, `#create_card`.

### Card funding fee
- Configured via FxSetting: bps + cap in cents.
- Applied in `BridgeCardService#fund_wallet` as separate fee transaction; total debit = principal + fee.
- Rounding: 2dp via `Pricing::CardFeePolicy`.
- UI uses breakdown in `frontend/bit-bridge-frontend/src/components/cardView/CardView.jsx`.

### Card withdrawal fee
- Configured via FxSetting: bps + cap in cents.
- Applied on unload: gross credit is posted, then fee withdrawal is created (`Cards::UnloadFeeApplier`).
- Net effect: wallet receives amount - fee (fee is separate withdrawal).
- Code: `backend/bit-bridge-backend/app/services/bridge_card_service.rb#unload_wallet`, `backend/bit-bridge-backend/app/services/cards/unload_fee_applier.rb`.

### Monthly maintenance
- Charged per active card once per calendar month, via rake task and `Cards::MonthlyMaintenanceCharger`.
- Fee value from `Pricing::CardFeePolicy` (FxSetting).

### Exposure
- Card history: `backend/bit-bridge-backend/app/controllers/api/v1/cards_controller.rb` includes `breakdown` from transaction metadata.
- UI: `frontend/bit-bridge-frontend/src/components/cardView/CardView.jsx` renders provider/bitbridge/fx/funding/withdrawal fee lines.

## C. Tunnel Wallet FX Desk (NGN/USD)

### Quote flow
- Fee: 1% of input (deducted first).
- Markup rules (ASK/BID spread):
  - percent_floor = base_rate * 0.008
  - markup_floor = max(45, percent_floor)
  - tier add: +30 if USD notional < 50, +15 if < 200, else 0
  - markup = round(0dp)
  - NGN->USD rate = base + markup; USD->NGN rate = base - markup
- Code: `backend/bit-bridge-backend/app/services/fx_desk/pricing.rb`

### Rounding
- NGN amounts: 0dp, USD: 2dp, rates: 6dp.
- Code: `backend/bit-bridge-backend/app/services/fx_desk/money.rb`

### Storage and API
- Quotes persisted in FxQuote (lock token, 5-minute TTL). Fields: base_rate, markup, execution_rate, fee_amount, amount_after_fee, amount_out, raw fields.
- Code: `backend/bit-bridge-backend/app/controllers/api/v1/wallets_controller.rb#quote_ngn_to_usd/#quote_usd_to_ngn/#convert_*`
- UI: `frontend/bit-bridge-frontend/src/pages/dashboard/account.jsx` (conversion breakdown lines).

## D. Transfers (Anchor rail)

- Fee tiers: see `Pricing::Engine.transfer_fee_ngn`.
- Stamp duty: NGN 50 for amount >= 10,000 (included in fee breakdown).
- Total debit = amount + total_fee.
- Ledger: two pending withdrawals (principal + fee), same transfer_reference, then status update + reversal on failure.
- Code: `backend/bit-bridge-backend/app/services/transfers/anchor_ngn_transfer_service.rb`.
- UI: `frontend/bit-bridge-frontend/src/pages/dashboard/profile/FeesLimitsPanel.jsx` shows fee tiers + stamp duty note.

## E. Bills / Utilities

- Service charge: NGN 100 for non-VTU/DATA; 0 for VTU/DATA. Included in total_amount.
- Commission: 1% of amount for non-electricity; credited to wallet commission on successful bill. If use_commission is true, wallet commission reduces amount.
- Code: `backend/bit-bridge-backend/app/models/bill_order.rb#calc_service_charge`, `#commission`, `#save_commission`.
- UI: Bill order details and purchase flow show commission and totals.

## F. Missing/Conflicting Logic (important)

- Card creation fee is hard-coded in both backend and frontend (USD 4). It is NOT exposed via `/api/v1/fees` or FxSetting; risk of drift if changed.
  - Backend: `backend/bit-bridge-backend/app/services/bridge_card_service.rb#CARD_CREATION_FEE_USD`
  - Frontend: `frontend/bit-bridge-frontend/src/components/cardView/CardView.jsx`
- Bills service charge and commission percentages are hard-coded (100 NGN, 1%). No centralized config.
  - `backend/bit-bridge-backend/app/models/bill_order.rb`, `backend/bit-bridge-backend/app/controllers/api/v1/fees_controller.rb`
- Card monthly maintenance fee is configured in FxSetting, but UI exposure is only via Fees panel (no dedicated card UX).
- Some legacy card create flows (non-USD wallet_type) avoid wallet debits, which can cause fee inconsistencies. See `BridgeCardService#create_card` comment.

## G. Recommended Cleanup (non-breaking)

1) Centralize card creation fee in FxSetting and serve it via `/api/v1/fees` to remove frontend/backend duplication.
2) Introduce a shared fee breakdown schema (principal, platform_fee, provider_fee, fx_markup, total) for all fee-bearing flows.
3) Move bill service charge + commission values into configurable settings to avoid hard-coded business rules.
4) Ensure card maintenance fees are surfaced in user transaction history with clear labels.
5) Provide a single internal pricing spec endpoint (already exists) as an authoritative reference and keep it up to date.

## Code References (selected)
- Tunnel pricing: `backend/bit-bridge-backend/app/services/fx_desk/pricing.rb`, `backend/bit-bridge-backend/app/services/fx_desk/money.rb`
- Fx quotes + convert: `backend/bit-bridge-backend/app/controllers/api/v1/wallets_controller.rb`
- Anchor transfer fees: `backend/bit-bridge-backend/app/services/pricing/engine.rb`, `backend/bit-bridge-backend/app/services/transfers/anchor_ngn_transfer_service.rb`
- Card spend pricing: `backend/bit-bridge-backend/app/services/pricing/card_pricing.rb`, `backend/bit-bridge-backend/app/services/cards/ledger/post_card_settlement.rb`
- Card funding/unload fees: `backend/bit-bridge-backend/app/services/pricing/card_fee_policy.rb`, `backend/bit-bridge-backend/app/services/bridge_card_service.rb`, `backend/bit-bridge-backend/app/services/cards/unload_fee_applier.rb`
- Bills: `backend/bit-bridge-backend/app/models/bill_order.rb`, `backend/bit-bridge-backend/app/services/buy_power_payment_service.rb`
- Fees endpoint: `backend/bit-bridge-backend/app/controllers/api/v1/fees_controller.rb`
- UI references: `frontend/bit-bridge-frontend/src/pages/dashboard/account.jsx`, `frontend/bit-bridge-frontend/src/components/cardView/CardView.jsx`, `frontend/bit-bridge-frontend/src/pages/dashboard/profile/FeesLimitsPanel.jsx`, `frontend/bit-bridge-frontend/src/components/confirmationDetails/billOrderDetails.jsx`
