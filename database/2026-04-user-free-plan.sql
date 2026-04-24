-- Free tier: plan column on app users (NextAuth/Postgres `users` table, not Supabase auth.users)
BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

COMMENT ON COLUMN users.plan IS
  'Account label (free, situationship, committed). Entitlements for paid tiers come from user_subscriptions; this defaults new signups to free.';

COMMIT;
