# Shipping Fix Report

## Changes
- Replaced shipment action icons with Truck icons.
- Added clearer Create Shipment and Refresh error messages.
- Added Manual Shipment fallback in Order Detail.
- Added `manual-shipment` action to `studio-shipping`.

## Expected Behavior
- If ShipBlu is missing API secrets, the admin sees a setup-specific error.
- If tracking refresh is clicked before a shipment exists, the admin sees a clear explanation.
- If ShipBlu is not ready, admin can save a manual courier and tracking number.
