import {
  clickTable,
  countryTable,
  deviceTable,
  overview,
  resolveRange,
  sourceTable,
  topPages,
  trafficSeries,
  type RangeKey,
} from "./reporting";

/**
 * Context builder for the analytics AI assistant. It assembles a small,
 * tenant-scoped, PII-free snapshot from the same aggregates the dashboard uses:
 * counts, countries, sources, devices, top links and pages. No visitor ids,
 * session ids, referrer URLs of individual people or contact emails are
 * included, so answering a question never moves personal data to the model.
 */
export interface AnalyticsContext {
  range: string;
  current: ReturnType<typeof overview>["current"];
  previous: ReturnType<typeof overview>["previous"];
  countries: { country: string; visitors: number; pageViews: number; share: number }[];
  devices: { device: string; visitors: number; share: number }[];
  sources: { source: string; visitors: number; conversions: number }[];
  clicks: { target: string; clicks: number; visitors: number }[];
  pages: { page: string; slug: string; pageViews: number; visitors: number }[];
  series: { bucket: string; visitors: number; pageViews: number; clicks: number; conversions: number }[];
}

export function buildAnalyticsContext(tenantId: string, rangeKey: RangeKey = "30d"): AnalyticsContext {
  const range = resolveRange(rangeKey);
  const ov = overview(tenantId, range);
  return {
    range: range.key,
    current: ov.current,
    previous: ov.previous,
    countries: countryTable(tenantId, range, 5).map((c) => ({
      country: c.name,
      visitors: c.visitors,
      pageViews: c.pageViews,
      share: c.share,
    })),
    devices: deviceTable(tenantId, range)
      .slice(0, 5)
      .map((d) => ({ device: d.device, visitors: d.visitors, share: d.share })),
    sources: sourceTable(tenantId, range, "ref")
      .slice(0, 5)
      .map((s) => ({ source: s.source, visitors: s.visitors, conversions: s.conversions })),
    clicks: clickTable(tenantId, range, 5).map((c) => ({ target: c.label, clicks: c.clicks, visitors: c.visitors })),
    pages: topPages(tenantId, range, 5).map((p) => ({
      page: p.label,
      slug: p.slug,
      pageViews: p.pageViews,
      visitors: p.visitors,
    })),
    series: trafficSeries(tenantId, range).map((p) => ({
      bucket: p.bucket,
      visitors: p.visitors,
      pageViews: p.pageViews,
      clicks: p.clicks,
      conversions: p.conversions,
    })),
  };
}

export const ANALYTICS_ASSISTANT_SYSTEM = `You are the analytics assistant inside CreatorOS. Answer the creator's question using ONLY the JSON analytics data provided.

Rules:
- Ground every claim in the numbers given. If the data does not contain the answer, say so plainly instead of guessing or using outside knowledge.
- Be concise: 1-4 short sentences, or a short bullet list when comparing items. No markdown headings or code blocks.
- Reference the actual numbers and percentages. The baseline is the immediately preceding window of equal length.
- Never invent visitors, countries, sources or links that are not in the data. If a list is empty, say there is no data for that period.
- Do not provide financial advice or speculate about causes you cannot see in the data.`;

export function buildAnalyticsPrompt(question: string, context: AnalyticsContext): { role: "system" | "user"; content: string }[] {
  return [
    { role: "system", content: ANALYTICS_ASSISTANT_SYSTEM },
    { role: "user", content: `Question: ${question}\n\nAnalytics data (JSON):\n${JSON.stringify(context)}` },
  ];
}
