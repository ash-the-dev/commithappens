import { buildResponseCodeReportFromParseResult } from "@/lib/seo-reporting";

const sampleParseResult = {
  source: "response_codes_all.csv",
  summary: {
    totalUrls: 4,
    healthy: 1,
    redirects: 1,
    clientErrors: 1,
    serverErrors: 1,
    other: 0,
  },
  severity: {
    critical: 2,
    warning: 1,
    healthy: 1,
    info: 0,
  },
  rows: [
    { url: "https://example.com/ok", statusCode: 200 },
    { url: "https://example.com/moved", statusCode: 301 },
    { url: "https://example.com/missing", statusCode: 404 },
    { url: "https://example.com/error", statusCode: 500 },
  ],
  issues: [
    {
      url: "https://example.com/moved",
      statusCode: 301,
      category: "redirect",
      severity: "warning",
      issueTitle: "Redirected URL",
    },
    {
      url: "https://example.com/missing",
      statusCode: 404,
      category: "broken_page",
      severity: "critical",
      issueTitle: "Broken page",
    },
    {
      url: "https://example.com/error",
      statusCode: 500,
      category: "server_error",
      severity: "critical",
      issueTitle: "Server error page",
    },
  ],
  errors: [],
};

const report = buildResponseCodeReportFromParseResult(sampleParseResult);
console.log(report.raw.summary, report.insights.overview, report.voice.statusLabel);
