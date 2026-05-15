# Inventory Control App

A React + Vite + Supabase + Netlify starter app for guided inventory tracking.

## What this app does

- Login/signup with Supabase Auth
- Add stock
- Remove stock with negative-balance prevention
- Transfer stock between locations
- Monthly physical count with automatic adjustment transaction
- Set par and target levels
- Dashboard for below-par/reorder alerts
- Protected transaction history with CSV export

## Important safety note

This app is designed for inventory only. Do not enter PHI:

- No patient names
- No DOBs
- No MRNs
- No prescription numbers
- No addresses
- No patient identifiers in notes

## Supabase setup

1. Go to your Supabase project.
2. Open **SQL Editor**.
3. Create a new query.
4. Paste the contents of `database/setup.sql`.
5. Click **Run**.

The setup script creates:

- `items`
- `locations`
- `par_levels`
- `transactions`
- `monthly_counts`

It also enables Row Level Security and creates starter policies for logged-in users.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Your `.env.local` should contain:

```env
VITE_SUPABASE_URL=https://unobwuopiwpxyhmhfpls.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_or_anon_key
```

## Netlify setup

1. Push this folder to GitHub.
2. Create a new Netlify site from that GitHub repo.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variables in Netlify:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Deploy.

## First test workflow

1. Sign up or sign in.
2. Go to **Setup / Par**.
3. Add any missing items and locations.
4. Set par and target levels.
5. Use **Add Stock** to create opening balances.
6. Test **Remove Stock**.
7. Test **Transfer**.
8. Test **Monthly Count**.
9. Check the dashboard.

## Production hardening ideas

The included RLS policies are intentionally beginner-friendly. Later, make them stricter:

- Add roles: admin, staff, manager
- Only admins can edit setup tables
- Staff can insert transactions but not edit items/par levels
- Managers can view dashboards/history
- Add organization/team ID if multiple departments use the app
- Add Netlify password protection or identity rules if needed
