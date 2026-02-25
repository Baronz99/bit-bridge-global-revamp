# Ops Summary Contract

Endpoint: `GET /api/v1/admin/ops/summary`

Purpose: provide a single admin/ops snapshot for reconciliation health, provider reliability, and operational risk indicators.

Authentication/Authorization:
- Requires authenticated admin user.
- Recommended to restrict to super admin (same as existing `admin/ops/health` pattern).

## Response Shape

Top-level object:

- `generated_at` (`string`, ISO8601, required)
- `window_hours` (`integer`, required)
- `provider_availability` (`object`, required)
- `unmatched_credits` (`object`, required)
- `bill_orders` (`object`, required)
- `webhooks` (`object`, required)
- `disputes` (`object`, required)
- `transfers_banking` (`object`, required)

## 1) provider_availability

Snapshot of current provider service reliability.

- `global_state` (`string`, required)
  Allowed: `healthy`, `degraded`, `outage`, `unknown`
- `message` (`string`, optional)
- `services` (`array<object>`, required)
  Each item:
  - `provider` (`string`, required) e.g. `buypower`
  - `service_key` (`string`, required) e.g. `ABUJA_ELECTRICITY`
  - `state` (`string`, required) `available|unstable|down|unknown`
  - `reliability_percent` (`integer`, required, 0..100)
  - `sample_size` (`integer`, required)
  - `avg_latency_ms` (`integer|null`, optional)
  - `window_started_at` (`string`, ISO8601, required)
  - `window_ended_at` (`string`, ISO8601, required)
- `summary` (`object`, required)
  - `total_services` (`integer`, required)
  - `available` (`integer`, required)
  - `unstable` (`integer`, required)
  - `down` (`integer`, required)
  - `unknown` (`integer`, required)

## 2) unmatched_credits

Operational visibility into inbound credits not yet fully resolved.

- `totals_by_status` (`object`, required)
  - `pending` (`integer`, required)
  - `resolved` (`integer`, required)
  - `ignored` (`integer`, required)
  - `total` (`integer`, required)
- `age_buckets` (`object`, required)
  - `older_than_30m` (`integer`, required)
  - `older_than_6h` (`integer`, required)
  - `older_than_24h` (`integer`, required)
- `pending_amount` (`object`, optional but recommended)
  - `currency` (`string`, required when present, e.g. `NGN`)
  - `value` (`number`, required when present)

Notes:
- Age buckets are expected to count unresolved records (`pending`) by `created_at`.

## 3) bill_orders

Stuck/at-risk bill order visibility for early intervention.

- `stuck_counts` (`object`, required)
  - `initialized` (`object`, required)
  - `pending` (`object`, required)
  - `processing` (`object`, required)

For each status object:
- `older_than_15m` (`integer`, required)
- `older_than_30m` (`integer`, required)
- `older_than_2h` (`integer`, required)

- `totals` (`object`, optional but recommended)
  - `initialized` (`integer`)
  - `pending` (`integer`)
  - `processing` (`integer`)
  - `timedout` (`integer`)
  - `failed` (`integer`)

## 4) webhooks

Provider webhook ingress/processing health.

- `window_hours` (`integer`, required, typically `24`)
- `providers` (`object`, required)
  Keys recommended: `monnify`, `anchor`, `bridgecard`, `buypower`, `termii`

Each provider object:
- `received_last_24h` (`integer`, required)
- `processed_last_24h` (`integer`, required when trackable)
- `failed_last_24h` (`integer`, required when trackable)
- `unprocessed_current` (`integer`, required when trackable)
- `last_received_at` (`string|null`, ISO8601)

- `notes` (`array<string>`, optional)
  Use when some providers do not persist explicit processing states in a dedicated table.

## 5) disputes

Open dispute load and aging.

- `open_count` (`integer`, required)
- `oldest_open_age_hours` (`number|null`, required)
- `status_counts` (`object`, optional but recommended)
  - `open` (`integer`)
  - `resolved` (`integer`)
  - `rejected` (`integer`)

## 6) transfers_banking

Transfer reconciliation indicators from available models.

- `anchor_pending_withdrawals` (`object`, required)
  - `count` (`integer`, required)
  - `oldest_pending_at` (`string|null`, ISO8601)
  - `oldest_pending_age_hours` (`number|null`)
- `transaction_records` (`object`, required)
  - `pending_count` (`integer`, required)
  - `failed_count` (`integer`, required)
  - `last_24h_count` (`integer`, required)
- `reconcile_signals` (`object`, optional)
  - `unmatched_anchor_inbound_count` (`integer`)
  - `stale_processing_bill_orders_count` (`integer`)

Notes:
- This section should use currently available data (`transactions`, `transaction_records`, `inbound_bank_transfers`, `bill_orders`) without inventing new persistence.

## Example Response

```json
{
  "generated_at": "2026-02-25T16:10:44Z",
  "window_hours": 24,
  "provider_availability": {
    "global_state": "degraded",
    "message": "Some services are experiencing elevated failures or latency.",
    "services": [
      {
        "provider": "buypower",
        "service_key": "MTN_DATA",
        "state": "available",
        "reliability_percent": 98,
        "sample_size": 10,
        "avg_latency_ms": 3100,
        "window_started_at": "2026-02-25T15:40:44Z",
        "window_ended_at": "2026-02-25T16:10:44Z"
      },
      {
        "provider": "buypower",
        "service_key": "PH_ELECTRICITY",
        "state": "unstable",
        "reliability_percent": 72,
        "sample_size": 10,
        "avg_latency_ms": 5200,
        "window_started_at": "2026-02-25T15:40:44Z",
        "window_ended_at": "2026-02-25T16:10:44Z"
      }
    ],
    "summary": {
      "total_services": 42,
      "available": 37,
      "unstable": 4,
      "down": 1,
      "unknown": 0
    }
  },
  "unmatched_credits": {
    "totals_by_status": {
      "pending": 5,
      "resolved": 21,
      "ignored": 2,
      "total": 28
    },
    "age_buckets": {
      "older_than_30m": 4,
      "older_than_6h": 2,
      "older_than_24h": 1
    },
    "pending_amount": {
      "currency": "NGN",
      "value": 152500.0
    }
  },
  "bill_orders": {
    "stuck_counts": {
      "initialized": {
        "older_than_15m": 3,
        "older_than_30m": 1,
        "older_than_2h": 0
      },
      "pending": {
        "older_than_15m": 9,
        "older_than_30m": 4,
        "older_than_2h": 1
      },
      "processing": {
        "older_than_15m": 6,
        "older_than_30m": 3,
        "older_than_2h": 1
      }
    },
    "totals": {
      "initialized": 12,
      "pending": 33,
      "processing": 18,
      "timedout": 7,
      "failed": 124
    }
  },
  "webhooks": {
    "window_hours": 24,
    "providers": {
      "monnify": {
        "received_last_24h": 143,
        "processed_last_24h": 139,
        "failed_last_24h": 4,
        "unprocessed_current": 2,
        "last_received_at": "2026-02-25T16:08:11Z"
      },
      "anchor": {
        "received_last_24h": 74,
        "processed_last_24h": 72,
        "failed_last_24h": 2,
        "unprocessed_current": 1,
        "last_received_at": "2026-02-25T15:59:03Z"
      },
      "bridgecard": {
        "received_last_24h": 55,
        "processed_last_24h": 52,
        "failed_last_24h": 3,
        "unprocessed_current": 1,
        "last_received_at": "2026-02-25T16:02:47Z"
      },
      "buypower": {
        "received_last_24h": 41,
        "processed_last_24h": 38,
        "failed_last_24h": 3,
        "unprocessed_current": 2,
        "last_received_at": "2026-02-25T15:57:29Z"
      }
    },
    "notes": [
      "Some providers may not persist explicit processing state in a dedicated webhook_events table."
    ]
  },
  "disputes": {
    "open_count": 3,
    "oldest_open_age_hours": 11.6,
    "status_counts": {
      "open": 3,
      "resolved": 17,
      "rejected": 2
    }
  },
  "transfers_banking": {
    "anchor_pending_withdrawals": {
      "count": 2,
      "oldest_pending_at": "2026-02-25T11:35:20Z",
      "oldest_pending_age_hours": 4.6
    },
    "transaction_records": {
      "pending_count": 8,
      "failed_count": 14,
      "last_24h_count": 326
    },
    "reconcile_signals": {
      "unmatched_anchor_inbound_count": 1,
      "stale_processing_bill_orders_count": 4
    }
  }
}
```

## Error Contract (recommended)

For authorization/config errors:

- `403 Forbidden` when non-admin calls endpoint.
- `503 Service Unavailable` only if required dependencies for summary are unavailable.

Example:

```json
{
  "message": "ops summary unavailable",
  "error_code": "OPS_SUMMARY_UNAVAILABLE",
  "retryable": true
}
```
