/**
 * Retime the content calendar for US/UK targeting.
 *
 * The calendar's `market` (US/UK) and `time` are market-local prime times. This
 * converts each slot to a real UTC instant (DST-correct) into a new `utc`
 * column, and UTM-tags the CTA link in each caption. Idempotent: re-running
 * only recomputes `utc` and never double-tags links.
 *
 * Usage: node marketing/factory/retime.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const calendarFile = path.join(here, "out", "content-calendar.csv");

const MARKET_TZ = { US: "America/New_York", UK: "Europe/London" };
const PLATFORM_SLUG = {
  "Instagram Reels": "instagram",
  TikTok: "tiktok",
  "YouTube Shorts": "youtube",
  "Facebook Reels": "facebook",
  "Facebook Feed": "facebook",
  LinkedIn: "linkedin",
  X: "x",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n") {
      row.push(field); field = ""; rows.push(row); row = [];
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.length > 1);
  const [header, ...body] = nonEmpty;
  return { header, rows: body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""]))) };
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function tzOffsetMs(utcDate, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = {};
  for (const part of dtf.formatToParts(utcDate)) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, p.hour === "24" ? 0 : +p.hour, +p.minute, +p.second);
  return asUTC - utcDate.getTime();
}

function localToUtc(dateStr, timeStr, timeZone) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi, 0);
  let guess = wall - tzOffsetMs(new Date(wall), timeZone);
  guess = wall - tzOffsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

function utmUrl(market, platform) {
  const slug = PLATFORM_SLUG[platform] || "social";
  return `https://usecreatoros.co/?utm_source=${slug}&utm_medium=social&utm_campaign=launch_us_uk&utm_content=${market.toLowerCase()}`;
}

function withUtm(text, url) {
  if (text.includes("utm_source=")) return text;
  return text
    .replace(/https?:\/\/(?=usecreatoros\.co)/g, "")
    .replace(/usecreatoros\.co\/?/g, url);
}

function main() {
  if (!existsSync(calendarFile)) throw new Error("No calendar at " + calendarFile);
  const { header, rows } = parseCsv(readFileSync(calendarFile, "utf8"));
  const cols = [...header.filter((c) => c !== "tz" && c !== "utc"), "tz", "utc"];

  for (const r of rows) {
    const tz = MARKET_TZ[r.market];
    if (!tz) throw new Error(`Unknown market "${r.market}" (expected US or UK)`);
    r.tz = tz;
    r.utc = localToUtc(r.date, r.time, tz).toISOString();
    r.caption = withUtm(r.caption, utmUrl(r.market, r.platform));
  }

  const out = [cols.join(",")]
    .concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(",")))
    .join("\n") + "\n";
  writeFileSync(calendarFile, out);
  console.log(`Retimed ${rows.length} rows. Columns: ${cols.join(", ")}`);
  const sample = rows.find((r) => r.market === "US") && rows.find((r) => r.market === "UK");
  if (sample) console.log(`  US ${sample.date} ${sample.time} -> ${sample.utc}`);
}

main();
