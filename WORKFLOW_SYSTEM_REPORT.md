# Workflow System Report

## Admin Capabilities
- Add or rename order statuses.
- Hide statuses without deleting old order history.
- Reorder statuses.
- Mark statuses as final.
- Add or rename follow-up types.
- Hide follow-up types.
- Decide which follow-up types appear as quick action chips.

## Database
New tables:
- `order_statuses`
- `followup_types`

Legacy follow-up keys are normalized by migration 0022.

## UI
- New `/nexora-admin/workflow` page.
- Order Detail uses workflow settings in status buttons and follow-up controls.
