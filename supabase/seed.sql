-- Dev/test-only seed data for exercising duplicate-player detection.
-- NOT for production. Run this AFTER you have at least one
-- platform_admin profile (see README for how to bootstrap one) --
-- seeded players are attributed to that admin as created_by.

do $$
begin
  if not exists (select 1 from profiles where role = 'platform_admin') then
    raise exception 'No platform_admin profile found. Bootstrap one first (see README), then re-run this seed.';
  end if;
end $$;

insert into players (football_id_id, full_name, date_of_birth, created_by)
select create_football_id(), v.full_name, v.date_of_birth::date, admin.id
from (
  values
    ('John Adekunle Okafor', '2005-03-14'),
    ('Chidinma Blessing Eze', '2007-11-02'),
    ('Ibrahim Musa Abdullahi', '2003-07-22'),
    ('Grace Oluwaseun Adebayo', '2006-01-30'),
    ('Emmanuel Chukwuemeka Nwosu', '2004-09-18')
) as v(full_name, date_of_birth)
cross join (select id from profiles where role = 'platform_admin' limit 1) as admin;
