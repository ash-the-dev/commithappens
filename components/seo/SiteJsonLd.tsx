import { getSitemapBaseUrl } from "@/lib/app-url";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_NAME_DISPLAY } from "@/lib/seo/site-metadata";

/**
 * WebSite + Organization JSON-LD for search engines and rich results.
 */
export function SiteJsonLd() {
  const base = getSitemapBaseUrl().replace(/\/$/, "");
  const logo = `${base}/brand/commit-happens.png`;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        name: SITE_NAME,
        url: `${base}/`,
        description: DEFAULT_DESCRIPTION,
        inLanguage: "en-US",
        publisher: { "@id": `${base}/#org` },
      },
      {
        "@type": "Organization",
        "@id": `${base}/#org`,
        name: SITE_NAME,
        legalName: SITE_NAME_DISPLAY,
        url: base,
        logo: { "@type": "ImageObject", url: logo },
        description: DEFAULT_DESCRIPTION,
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
