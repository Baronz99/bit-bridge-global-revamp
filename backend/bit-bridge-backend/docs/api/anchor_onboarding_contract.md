# Anchor Onboarding And Provisioning Contract

Last updated: 2026-02-09

This document defines the backend contract used by mobile clients for Anchor onboarding and account number provisioning.

## Purpose

- Keep client flow deterministic with explicit `flow.state` and `flow.next_action`.
- Provide stable machine-readable error keys via `error_code`.
- Preserve backward compatibility while migrating provisioning from `GET` to `POST`.

## Endpoints

### 1) Get Anchor Account Detail

- `GET /api/v1/accounts/get_user_account_detail`

#### Success: no Anchor customer yet

Status: `200`

```json
{
  "data": null,
  "message": "No Anchor account yet",
  "has_anchor_account": false,
  "flow": {
    "state": "not_started",
    "next_action": "create_anchor_account"
  }
}
```

#### Success: Anchor customer exists, no deposit account yet

Status: `200`

```json
{
  "data": null,
  "message": "No deposit account yet",
  "has_anchor_account": true,
  "flow": {
    "state": "customer_created_no_deposit_account",
    "next_action": "provision_account_number"
  }
}
```

#### Success: deposit account provisioned

Status: `200`

```json
{
  "data": {
    "id": "anchor_account_id",
    "type": "DepositAccount",
    "attributes": {
      "accountNumber": "*****0840",
      "accountName": "John Doe",
      "status": "ACTIVE"
    }
  },
  "message": "Account Numbers fetched",
  "messsage": "Account Numbers fetched",
  "has_anchor_account": true,
  "flow": {
    "state": "provisioned",
    "next_action": "none"
  }
}
```

Notes:

- `messsage` (triple-s typo) is retained for backward compatibility.
- Clients should rely on `message`.

### 2) Create Anchor Customer

- `POST /api/v1/accounts`
- Body:

```json
{
  "account": {
    "vendor": "anchor"
  }
}
```

#### Success

Status: `200`

```json
{
  "data": {},
  "message": "User onboarded successfully",
  "flow": {
    "state": "customer_created_no_deposit_account",
    "next_action": "provision_account_number"
  }
}
```

#### Profile incomplete

Status: `422`

```json
{
  "message": "Complete your profile to create an Anchor account.",
  "error_code": "ANCHOR_ONBOARDING_INCOMPLETE",
  "missing_fields": [
    "address.addressLine_1",
    "bvn"
  ],
  "flow": {
    "state": "blocked_profile_incomplete",
    "next_action": "complete_profile"
  }
}
```

#### Duplicate phone

Status: `409`

```json
{
  "message": "This phone number already exists in Anchor Sandbox.",
  "error_code": "ANCHOR_PHONE_EXISTS",
  "flow": {
    "state": "blocked_phone_exists",
    "next_action": "contact_support_or_retry_detail_fetch"
  }
}
```

#### Generic create failure

Status: `422`

```json
{
  "message": "Unable to create Anchor account.",
  "error_code": "ANCHOR_ONBOARDING_FAILED",
  "flow": {
    "state": "temporary_provider_failure",
    "next_action": "retry_create_anchor_account"
  }
}
```

### 3) Provision Deposit Account Number

Preferred:

- `POST /api/v1/accounts/provision_account_number`

Legacy (still supported):

- `GET /api/v1/accounts/get_account_number`

#### Success

Status: `200`

```json
{
  "data": {},
  "message": "Account created",
  "messsage": "Account created",
  "flow": {
    "state": "provisioned",
    "next_action": "none"
  }
}
```

#### Failure payload format

Status: usually `422` or `404`

```json
{
  "error": "provider_unavailable",
  "error_code": "provider_unavailable",
  "errors": [
    "503 Service unavailable"
  ],
  "meta": {
    "provider": "anchor",
    "request_id": "request-id",
    "retryable": true,
    "flow": {
      "state": "temporary_provider_failure",
      "next_action": "retry_provision"
    }
  }
}
```

### 4) KYC Guard Error (applies to state-changing Anchor flows)

Status: `403`

```json
{
  "error": "kyc_required",
  "required_level": "tier_2",
  "message": "Please complete Tier 2 verification before generating or using an Anchor virtual account.",
  "flow": {
    "state": "blocked_kyc",
    "next_action": "complete_kyc"
  }
}
```

## Canonical Flow States

- `not_started`
- `blocked_profile_incomplete`
- `blocked_kyc`
- `blocked_phone_exists`
- `customer_created_no_deposit_account`
- `temporary_provider_failure`
- `provisioned`

## Mobile Orchestration Rules

1. Prefer `POST /api/v1/accounts/provision_account_number` for provisioning.
2. Treat `flow.state` as the main UI state driver.
3. Use `error_code` for branching logic, not free-form `message`.
4. If `meta.retryable=true`, run client retries with backoff.
5. Do not gate by `onboarding_stage` alone.

## Backward Compatibility Notes

- `GET /api/v1/accounts/get_account_number` remains active.
- `messsage` typo keys remain present in some responses until clients fully migrate to `message`.
