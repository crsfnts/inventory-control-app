# Inventory Control App

## Phase 1 UI Redesign (React + Vite + Supabase + Netlify)

This release introduces a NOHN-inspired healthcare-professional app shell while keeping existing inventory logic and Supabase role behavior intact.

### Navigation structure
- Sidebar now uses grouped primary navigation:
  - Dashboard
  - Inventory
  - Admin
  - Reports
- Inventory opens a cleaner Inventory Actions workspace for:
  - Add Stock
  - Remove Stock
  - Transfer
  - Monthly Count
- Admin opens an Admin workspace for:
  - Users
  - Items / Medications
  - Locations
  - Par Levels
  - Opening Inventory / Adjustments
- Reports includes history/export-oriented workflow.

### Role-based visibility
- Admin users see: Dashboard, Inventory, Admin, Reports.
- Staff users see: Dashboard, Inventory, Reports.
- Staff users do **not** see Admin navigation/tools.
- Sidebar includes visible role indicator:
  - `Admin view`
  - `Staff view`

### Theme and branding
- NOHN-inspired palette and styling:
  - Deep navy sidebar
  - Teal/aqua accents
  - White cards
  - Soft blue-gray background
  - Rounded corners and subtle shadows
- Existing Inventory Control branding is retained and visually polished.

### User identity visuals
- User profile photos are intentionally **not used**.
- Header uses email and initials badge only.

### Compliance and data safety
- Do not store PHI in this app.
- No patient names, DOB, MRN, RX numbers, or addresses.
- Transactions remain append-only and balances remain transaction-derived.

## Existing updates retained
- Added optional `manufacturer` on items/medications.
- Added safe delete vs archive behavior:
  - Items/locations can be permanently deleted only when unused (no transactions, monthly counts, or par levels).
  - If history exists, UI shows archive guidance and uses **Archive** labels.
  - Transactions are append-only and are never deleted or edited in frontend.
  - User management uses **Deactivate User / Reactivate User** only.

## Supabase SQL migration
Run:
- `database/add_manufacturer_and_safe_delete.sql`

This migration adds manufacturer, performance indexes, and safe-delete RPCs:
- `delete_item_if_unused(item_id uuid)`
- `delete_location_if_unused(location_id uuid)`

## Auth deletion note
True Supabase Auth user deletion is **not** done from frontend. Use Supabase Dashboard or a secure backend function with service role credentials.

## Auth behavior
- Signed-out users are shown a branded login screen (no raw text fallback).
- Sign out clears app state and returns users to the login screen.
- Auth state changes (sign in/sign out/session changes) are handled in one listener flow.

## Refresh behavior
- Topbar **Refresh** now triggers a real Supabase reload for app data.
- Refresh button is disabled while loading and shows a spinner animation.
- Dashboard, Inventory, Admin, and Reports data all update from the same refresh path.

## UI polish updates
- Added subtle hover lift for primary/ghost buttons.
- Added sidebar nav hover motion and KPI/action card hover feedback.
- Added loading/spin animation for refresh and save actions.
- Added polished branded login screen styling.

## Netlify compatibility
- Build/deploy workflow remains Vite + Netlify compatible.
- No service-role keys are added to frontend code.
