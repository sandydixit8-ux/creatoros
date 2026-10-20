/**
 * CreatorOS TikTok publisher.
 *
 * Publishes the content-factory 9:16 cuts to TikTok via the Content Posting API
 * (PULL_FROM_URL flow: initialise an upload, hand TikTok a public video URL,
 * then poll the publish status).
 *
 * TikTok allows a fixed `schedule_time` on a direct-post publish, so a slot in
 * the future can be scheduled in one call rather than parked. `plan` marks each
 * slot [posted] / [due] / [future] from the same calendar Facebook and YouTube
 * use.
 *
 * Credentials live in `marketing/publisher/.env` (gitignored):
 *
 *   TIKTOK_ACCESS_TOKEN=act....            # user access token with video.publish scope
 *   TIKTOK_OPEN_ID=...                     # optional; from the OAuth token response
 *   TIKTOK_PUBLIC_BASE_URL=https://...     # where rendered clips are served
 *   TIKTOK_PRIVACY=PUBLIC_TO_EVERYONE      # optional; default PUBLIC_TO_EVERYONE
 *   TIKTOK_API_VERSION=v2                  # optional; defaults to v2
 *
 * The PULL_FROM_URL flow requires the video to be reachable over the internet and
 * the domain to be verified in the TikTok developer portal. `TIKTOK_PUBLIC_BASE_URL`
 * supplies that host; `--url` overrides it per post.
 *
 * Usage:
 *   node marketing/publisher/tiktok.mjs whoami
 *   node marketing/publisher/tiktok.mjs plan
 *   node marketing/publisher/tiktok.mjs upload --next --dry
 *   node marketing/publisher/tiktok.mjs upload --next --url https://.../clip.mp4
 *   node marketing/publisher/tiktok.mjs upload --date 2026-10-22 --schedule
 *   node marketing/publisher/tiktok.mjs stats
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const factoryOut = path.resolve(here, "..", "factory", "out");
const calendarFile = path.join(factoryOut, "content-calendar.csv");
const uploadsFile = path.join(here, ".tt-uploads.json");
const envFile = path.join(here, ".env");

function loadEnv() {
  const env = { ...process.env };
  if (!existsSync(envFile)) return env;
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const ENV = loadEnv();
const TOKEN = ENV.TIKTOK_ACCESS_TOKEN;
const OPEN_ID = ENV.TIKTOK_OPEN_ID || "";
const API_VERSION = ENV.TIKTOK_API_VERSION || "v2";
const PUBLIC_BASE = (ENV.TIKTOK_PUBLIC_BASE_URL || "").replace(/\/$/, "");
const DEFAULT_PRIVACY = ENV.TIKTOK_PRIVACY || "PUBLIC_TO_EVERYONE";
const BASE = `https://open.tiktokapis.com/${API_VERSION}`;

const TT_PLATFORMS = ["TikTok"];

const args = process.argv.slice(2);
const command = args[0] || "plan";
const has = (f) => args.includes("--" + f);
const valueOf = (f) => {
  const i = args.indexOf("--" + f);
  return i >= 0 ? args[i + 1] : undefined;
};

function requireCreds() {
  if (!TOKEN) {
    console.error(`Missing credentials. Put these in ${path.relative(process.cwd(), envFile)}:\n`);
    console.error("  TIKTOK_ACCESS_TOKEN=act....         # user token with video.publish scope");
    console.error("  TIKTOK_PUBLIC_BASE_URL=https://...  # where rendered clips are served");
    console.error("  # optional: TIKTOK_PRIVACY=PUBLIC_TO_EVERYONE");
    console.error("\nGet a token via the TikTok Login Kit OAuth flow; the developer app needs the");
    console.error("`video.publish` scope and a verified PULL_FROM_URL domain.");
    process.exit(1);
  }
}

/** Call the TikTok API. Params are JSON body; the bearer token is the auth. */
async function api(pathname, { method = "POST", body = {} } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  const errCode = json?.error?.code;
  if (!res.ok || (errCode && errCode !== "ok")) {
    throw new Error(`TikTok API ${res.status}: ${json?.error?.message || errCode || JSON.stringify(json).slice(0, 200)}`);
  }
  return json.data ?? json;
}

async function cmdWhoami() {
  requireCreds();
  const info = await api("/user/info/?fields=open_id,union_id,display_name,follower_count,likes_count,video_count", { method: "GET" });
  const u = info.user || {};
  console.log(`Connected to TikTok: ${u.display_name || "?"}  (${u.open_id || OPEN_ID || "?"})`);
  console.log(`  ${u.follower_count ?? "?"} followers, ${u.video_count ?? "?"} videos, ${u.likes_count ?? "?"} likes`);
  console.log(`  API version: ${API_VERSION}`);
}

// --- calendar ---------------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
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
  if (!nonEmpty.length) return [];
  const [header, ...body] = nonEmpty;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function calendar() {
  if (!existsSync(calendarFile)) throw new Error("No calendar yet. Run: node marketing/factory/generate.mjs");
  return parseCsv(readFileSync(calendarFile, "utf8")).filter((r) => TT_PLATFORMS.includes(r.platform));
}

const key = (r) => `${r.date} ${r.time} ${r.platform}`;

function cmdPlan() {
  const rows = calendar();
  const uploads = loadJson();
  const now = Date.now();
  console.log(`TikTok slots: ${rows.length}\n`);
  for (const r of rows) {
    const done = uploads[key(r)];
    const due = r.utc ? Date.parse(r.utc) <= now : true;
    const mark = done ? "[posted]" : due ? "[due]" : "[future]";
    console.log(`  ${mark} ${r.date} ${r.time}  ${r.platform.padEnd(8)}  ${r.file}  "${r.hook}"`);
  }
}

// --- uploads ----------------------------------------------------------------

function loadJson() {
  return existsSync(uploadsFile) ? JSON.parse(readFileSync(uploadsFile, "utf8")) : {};
}
function saveUploads(u) {
  writeFileSync(uploadsFile, JSON.stringify(u, null, 2) + "\n");
}

function publicUrlFor(r) {
  const explicit = valueOf("url");
  if (explicit) return explicit;
  if (!PUBLIC_BASE) {
    throw new Error(
      "TikTok needs a public video URL. Set TIKTOK_PUBLIC_BASE_URL in marketing/publisher/.env or pass --url <https://.../clip.mp4>."
    );
  }
  return `${PUBLIC_BASE}/${r.file}`;
}

/**
 * Direct-post publish. A future slot uses `schedule_time` (Unix seconds, at
 * least 15 minutes ahead, up to 10 days), so the calendar's UTC time can be
 * handed straight to TikTok instead of polling locally.
 */
async function publishVideo({ videoUrl, caption, scheduleTime, privacy }) {
  const body = {
    post_info: {
      title: caption.slice(0, 2200),
      privacy_level: privacy,
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
    },
    source_info: {
      source: "PULL_FROM_URL",
      video_url: videoUrl,
    },
  };
  if (scheduleTime) {
    body.post_info.privacy_level = "SELF_ONLY";
    body.post_info.schedule_time = String(scheduleTime);
  }
  const data = await api("/post/publish/video/init/", { body });
  return data.publish_id;
}

async function pollStatus(publishId) {
  const deadline = Date.now() + 3 * 60 * 1000;
  while (Date.now() < deadline) {
    const data = await api("/post/publish/status/fetch/", { body: { publish_id: publishId } });
    const status = data.status;
    if (["PUBLISH_COMPLETE", "SEND_TO_USER_INBOX"].includes(status)) return status;
    if (["FAILED", "PUBLISH_FAILED"].includes(status)) throw new Error(`TikTok publish failed: ${data.fail_reason || status}`);
    await new Promise((r) => setTimeout(r, 4000));
  }
  return "PROCESSING";
}

async function cmdUpload() {
  requireCreds();
  const rows = calendar();
  if (!rows.length) throw new Error("No TikTok rows in the calendar.");
  const uploads = loadJson();
  const dry = has("dry");
  const now = Date.now();
  const privacy = valueOf("privacy") || DEFAULT_PRIVACY;

  let targets;
  if (valueOf("date")) {
    targets = rows.filter((r) => r.date === valueOf("date"));
  } else if (has("all")) {
    targets = rows.filter((r) => !uploads[key(r)]);
  } else {
    const pendingDue = rows.filter((r) => !uploads[key(r)] && (!r.utc || Date.parse(r.utc) <= now));
    targets = pendingDue.length ? [pendingDue[0]] : [];
  }

  if (!targets.length) {
    console.log("Nothing due to post. (Use --date or --all to override.)");
    return;
  }

  console.log(`${dry ? "[dry] " : ""}${targets.length} video(s):\n`);
  const failures = [];
  for (const r of targets) {
    const file = path.join(factoryOut, r.file);
    if (!existsSync(file)) {
      console.log(`  SKIP ${r.file} (render it first: node marketing/factory/generate.mjs)`);
      continue;
    }
    let videoUrl;
    try {
      videoUrl = publicUrlFor(r);
    } catch (e) {
      failures.push(`${r.date} ${r.time}: ${e.message}`);
      console.log(`  FAILED ${r.date} ${r.time}: ${e.message}`);
      continue;
    }
    const scheduleTime = has("schedule") && r.utc ? Math.floor(Date.parse(r.utc) / 1000) : undefined;
    const when = scheduleTime ? `scheduled @ ${r.utc}` : "now";
    if (dry) {
      console.log(`  would post ${r.file}  ${r.date} ${r.time}  ${when}  privacy=${privacy}\n    "${r.hook}"`);
      continue;
    }
    try {
      const publishId = await publishVideo({ videoUrl, caption: r.caption || r.hook, scheduleTime, privacy });
      const status = await pollStatus(publishId);
      uploads[key(r)] = { publishId, status, scheduledFor: scheduleTime ? r.utc : null, uploadedAt: new Date().toISOString() };
      saveUploads(uploads);
      console.log(`  posted ${r.date} ${r.time} -> ${status}  (publish_id ${publishId})`);
    } catch (e) {
      failures.push(`${r.date} ${r.time}: ${e.message}`);
      console.log(`  FAILED ${r.date} ${r.time}: ${e.message}`);
    }
  }
  if (failures.length) {
    console.log(`\n${failures.length} failure(s):`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

async function cmdStats() {
  requireCreds();
  const info = await api("/user/info/?fields=display_name,follower_count,likes_count,video_count", { method: "GET" });
  const u = info.user || {};
  console.log(`${u.display_name || "?"} — ${u.follower_count ?? "?"} followers, ${u.video_count ?? "?"} videos, ${u.likes_count ?? "?"} likes`);
}

async function main() {
  if (command === "whoami") return cmdWhoami();
  if (command === "plan") return cmdPlan();
  if (command === "upload") return cmdUpload();
  if (command === "stats") return cmdStats();
  console.error("Unknown command: " + command);
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
