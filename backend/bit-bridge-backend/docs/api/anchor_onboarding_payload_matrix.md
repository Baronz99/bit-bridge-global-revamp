# Anchor Onboarding Payload Matrix

Last updated: 2026-03-03

Source-of-truth provider docs:
- https://docs.getanchor.co/docs/developer-onboarding-to-anchor-api

This matrix defines how BitBridge clients should call backend Anchor onboarding
endpoints, and how backend maps to Anchor provider payloads.

## 1) Read onboarding state

Backend endpoint:
- `GET /api/v1/accounts/anchor_onboarding_state`

Client request payload:
- None

Backend success response (normalized):
- `success: true`
- `data: { account_id?, account_number_masked?, kyc_status? }`
- `flow: { state, next_action }`
- `requirements`
- `capabilities`
- `request_id`
- `meta: { provider: "anchor", request_id, flow, docs }`
- `has_anchor_account`
- `has_deposit_account`

Flow states:
- `not_started`
- `blocked_profile_incomplete`
- `blocked_kyc`
- `blocked_phone_exists`
- `customer_created_no_deposit_account`
- `temporary_provider_failure`
- `provisioned`

## 2) Read anchor account detail

Backend endpoint:
- `GET /api/v1/accounts/get_user_account_detail`

Client request payload:
- None

Backend behavior:
- If no Anchor profile: `200` with `data: null`, `flow.state=not_started`
- If profile exists but no account number: `200` with `data: null`,
  `flow.state=customer_created_no_deposit_account`
- If provisioned: `200` with canonicalized detail payload and
  `flow.state=provisioned`
- Provider temporary failure: normalized error payload with retry hints.

## 3) Create Anchor customer profile

Backend endpoint:
- `POST /api/v1/accounts`

Client request payload:
```json
{
  "account": {
    "vendor": "anchor",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone_number": "+2348012345678",
    "address": "12 Allen Ave",
    "city": "Ikeja",
    "state": "Lagos",
    "postal_code": "100001"
  }
}
```

Notes:
- Backend accepts many aliases via strong params and `AnchorOnboardingMapper`.
- Client should send canonical fields above.
- Tier 2 platform KYC is required for this state-changing call.

Backend -> Anchor provider mapping:
- Anchor endpoint: `POST /api/v1/customers`
- Payload:
  - `data.type = "IndividualCustomer"`
  - `data.attributes.fullName.firstName/lastName`
  - `data.attributes.address.addressLine_1/addressLine_2/city/state/country/postalCode`
  - `data.attributes.email`
  - `data.attributes.phoneNumber`
  - `data.attributes.metadata.my_customerID`

Normalized backend error codes:
- `ANCHOR_ONBOARDING_INCOMPLETE`
- `ANCHOR_PHONE_EXISTS`
- `ANCHOR_CUSTOMER_EXISTS`
- `ANCHOR_ONBOARDING_FAILED`
- `kyc_required`

## 4) Submit Anchor KYC (Tier 2 at provider)

Backend endpoint:
- `POST /api/v1/accounts/verify_kyc`

Client request payload:
```json
{
  "account": {
    "bvn": "12345678901",
    "dob": "1994-01-31",
    "gender": "male"
  }
}
```

Backend -> Anchor provider mapping:
- Anchor endpoint: `POST /api/v1/customers/{customerId}/verification/individual`
- Payload:
  - `data.type = "Verification"`
  - `data.attributes.level = "TIER_2"`
  - `data.attributes.level2 = { bvn, dateOfBirth, gender }`

Backend persistence:
- `accounts.status` transitions to `verifying`, then `completed` on success path
  or when already-verified message is detected.

Normalized backend error codes:
- `anchor_account_missing`
- `anchor_kyc_incomplete`
- `anchor_kyc_already_verified`
- `anchor_kyc_verification_failed`
- `provider_unavailable`
- `kyc_required`

## 5) Provision account number

Preferred backend endpoint:
- `POST /api/v1/accounts/provision_account_number`

Legacy compatibility endpoint:
- `GET /api/v1/accounts/get_account_number`

Client request payload:
- None required

Backend -> Anchor provider mapping:
- Anchor endpoint: `POST /api/v1/accounts`
- Payload:
  - `data.type = "DepositAccount"`
  - `data.attributes.productName = "SAVINGS"`
  - `data.relationships.customer.data = { id, type: "IndividualCustomer" }`

Post-create reconciliation:
- `GET /api/v1/account-numbers?AccountId={depositAccountId}`
- Fallback account sync and canonicalization before returning response.

Normalized backend outcomes:
- `200` created/provisioned
- `202` accepted with:
  - `provisioning_pending: true`
  - `retryable: true`
  - `retry_after_seconds`
- `422/404` normalized error payloads

Normalized backend error codes:
- `anchor_account_missing`
- `anchor_kyc_incomplete`
- `anchor_phone_already_exists`
- `provider_unavailable`
- `anchor_account_number_failed`
- `kyc_required`

## 5b) One-call orchestrator (recommended client entrypoint)

Backend endpoint:
- `POST /api/v1/accounts/setup_anchor_onboarding`

Client request payload (minimal):
```json
{
  "account": {
    "vendor": "anchor"
  }
}
```

Optional fields:
- If provided, backend can use `bvn`, `dob`, `gender`, and profile aliases for
  missing data fallback.

Execution order:
1. Ensure Anchor customer exists.
2. Ensure Anchor KYC is completed/submitted.
3. Ensure deposit account number is provisioned.

Possible outcomes:
- `200`: account provisioned
- `202`: provisioning in progress
- `422/409/403`: normalized onboarding/kyc/provider or eligibility blocker

Response envelope:
- Same canonical success/error envelopes described in sections 6 and 7.

## 6) Canonical response envelope (success)

```json
{
  "success": true,
  "data": {},
  "message": "Human-readable success message",
  "flow": {
    "state": "customer_created_no_deposit_account",
    "next_action": "provision_account_number"
  },
  "requirements": {},
  "capabilities": {},
  "request_id": "request-id",
  "meta": {
    "provider": "anchor",
    "request_id": "request-id",
    "flow": {
      "state": "customer_created_no_deposit_account",
      "next_action": "provision_account_number"
    },
    "docs": "https://docs.getanchor.co/docs/developer-onboarding-to-anchor-api"
  }
}
```

## 7) Canonical response envelope (error)

```json
{
  "success": false,
  "error": "anchor_kyc_incomplete",
  "error_code": "anchor_kyc_incomplete",
  "message": "Human-readable error message",
  "details": {},
  "errors": ["Human-readable error message"],
  "retryable": false,
  "flow": {
    "state": "blocked_kyc",
    "next_action": "complete_kyc"
  },
  "requirements": {},
  "capabilities": {},
  "request_id": "request-id",
  "meta": {
    "provider": "anchor",
    "request_id": "request-id",
    "retryable": false,
    "flow": {
      "state": "blocked_kyc",
      "next_action": "complete_kyc"
    },
    "docs": "https://docs.getanchor.co/docs/developer-onboarding-to-anchor-api"
  }
}
```

## 8) Client orchestration rules

1. Use `flow.state` as the primary state machine.
2. Use `capabilities` to enable/disable actions.
3. Use `error_code` for branching logic, not free-form `message`.
4. Respect `retryable` and `retry_after_seconds` when provided.
5. Treat `GET /get_account_number` as legacy fallback only.
