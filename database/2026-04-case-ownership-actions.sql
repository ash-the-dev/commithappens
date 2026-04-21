BEGIN;

ALTER TABLE dashboard_cases
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_action text;

CREATE INDEX IF NOT EXISTS dashboard_cases_assignee_idx
  ON dashboard_cases (website_id, assigned_to_user_id, updated_at DESC);

COMMIT;

