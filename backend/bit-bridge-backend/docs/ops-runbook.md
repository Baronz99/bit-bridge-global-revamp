# Ops Runbook

## Purpose
Actionable response guide for transaction integrity, reconciliation health, and provider reliability in production.

## Monitoring Window
- Default analysis window: `24h`
- Fast triage window: `15m` and `30m`

## SLO Targets And Red Flags

| Signal | SLO Target | Red Flag Threshold |
|---|---|---|
| Unmatched credits | `pending = 0` beyond 30 minutes | Any `pending > 0` older than 30m |
| Bill order stuck queue | Keep stuck backlog low and clearing | `initialized/pending/processing` older than 30m exceeds `5` total |
| Webhook processing | Near-real-time processing | Any `unprocessed > 0` persisting for 15m |
| Disputes | Stable open dispute rate | Open disputes spike materially above normal daily baseline |
| Transaction record quality | Fail/unknown states remain low and explainable | Sudden spike in `failed_last_24h` or `unknown_status_last_24h` |

## Core Commands
Run from backend app root.

```bash
bin/rails ops:integrity_summary
bin/rails service_availability:refresh
```

Heroku production examples:

```bash
heroku run "bin/rails ops:integrity_summary" -a bitbridgeglobal
heroku run "bin/rails service_availability:refresh" -a bitbridgeglobal
```

## Red Flag Playbooks

### 1) Unmatched Credits Pending > 0 for 30m
- Check latest summary output for `unmatched_credits.age_buckets.older_than_30m`.
- Correlate with webhook lag and provider availability in same summary.
- Run:
  - `bin/rails ops:integrity_summary`
  - `bin/rails service_availability:refresh`
- Investigate candidate causes:
  - missing/late provider callbacks
  - reference mismatch preventing auto-match
  - background queue delays
- Customer impact:
  - user funded but balance/service not updated yet.
- Pause criteria:
  - pause affected provider checkout if backlog is increasing and not clearing after refresh/queue recovery.

### 2) Bill Orders Stuck > 5 Older Than 30m
- Review `bill_orders.stuck_counts.*.older_than_30m`.
- Identify whether concentration is provider-specific or global.
- Run:
  - `bin/rails ops:integrity_summary`
  - `bin/rails service_availability:refresh`
- Validate provider reliability for impacted service keys before new retries.
- Customer impact:
  - delayed vend/token/data activation, repeated user retries.
- Pause criteria:
  - pause checkout for provider/service when stuck queue rises and provider state is degraded/outage.

### 3) Webhook Unprocessed > 0 for 15m
- Review `webhooks.providers.*.unprocessed_current` and recent failure counters.
- Check if issue is isolated by provider (`anchor`, `buypower`, etc.).
- Run:
  - `bin/rails ops:integrity_summary`
- Confirm worker health and queue throughput.
- Customer impact:
  - payments may succeed at provider but internal state remains pending.
- Pause criteria:
  - pause new checkout on affected provider if unprocessed keeps growing for >15m.

### 4) Disputes Open Spike Above Baseline
- Compare `disputes.open_count` to prior daily average.
- Segment by service/provider and incident start time.
- Run:
  - `bin/rails ops:integrity_summary`
- Customer impact:
  - refund pressure, trust/reputation risk, support load increase.
- Pause criteria:
  - pause only if dispute spike ties to current active provider failures.

### 5) TransactionRecords Failed/Unknown Spikes
- Review `transfers_banking.transaction_records.failed_last_24h` and `unknown_status_last_24h`.
- Check if unknown statuses map to new/unhandled provider status strings.
- Run:
  - `bin/rails ops:integrity_summary`
  - `bin/rails service_availability:refresh`
- Customer impact:
  - ambiguous completion state, delayed confirmations/refunds.
- Pause criteria:
  - pause provider checkout if unknown/failure trend is active and user-visible failures are rising.

## When To Pause Checkout For A Provider
Pause checkout for a provider/service when all are true:
- Reliability shows degraded/outage or failures are rising in real time.
- Stuck or unprocessed queues are increasing for >=15-30 minutes.
- Customer-facing failures/timeouts are confirmed by support/monitoring.

Resume when:
- Reliability normalizes.
- Backlog clears to safe baseline.
- 2 consecutive summary checks (15 minutes apart) show recovery.

## Escalation Path
- Engineering (primary):
  - investigate queues, webhook handling, reconciliation logic, provider toggles.
- Compliance/Risk:
  - review dispute/refund exposure, reporting requirements, regulator-facing timelines.
- Support/Operations:
  - send customer comms, track affected orders, provide ETA updates and refund guidance.

Escalate immediately to all three groups if:
- payment accepted but service not delivered at scale,
- unresolved unmatched credits exceed 30 minutes,
- dispute spike indicates systemic incident.
