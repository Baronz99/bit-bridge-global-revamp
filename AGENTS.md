# Project Memory (Codex)

This file is the shared, durable context for Codex sessions on this repo.
Keep it short and current to prevent regressions.

## Current Focus
- Align admin quick actions with public dashboard services.
- Simplify admin add product flow (product + provision in one step).

## Constraints / Do-Not-Break
- Product must be created before provision; provision requires product_id.
- Admin/dashboard quick actions must link to valid routes.

## Recent Decisions
- Combined product + provision creation in the admin Add Product form.
- Added quick actions on the admin dashboard and service launcher buttons on the user dashboard.

## In-Progress Changes
- Reviewing add product UX and service propagation to the public dashboard.

## Known Risks
- Provision creation without product_id or invalid min/max ranges.
- Category/service_type mismatches can hide or mislabel services.
- Quick action links can drift from route changes.

## Next Steps
- Tighten Add Product validation and error handling.
- Decide whether dashboard services should be data-driven from products.

## Tests / Verification
- Manual: create product + provision, then verify dashboard links and service tiles.
