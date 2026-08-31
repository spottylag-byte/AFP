-- Phase 3: competition creation, onboarding payment (Paystack), and the
-- Admin waiver path. Organizer self-service is a real RLS INSERT policy
-- (simple, self-scoped); payment initiation and the admin waiver stay
-- SECURITY DEFINER functions, same funnel pattern as Phase 2's
-- register_player(), since both touch competition_payments/audit_logs
-- which ordinary clients must never write directly.

-- ---------------------------------------------------------------------
-- Fix: admin had no way to SEE another organizer's draft competition at
-- all (only the owning organizer's own-draft policy existed), so there
-- was no way to review or waive one. Platform Admin's "Read: All" from
-- the Section 4 role matrix wasn't actually wired for this table.
-- ---------------------------------------------------------------------

create policy "Admin can view all competitions"
  on competitions for select
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'platform_admin')
  );

-- ---------------------------------------------------------------------
-- Fix: competition_payments.provider was NOT NULL and restricted to
-- ('paystack','flutterwave') -- but an Admin waiver isn't a transaction
-- with either provider, so a waived row had nothing valid to put there.
-- ---------------------------------------------------------------------

alter table competition_payments alter column provider drop not null;
alter table competition_payments drop constraint competition_payments_provider_check;
alter table competition_payments add constraint competition_payments_provider_check
  check (provider is null or provider in ('paystack', 'flutterwave'));

-- ---------------------------------------------------------------------
-- Organizer self-service: create own organizers row, create own
-- competitions (always starting as 'draft' -- a client cannot insert a
-- competition directly as 'published', that only happens via payment
-- completion or an admin waiver).
-- ---------------------------------------------------------------------

create policy "Organizer can create own organizers row"
  on organizers for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and exists (select 1 from profiles where id = auth.uid() and role = 'organizer')
  );

create policy "Organizer can create competitions for own organizers row"
  on competitions for insert
  to authenticated
  with check (
    status = 'draft'
    and organizer_id in (select id from organizers where profile_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- createCompetitionPayment(): the only path that may create a
-- competition_payments row for an organizer-initiated payment. Reuses
-- an existing pending payment for the same competition instead of
-- creating a new one each time "Pay" is clicked, so retries don't pile
-- up rows or risk a provider_reference collision.
-- ---------------------------------------------------------------------

create function create_competition_payment(p_competition_id uuid)
returns table (payment_id uuid, amount numeric, currency text)
as $$
declare
  caller_role user_role;
  owns_competition boolean;
  comp_status text;
  existing_pending_id uuid;
  new_payment_id uuid;
  fee numeric := 5000.00; -- placeholder onboarding fee, pending real pricing
begin
  select role into caller_role from profiles where id = auth.uid();
  if caller_role is distinct from 'organizer' then
    raise exception 'only an organizer may initiate a competition payment';
  end if;

  select exists (
    select 1 from competitions c
    join organizers o on o.id = c.organizer_id
    where c.id = p_competition_id and o.profile_id = auth.uid()
  ) into owns_competition;

  if not owns_competition then
    raise exception 'competition not found or not owned by caller';
  end if;

  select status into comp_status from competitions where id = p_competition_id;
  if comp_status <> 'draft' then
    raise exception 'competition is not in draft status';
  end if;

  select id into existing_pending_id
  from competition_payments
  where competition_id = p_competition_id and status = 'pending'
  limit 1;

  if existing_pending_id is not null then
    return query select existing_pending_id, fee, 'NGN'::text;
    return;
  end if;

  insert into competition_payments (competition_id, amount, currency, provider, status)
  values (p_competition_id, fee, 'NGN', 'paystack', 'pending')
  returning id into new_payment_id;

  update competition_payments
  set provider_reference = new_payment_id::text
  where id = new_payment_id;

  return query select new_payment_id, fee, 'NGN'::text;
end;
$$ language plpgsql security definer;

revoke execute on function create_competition_payment(uuid) from public;
grant execute on function create_competition_payment(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- waiveCompetitionPayment(): Admin-only. Records a waived payment (no
-- provider -- see the constraint fix above) and publishes the
-- competition directly, without a real payment ever happening.
-- ---------------------------------------------------------------------

create function waive_competition_payment(p_competition_id uuid)
returns void as $$
declare
  caller_role user_role;
  comp_status text;
  fee numeric := 5000.00;
begin
  select role into caller_role from profiles where id = auth.uid();
  if caller_role is distinct from 'platform_admin' then
    raise exception 'only platform_admin may waive a competition payment';
  end if;

  select status into comp_status from competitions where id = p_competition_id;
  if comp_status is null then
    raise exception 'competition not found';
  end if;
  if comp_status <> 'draft' then
    raise exception 'competition is not in draft status';
  end if;

  insert into competition_payments (competition_id, amount, currency, provider, status, waived_by)
  values (p_competition_id, fee, 'NGN', null, 'waived', auth.uid());

  update competitions set status = 'published' where id = p_competition_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'competition_payment_waived',
    'competitions',
    p_competition_id,
    jsonb_build_object('waived_by', auth.uid())
  );
end;
$$ language plpgsql security definer;

revoke execute on function waive_competition_payment(uuid) from public;
grant execute on function waive_competition_payment(uuid) to authenticated;
