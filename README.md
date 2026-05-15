# Inventory Control App

React + Vite + Supabase inventory app with append-only transaction history and role-based access control.

## Fix current admin/profile issue

1. Open Supabase **SQL Editor**.
2. Run `database/setup.sql` (if your base schema is not installed yet).
3. Run `database/fix_admin_profiles_and_roles.sql`.
4. Sign out of the app and sign back in.
5. Confirm the sidebar shows **Admin view**.

## Seeded admin emails

If these users exist in `auth.users`, they are forced to `admin` in `public.profiles`:

- `cfuentes@nohn-pa.org`
- `crsfnts@gmail.com`

All other users default to `staff`.

## Permissions summary

### Admin permissions
- Manage users in-app via `profiles` (role changes, deactivate/reactivate).
- Manage items (add/edit/deactivate).
- Manage locations (add/edit/deactivate).
- Manage par/target levels.
- Create opening balance and admin adjustment transactions.
- All staff permissions.

### Staff permissions
- Add stock, remove stock, transfer stock.
- Complete monthly counts.
- View dashboard/history and export data.

Staff cannot manage users/items/locations/par levels, cannot make opening/admin adjustments, and cannot delete/update transactions.

## User deletion note

This app uses frontend `anon` credentials only (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

Because of that, true Supabase Auth user deletion is **not** done in frontend code. In-app user lifecycle is deactivate/reactivate via `profiles.active`. True auth-user deletion must be done in Supabase Dashboard or a secure server-side function using service role credentials.

## Security and compliance

- Do **not** expose service-role keys in frontend or Netlify env vars.
- Keep using only:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Do **not** store PHI (no patient name, DOB, MRN, RX number, address, etc.).
- Keep transactions append-only.
- Keep balances derived from transaction history.
