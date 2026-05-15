# Inventory Control App

## New updates
- Added optional `manufacturer` on items/medications.
- Added safe delete vs archive behavior:
  - Items/locations can be permanently deleted only when unused (no transactions, monthly counts, or par levels).
  - If history exists, UI shows archive guidance and uses **Archive** labels.
  - Transactions are append-only and are never deleted or edited in frontend.
  - User management uses **Deactivate User / Reactivate User** only.
- Navigation simplified to `Dashboard`, `Inventory`, `Admin`, `Reports`.
- Dashboard rebuilt with KPI cards and below-par watchlist.

## Supabase SQL migration
Run:
- `database/add_manufacturer_and_safe_delete.sql`

This migration adds manufacturer, performance indexes, and safe-delete RPCs:
- `delete_item_if_unused(item_id uuid)`
- `delete_location_if_unused(location_id uuid)`

## Auth deletion note
True Supabase Auth user deletion is **not** done from frontend. Use Supabase Dashboard or a secure backend function with service role credentials.

## Compliance
Do not store PHI in this app.
