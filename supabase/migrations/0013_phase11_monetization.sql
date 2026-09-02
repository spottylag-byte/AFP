-- Phase 11: Monetization Expansion. DoD per the master spec: "a repeat
-- organizer upgrades to a premium/subscription tier." Kept deliberately
-- additive -- premium never restricts anything a free organizer already
-- has, it only waives the existing per-competition onboarding fee for
-- as long as the subscription is active. Reuses the exact Paystack +
-- webhook + admin-escape-hatch pattern Phase 3 already established for
-- competition_payments, rather than inventing a new mechanism.

alter table organizers add column tier text not null default 'free'
  check (tier in ('free', 'premium'));
alter table organizers add column premium_until timestamptz;

-- ---------------------------------------------------------------------
-- organizer_subscription_payments: same shape/idempotency pattern as
-- competition_payments (Phase 3) -- a pending row per attempt, the
-- Paystack webhook flips it to 'completed' exactly once via a
-- conditional UPDATE, never a direct insert-as-completed from a client.
-- ---------------------------------------------------------------------

create table organizer_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references organizers (id),
  amount numeric not null,
  currency text not null default 'NGN',
  provider text check (provider is null or provider in ('paystack', 'flutterwave')),
  provider_reference text,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  granted_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

alter table organizer_subscription_payments enable row level security;

create policy "Organizer or admin can view own subscription payments"
  on organizer_subscription_payments for select
  to authenticated
  using (
    organizer_id in (select id from organizers where profile_id = auth.uid())
    or is_platform_admin()
  );

-- ---------------------------------------------------------------------
-- initiateOrganizerSubscription(): mirrors create_competition_payment().
-- Reuses an existing pending row instead of piling up duplicates on
-- retry.
-- ---------------------------------------------------------------------

create function initiate_organizer_subscription()
returns table (payment_id uuid, amount numeric, currency text) as $$
declare
  v_caller_role user_role;
  v_organizer_id uuid;
  v_existing_pending_id uuid;
  v_new_payment_id uuid;
  v_fee numeric := 15000.00; -- placeholder monthly premium fee, pending real pricing
begin
  select role into v_caller_role from profiles where id = auth.uid();
  if v_caller_role is distinct from 'organizer' then
    raise exception 'only an organizer may subscribe to premium';
  end if;

  select id into v_organizer_id from organizers where profile_id = auth.uid();
  if v_organizer_id is null then
    raise exception 'no organizer profile found for caller';
  end if;

  select id into v_existing_pending_id
  from organizer_subscription_payments
  where organizer_id = v_organizer_id and status = 'pending'
  limit 1;

  if v_existing_pending_id is not null then
    return query select v_existing_pending_id, v_fee, 'NGN'::text;
    return;
  end if;

  insert into organizer_subscription_payments (organizer_id, amount, currency, provider, status)
  values (v_organizer_id, v_fee, 'NGN', 'paystack', 'pending')
  returning id into v_new_payment_id;

  update organizer_subscription_payments
  set provider_reference = v_new_payment_id::text
  where id = v_new_payment_id;

  return query select v_new_payment_id, v_fee, 'NGN'::text;
end;
$$ language plpgsql security definer;

revoke execute on function initiate_organizer_subscription() from public;
grant execute on function initiate_organizer_subscription() to authenticated;

-- ---------------------------------------------------------------------
-- adminGrantPremium(): the admin escape hatch, same role this pilot's
-- waiveCompetitionPayment() plays -- lets premium actually be granted
-- and demoed with no live Paystack key configured, exactly like the
-- competition fee waiver already does.
-- ---------------------------------------------------------------------

create function admin_grant_premium(p_organizer_id uuid, p_months int default 1)
returns void as $$
declare
  v_new_until timestamptz;
begin
  if not is_platform_admin() then
    raise exception 'only platform_admin may grant premium';
  end if;

  select greatest(now(), coalesce(premium_until, now())) + (p_months || ' months')::interval
  into v_new_until
  from organizers
  where id = p_organizer_id;

  if v_new_until is null then
    raise exception 'organizer not found';
  end if;

  update organizers
  set tier = 'premium', premium_until = v_new_until
  where id = p_organizer_id;

  insert into organizer_subscription_payments
    (organizer_id, amount, currency, provider, status, granted_by)
  values (p_organizer_id, 0, 'NGN', null, 'completed', auth.uid());

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'premium_granted_by_admin',
    'organizers',
    p_organizer_id,
    jsonb_build_object('months', p_months, 'premium_until', v_new_until)
  );
end;
$$ language plpgsql security definer;

revoke execute on function admin_grant_premium(uuid, int) from public;
grant execute on function admin_grant_premium(uuid, int) to authenticated;

-- ---------------------------------------------------------------------
-- create_competition_payment() gains one branch: an organizer with an
-- active premium subscription skips the fee entirely and their
-- competition is published immediately, same end state as an admin
-- waiver but self-service and audited as premium rather than waived.
-- Body-only change, signature and return shape unchanged -- safe as
-- CREATE OR REPLACE.
-- ---------------------------------------------------------------------

create or replace function create_competition_payment(p_competition_id uuid)
returns table (payment_id uuid, amount numeric, currency text)
as $$
declare
  caller_role user_role;
  owns_competition boolean;
  comp_status text;
  existing_pending_id uuid;
  new_payment_id uuid;
  fee numeric := 5000.00; -- placeholder onboarding fee, pending real pricing
  v_is_premium boolean;
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

  select (o.tier = 'premium' and o.premium_until > now())
  into v_is_premium
  from organizers o
  join competitions c on c.organizer_id = o.id
  where c.id = p_competition_id;

  if v_is_premium then
    insert into competition_payments (competition_id, amount, currency, provider, status)
    values (p_competition_id, 0, 'NGN', null, 'completed')
    returning id into new_payment_id;

    update competitions set status = 'published' where id = p_competition_id and status = 'draft';

    insert into audit_logs (actor_id, action, entity_type, entity_id, details)
    values (
      auth.uid(),
      'competition_payment_waived_premium',
      'competitions',
      p_competition_id,
      jsonb_build_object('reason', 'active premium subscription')
    );

    return query select new_payment_id, 0::numeric, 'NGN'::text;
    return;
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
