# Uptime Monitoring Manual Test Steps

## 1) Apply SQL migration

Run:

```sql
\i database/2026-04-uptime-scheduled-monitoring.sql
```

## 2) Deploy the edge function

Run:

```bash
supabase functions deploy run-uptime-checks
```

Set function secrets:

```bash
supabase secrets set UPTIME_RUNNER_SECRET="<strong-random-token>"
```

## 3) Create free user + website

1. Register a new free-tier account.
2. Add first website from `/dashboard/sites/new`.

Verify a check row exists:

```sql
select website_id, user_id, enabled, frequency_minutes, next_check_at
from uptime_checks
order by created_at desc
limit 5;
```

## 4) Run the edge function manually

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/run-uptime-checks" \
  -H "Authorization: Bearer <UPTIME_RUNNER_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected JSON fields:
- `processed`
- `up`
- `degraded`
- `down`
- `error`

## 5) Verify log insert + schedule update

```sql
select website_id, status, status_code, response_time_ms, checked_at
from uptime_logs
order by checked_at desc
limit 20;
```

```sql
select website_id, last_checked_at, next_check_at, frequency_minutes, updated_at
from uptime_checks
order by updated_at desc
limit 20;
```

## 6) Verify dashboard

1. Open `/dashboard/sites/<id>`.
2. Confirm "Uptime monitor" card shows:
   - current status
   - last checked
   - recent history entries
3. On free plan, confirm upgrade teaser appears for advanced monitoring.

## 7) Verify cron schedule exists

```sql
select jobid, jobname, schedule, command
from cron.job
where jobname = 'run-uptime-checks-every-minute';
```

