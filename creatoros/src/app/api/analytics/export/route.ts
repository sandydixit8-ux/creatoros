import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { err, fail } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { resolveRange, countryTable, clickTable, deviceTable, sourceTable, topPages } from "@/lib/analytics/reporting";

const DATASETS = ["countries", "clicks", "sources", "devices", "pages"] as const;

/** Escape a CSV cell; a leading =,+,-,@ is prefixed so spreadsheets never execute it. */
function cell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:read")) return err.forbidden();

  const dataset = req.nextUrl.searchParams.get("dataset") || "countries";
  if (!(DATASETS as readonly string[]).includes(dataset)) return fail("Unknown dataset", 400, "bad_dataset");
  const range = resolveRange(req.nextUrl.searchParams.get("range"));
  const t = s.org.id;

  let csv: string;
  switch (dataset) {
    case "clicks":
      csv = toCsv(
        ["target", "clicks", "unique_visitors", "share_pct"],
        clickTable(t, range).map((r) => [r.label, r.clicks, r.visitors, r.share])
      );
      break;
    case "sources":
      csv = toCsv(
        ["source", "visitors", "page_views", "conversions", "share_pct"],
        sourceTable(t, range, "ref").map((r) => [r.source, r.visitors, r.pageViews, r.conversions, r.share])
      );
      break;
    case "devices":
      csv = toCsv(
        ["device", "visitors", "page_views", "share_pct"],
        deviceTable(t, range).map((r) => [r.device, r.visitors, r.pageViews, r.share])
      );
      break;
    case "pages":
      csv = toCsv(
        ["page", "slug", "page_views", "visitors", "clicks"],
        topPages(t, range).map((r) => [r.label, r.slug, r.pageViews, r.visitors, r.clicks])
      );
      break;
    default:
      csv = toCsv(
        ["country", "code", "visitors", "page_views", "leads", "clicks", "share_pct"],
        countryTable(t, range).map((r) => [r.name, r.country, r.visitors, r.pageViews, r.leads, r.clicks, r.share])
      );
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="creatoros-${dataset}-${range.key}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
