import type { SupabaseClient } from "@supabase/supabase-js";

/** `websites.id` (Postgres uuid) as text — never Apify run/dataset/actor ids. */
const RFC_4122_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isInternalWebsiteIdFormat(siteId: string): boolean {
  return RFC_4122_UUID.test(siteId.trim());
}

/**
 * Ensures `siteId` is a real `websites.id` before writing SEO crawl rows.
 * @throws with an actionable message if the value is an Apify-style id or unknown UUID.
 */
export async function assertInternalWebsiteSiteId(
  supabase: SupabaseClient,
  inputSiteId: string,
  context: string,
): Promise<string> {
  const trimmed = inputSiteId.trim();
  if (!trimmed) {
    throw new Error(
      `${context}: site_id is empty. It must be your CommitHappens website id (from the dashboard or websites.id), not an Apify run or dataset id.`,
    );
  }
  if (!isInternalWebsiteIdFormat(trimmed)) {
    throw new Error(
      `${context}: site_id must be a website UUID (websites.id). You passed a non-UUID value (first chars: "${trimmed.slice(0, 20)}..."). ` +
        `This often happens if SEO_SITE_ID was set to an Apify run id by mistake. ` +
        `Set SEO_SITE_ID to your site’s internal id, and use APIFY_ACTOR_RUN_ID / APIFY_DATASET_ID for Apify references.`,
    );
  }

  const { data, error } = await supabase
    .from("websites")
    .select("id")
    .eq("id", trimmed)
    .maybeSingle();

  if (error) {
    throw new Error(`${context}: could not verify website: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error(
      `${context}: no row in websites for id=${trimmed}. Create the site in the app first, then re-run the import with that id.`,
    );
  }
  return String(data.id);
}
