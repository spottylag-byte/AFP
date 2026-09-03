-- Scout vetting: anyone could self-register as a scout and immediately
-- search/shortlist real players, with zero check that they're a real
-- scout rather than someone posing as one. New scouts now start
-- 'pending' and need an admin approval before Discover/shortlists
-- work for them. Existing scouts (demo + any real signups before this
-- migration) are grandfathered to 'approved' so nothing already
-- working breaks.

alter table profiles add column scout_status text
  check (scout_status is null or scout_status in ('pending', 'approved', 'rejected'));

update profiles set scout_status = 'approved' where role = 'scout';

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, first_name, last_name, whatsapp_number, scout_status)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'player'),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.raw_user_meta_data ->> 'whatsapp_number',
    case when (new.raw_user_meta_data ->> 'role') = 'scout' then 'pending' else null end
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Defense in depth: even a direct API call can't create a shortlist
-- while pending, not just the UI gate.
drop policy "Scout can manage own shortlists" on shortlists;

create policy "Approved scout can manage own shortlists"
  on shortlists for all
  to authenticated
  using (scout_profile_id = auth.uid())
  with check (
    scout_profile_id = auth.uid()
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'scout' and scout_status = 'approved'
    )
  );

-- setScoutStatus(): admin-only, audited -- same escape-hatch shape as
-- admin_grant_premium() and the deactivation function.
create function set_scout_status(p_profile_id uuid, p_status text)
returns void as $$
begin
  if not is_platform_admin() then
    raise exception 'only platform_admin may approve or reject a scout';
  end if;

  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'invalid scout status: %', p_status;
  end if;

  if not exists (select 1 from profiles where id = p_profile_id and role = 'scout') then
    raise exception 'target profile is not a scout';
  end if;

  update profiles set scout_status = p_status where id = p_profile_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'scout_status_changed', 'profiles', p_profile_id, jsonb_build_object('status', p_status));
end;
$$ language plpgsql security definer;

revoke execute on function set_scout_status(uuid, text) from public;
grant execute on function set_scout_status(uuid, text) to authenticated;
