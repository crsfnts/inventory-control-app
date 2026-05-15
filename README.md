# Inventory Control App

React + Vite + Supabase + Netlify inventory application with audit-safe transactions and role-based access control (RBAC).

## RBAC overview

The app now has two roles stored in `public.profiles.role`:

- **admin**
  - Can create/edit/deactivate items.
  - Can create/edit/deactivate locations.
  - Can create/edit par and target levels.
  - Can perform opening balance and correction actions only by writing transactions (`OPENING_BALANCE`, `ADMIN_ADJUSTMENT`).
  - Can do all staff workflows.
- **staff**
  - Can view active items/locations.
  - Can use Add, Remove, Transfer, Monthly Count, Dashboard, History, and Export.
  - Cannot edit setup tables or directly edit balances.
  - Cannot delete transactions.

The frontend hides admin setup UI for staff and shows **Admin view** / **Staff view** labels. Supabase RLS also enforces these permissions server-side.

## Important safety note (No PHI)

This app is for inventory workflows only. **Do not store PHI** (patient names, DOB, MRN, Rx numbers, addresses, or any patient identifiers).

## Supabase SQL steps (manual)

Run both scripts in Supabase SQL Editor:

1. `database/setup.sql` (base schema)
2. `database/add_roles_and_admin_policies.sql` (RBAC migration)

### How to run

1. Open Supabase project → **SQL Editor**.
2. Paste and run `database/setup.sql` if this is a fresh install.
3. Paste and run `database/add_roles_and_admin_policies.sql`.
4. Verify `public.profiles` contains your users and role assignments.

## Make `cfuentes@nohn-pa.org` admin

The migration does this in two ways:

- Backfills existing `auth.users` into `public.profiles` and sets `cfuentes@nohn-pa.org` to role `admin`.
- Adds a trigger so future signups auto-create a profile; this specific email is assigned `admin`.

If needed, you can manually enforce it with:

```sql
update public.profiles
set role = 'admin'
where lower(email) = 'cfuentes@nohn-pa.org';
```

## Data integrity rules

- No direct balance field is edited.
- Balances are calculated from transactions.
- Opening inventory uses `OPENING_BALANCE` transaction.
- Admin corrections use `ADMIN_ADJUSTMENT` transaction with required reason.
- Transfers remain two transactions (`TRANSFER_OUT` + `TRANSFER_IN`).
- Remove/Transfer prevent negative balance in app workflow.
- Transaction deletes are blocked from client by RLS (no delete policy).

## Environment variables

Keep these variables unchanged:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Local setup

```bash
npm install
npm run dev
```

Example `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

## Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Add env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
