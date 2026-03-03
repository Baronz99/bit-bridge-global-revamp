# Anchor Onboarding Source Of Truth

Last updated: 2026-03-03

This repository now uses the official Anchor documentation as the single source of truth for onboarding and provisioning flows.

## Official Reference

- Primary onboarding guide:
  - https://docs.getanchor.co/docs/developer-onboarding-to-anchor-api

## Required Flow References

- Create Individual Customer:
  - https://docs.getanchor.co/docs/create-individual-customer-1
- Individual Customer KYC:
  - https://docs.getanchor.co/docs/individual-customer-kyc
- Create Deposit Account:
  - https://docs.getanchor.co/docs/creating-deposit-account-resource
- Account Numbers:
  - https://docs.getanchor.co/docs/account-numbers
- Verify Webhooks:
  - https://docs.getanchor.co/docs/verify-webhooks

## Local Contract Matrix

- Backend/client mapping for BitBridge:
  - `docs/api/anchor_onboarding_payload_matrix.md`

## Local Backend Mapping (BitBridge)

BitBridge API endpoints that orchestrate Anchor onboarding:

- `POST /api/v1/accounts` (Anchor customer creation when `account.vendor=anchor`)
- `POST /api/v1/accounts/verify_kyc`
- `POST /api/v1/accounts/provision_account_number`
- `GET /api/v1/accounts/get_account_number` (legacy compatibility)
- `GET /api/v1/accounts/get_user_account_detail`
- `GET /api/v1/accounts/anchor_onboarding_state`

Implementation entry points:

- `app/controllers/api/v1/accounts_controller.rb`
- `app/services/anchor_service.rb`
- `app/services/anchor_onboarding_mapper.rb`

## Deprecation Notice

The previous local, example-heavy onboarding contract content in this file is deprecated.
Use the official Anchor docs above for payload definitions and provider behavior.
