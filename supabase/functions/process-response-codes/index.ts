import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { buildResponseCodeReportFromCsvText } from "../../../lib/seo/response-codes/report-builder.ts";

type ProcessPayload = {
  site_id?: string;
  bucket?: string;
  storage_path?: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ success: false, error: "method_not_allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ success: false, error: "missing_supabase_env" }, 500);
    }

    const body = (await request.json()) as ProcessPayload;
    const siteId = body.site_id?.trim();
    const bucket = body.bucket?.trim() || "seo-uploads";
    const storagePath = body.storage_path?.trim();

    if (!siteId || !storagePath) {
      return json({ success: false, error: "missing_site_or_storage_path" }, 400);
    }

    console.log(JSON.stringify({ step: "download_start", siteId, bucket, storagePath }));
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const download = await supabase.storage.from(bucket).download(storagePath);
    if (download.error || !download.data) {
      return json(
        {
          success: false,
          error: "storage_download_failed",
          details: download.error?.message ?? "missing_file",
        },
        400,
      );
    }

    const csvText = await download.data.text();
    console.log(JSON.stringify({ step: "parse_start", bytes: csvText.length }));
    const report = buildResponseCodeReportFromCsvText(csvText, storagePath.split("/").at(-1));

    console.log(JSON.stringify({ step: "db_insert_start", siteId }));
    const insertWithMetadata = await supabase
      .from("response_code_reports")
      .insert({
        site_id: siteId,
        report_json: report,
        source_file_path: storagePath,
        source_bucket: bucket,
        processing_status: report.raw.errors.length > 0 ? "warning" : "success",
        error_message: report.raw.errors.length > 0 ? report.raw.errors.join(" | ").slice(0, 4000) : null,
      })
      .select("id,site_id")
      .single();

    const insert =
      insertWithMetadata.error &&
      insertWithMetadata.error.message.toLowerCase().includes("column") &&
      insertWithMetadata.error.message.includes("response_code_reports")
        ? await supabase
            .from("response_code_reports")
            .insert({
              site_id: siteId,
              report_json: report,
            })
            .select("id,site_id")
            .single()
        : insertWithMetadata;

    if (insert.error || !insert.data) {
      return json(
        {
          success: false,
          error: "db_insert_failed",
          details: insert.error?.message ?? "insert_failed",
        },
        500,
      );
    }

    console.log(JSON.stringify({ step: "complete", reportId: insert.data.id, siteId }));
    return json({
      success: true,
      report_id: insert.data.id,
      site_id: insert.data.site_id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ step: "fatal", message }));
    return json({ success: false, error: "processing_failed", details: message }, 500);
  }
});
