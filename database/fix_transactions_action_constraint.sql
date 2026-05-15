-- Fix transactions action constraint and align RLS with supported action values.

alter table public.transactions
drop constraint if exists transactions_action_check;

alter table public.transactions
add constraint transactions_action_check
check (
  action in (
    'ADD',
    'REMOVE',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'MONTHLY_COUNT_ADJUSTMENT',
    'OPENING_BALANCE',
    'ADMIN_ADJUSTMENT',
    'CORRECTION'
  )
);

drop policy if exists "Authenticated users can insert transactions" on public.transactions;
create policy "Authenticated users can insert transactions"
on public.transactions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.is_active_user()
  and (
    action in ('ADD','REMOVE','TRANSFER_OUT','TRANSFER_IN','MONTHLY_COUNT_ADJUSTMENT')
    or (action in ('OPENING_BALANCE','ADMIN_ADJUSTMENT','CORRECTION') and public.is_admin())
  )
);

NOTIFY pgrst, 'reload schema';
