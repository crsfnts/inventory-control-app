# Inventory Control App

## UI Update Summary (React + Vite + Supabase + Netlify)

This release redesigns Login, Inventory, and Admin into a compact NOHN-style workspace while preserving Supabase Auth, role protections, RLS assumptions, and transaction-based inventory balance logic.

## Login behavior
- Sign In remains the primary full-width CTA.
- Sign Up / Sign In toggle is now a matching full-width secondary button.
- Both auth buttons share height, radius, and hover animation.
- Auth remains centered and photo-free.

## Admin View / User View preview mode
- Admin users now get a sidebar segmented toggle:
  - User view
  - Admin view
- Default is **Admin view**.
- **User view** hides Admin navigation/tools for UI preview only.
- This does not change database role, Supabase permissions, or RLS behavior.
- Staff users do not see the toggle; they only see a Staff view badge.

## Inventory workspace
- Inventory now uses action tabs:
  - Add Stock
  - Remove Stock
  - Transfer
  - Monthly Count
- Only one workflow form is visible at a time (reduced page length).
- A Recent Inventory Activity table appears below with search and action badges.

## Admin workspace
- Admin now uses tool tabs:
  - Users
  - Items / Medications
  - Locations
  - Par Levels
  - Opening Inventory / Adjustments
- Only one admin tool is visible at a time.
- Each tool follows a compact form-on-top + table-below structure.

## Compliance and data safety
- Do not store PHI in this app.
- Never add patient name, DOB, MRN, RX number, address, or other patient-identifying fields.
- Transactions remain append-only and balances remain transaction-derived.
- No service-role keys are exposed in frontend code.

## Existing logic preserved
- Supabase sign in/sign up/sign out flow.
- Role-based access for admin/staff.
- Inventory actions: add, remove, transfer, monthly count.
- Item/location archive and safe-delete behavior via RPC.
- Par level create/update and reporting history views.
- Netlify-compatible Vite build output.
