-- Founder/admin and test-tier setup.
--
-- Run after the test users exist. This exercises the real entitlement path
-- through user_subscriptions instead of special-casing these accounts in code.

insert into user_subscriptions (
  user_id,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  plan_key,
  status,
  trial_ends_at,
  current_period_end,
  cancel_at_period_end,
  max_sites,
  seo_enabled,
  updated_at
)
select
  u.id,
  null,
  null,
  null,
  v.plan_key,
  'active',
  null,
  now() + interval '10 years',
  false,
  v.max_sites,
  v.seo_enabled,
  now()
from users u
join (
  values
    ('unsinkable.ash@gmail.com', 'committed', 3, true),
    ('ash.morales0712@gmail.com', 'situationship', 1, true)
) as v(email, plan_key, max_sites, seo_enabled)
  on lower(u.email) = v.email
on conflict (user_id)
do update set
  plan_key = excluded.plan_key,
  status = 'active',
  current_period_end = excluded.current_period_end,
  cancel_at_period_end = false,
  max_sites = excluded.max_sites,
  seo_enabled = excluded.seo_enabled,
  updated_at = now();

update users
set plan = case lower(email)
  when 'unsinkable.ash@gmail.com' then 'committed'
  when 'ash.morales0712@gmail.com' then 'situationship'
  else plan
end,
updated_at = now()
where lower(email) in ('unsinkable.ash@gmail.com', 'ash.morales0712@gmail.com');
