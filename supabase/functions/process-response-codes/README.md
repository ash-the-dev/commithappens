## process-response-codes

Supabase Edge Function that processes uploaded response-code CSV files.

### Input

```json
{
  "site_id": "commit-happens",
  "bucket": "seo-uploads",
  "storage_path": "commit-happens/response-codes/2026-04-22T01-30-00.000Z-response_codes_all.csv"
}
```

### Behavior

- Downloads CSV from Supabase Storage.
- Parses and builds report JSON `{ raw, insights, voice }`.
- Inserts row into `response_code_reports`.

### Required function env vars

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
