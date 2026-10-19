/**
 * CreatorOS Facebook Page publisher.
 *
 * Publishes the content-factory videos to a Facebook Page using the Graph API:
 * 9:16 cuts go out as Reels (`video_reels`, resumable upload), everything else
 * through the page Videos edge. Captions come from the calendar, and posts can
 * be published now, left as a draft, or scheduled for the calendar slot.
 *
 * Credentials live in `marketing/publisher/.env` (gitignored):
 *
 *   FB_PAGE_ID=1299369053270317
 *   FB_PAGE_TOKEN=EAAG...            # long-lived Page access token
 *   FB_GRAPH_VERSION=v23.0           # optional, defaults to v23.0
 *
 * How to get a Page token (see docs/FACEBOOK-SETUP.md for the full walkthrough):
 *   1. Create an app at https://developers.facebook.com/apps (type: Business).
 *   2. Graph API Explorer -> select the app -> add permissions
 *      `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`,
 *      `pages_read_user_content`, `business_management`.
 *   3. Generate a User token, then exchange it for a long-lived one, then call
 *      `GET /{page-id}?fields=access_token` with that token to get the Page token.
 *   4. Paste that Page token here. It stays valid unless the password changes or
 *      the app is removed; regenerate if posts start returning 190.
 *
 * Usage:
 *   node marketing/publisher/facebook.mjs whoami
 *   node marketing/publisher/facebook.mjs plan
 *   node marketing/publisher/facebook.mjs upload --next --dry
 *   node marketing/upload... upload --next            # publish now
 *   node marketing/publisher/facebook.mjs upload --all --schedule   # schedule per calendar
 *   node marketing/publisher/facebook.mjs test --file creatoros-hook-9x16.mp4 --state draft
 *   node marketing/publisher/facebook.mjs post --message "Hello from CreatorOS"
 *   node marketing/publisher/facebook.mjs delete --id <videoId>
 *   node marketing/publisher/facebook.mjs stats
 *
 * A Facebook Reels post costs two upload calls (start + finish) plus the binary
 * upload; the feed path is a single multipart POST. State values: published,
 * draft, scheduled (only `scheduled` uses the calendar date/time).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const factoryOut = path.resolve(here, "..", "factory", "out");
const calendarFile = path.join(factoryOut, "content-calendar.csv");
const uploadsFile = path.join(here, ".fb-uploads.json");
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
const PAGE_ID = ENV.FB_PAGE_ID;
const PAGE_TOKEN = ENV.FB_PAGE_TOKEN;
const VERSION = ENV.FB_GRAPH_VERSION || "v23.0";
const BASE = `https://graph.facebook.com/${VERSION}`;

const FB_PLATFORMS = ["Facebook Reels", "Facebook Feed"];

const args = process.argv.slice(2);
const command = args[0] || "plan";
const has = (f) => args.includes("--" + f);
const valueOf = (f) => {
  const i = args.indexOf("--" + f);
  return i >= 0 ? args[i + 1] : undefined;
};

function requireCreds() {
  if (!PAGE_ID || !PAGE_TOKEN) {
    console.error(`Missing credentials. Put these in ${path.relative(process.cwd(), envFile)}:\n`);
    console.error("  FB_PAGE_ID=1299369053270317");
    console.error("  FB_PAGE_TOKEN=EAAG...   (long-lived Page access token)");
    console.error("  # optional: FB_GRAPH_VERSION=v23.0");
    console.error("\nSee docs/FACEBOOK-SETUP.md.");
    process.exit(1);
  }
}

/** Call the Graph API. GET puts params in the query, POST in a form body. */
async function graph(pathname, { method = "GET", params = {} } = {}) {
  const url = new URL(`${BASE}/${pathname}`);
  const form = new URLSearchParams(params);
  form.set("access_token", PAGE_TOKEN);
  const init = { method };
  if (method === "GET") url.search = form.toString();
  else init.body = form;
  const res = await fetch(url.toString(), init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Facebook API ${res.status}: ${json?.error?.message || JSON.stringify(json).slice(0, 200)}`);
  }
  return json;
}

async function cmdWhoami() {
  requireCreds();
  const page = await graph(PAGE_ID, {
    params: { fields: "id,name,category,fan_count,followers_count,link,username" },
  });
  console.log(`Connected to Page: ${page.name}  (${page.id})`);
  if (page.username) console.log(`  @${page.username}  ${page.link || ""}`);
  console.log(`  ${page.followers_count ?? page.fan_count ?? "?"} followers`);
  console.log(`  Graph version: ${VERSION}`);
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
  return parseCsv(readFileSync(calendarFile, "utf8")).filter((r) => FB_PLATFORMS.includes(r.platform));
}

const key = (r) => `${r.date} ${r.time} ${r.platform}`;

function cmdPlan() {
  const rows = calendar();
  const uploads = loadJson();
  console.log(`Facebook slots: ${rows.length}\n`);
  for (const r of rows) {
    const done = uploads[key(r)];
    const mark = done ? "[posted]" : "[pending]";
    console.log(`  ${mark} ${r.date} ${r.time}  ${r.platform.padEnd(14)}  ${r.file}  "${r.hook}"`);
  }
}

// --- uploads ----------------------------------------------------------------

function loadJson() {
  return existsSync(uploadsFile) ? JSON.parse(readFileSync(uploadsFile, "utf8")) : {};
}
function saveUploads(u) {
  writeFileSync(uploadsFile, JSON.stringify(u, null, 2) + "\n");
}

function unixFor(dateStr, timeStr) {
  return Math.floor(new Date(`${dateStr}T${timeStr}:00`).getTime() / 1000);
}

async function uploadReel(file, { description, state, scheduledTime }) {
  const start = await graph(`${PAGE_ID}/video_reels`, { method: "POST", params: { upload_phase: "start" } });
  const { video_id: videoId, upload_url: uploadUrl } = start;
  if (!uploadUrl) throw new Error("Reels start did not return an upload_url");

  const buf = readFileSync(file);
  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${PAGE_TOKEN}`,
      offset: "0",
      file_size: String(buf.length),
      "Content-Type": "application/octet-stream",
    },
    body: buf,
  });
  const upJson = await up.json().catch(() => ({}));
  if (!up.ok && upJson?.error) {
    throw new Error(`Reels binary upload ${up.status}: ${upJson.error.message || ""}`);
  }

  const finish = { upload_phase: "finish", video_id: videoId, video_state: state, description };
  if (state === "SCHEDULED") finish.scheduled_publish_time = String(scheduledTime);
  await graph(`${PAGE_ID}/video_reels`, { method: "POST", params: finish });
  return videoId;
}

async function uploadFeedVideo(file, { description, title, state, scheduledTime }) {
  const form = new FormData();
  form.set("access_token", PAGE_TOKEN);
  form.set("description", description);
  if (title) form.set("title", title.slice(0, 255));
  if (state === "SCHEDULED") {
    form.set("published", "false");
    form.set("scheduled_publish_time", String(scheduledTime));
  } else if (state === "DRAFT") {
    form.set("published", "false");
  } else {
    form.set("published", "true");
  }
  form.set("source", new Blob([readFileSync(file)], { type: "video/mp4" }), path.basename(file));

  const res = await fetch(`${BASE}/${PAGE_ID}/videos`, { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Facebook video upload ${res.status}: ${json?.error?.message || ""}`);
  return json.id;
}

function resolveState() {
  if (has("schedule")) return "SCHEDULED";
  const s = (valueOf("state") || "published").toLowerCase();
  if (s === "draft") return "DRAFT";
  if (s === "scheduled") return "SCHEDULED";
  return "PUBLISHED";
}

async function cmdUpload() {
  const rows = calendar();
  if (!rows.length) throw new Error("No Facebook rows in the calendar.");
  const uploads = loadJson();
  const state = resolveState();
  const dry = has("dry");
  const oneFile = valueOf("file");

  let targets;
  if (oneFile) {
    targets = [{ date: valueOf("date") || "", time: valueOf("time") || "", platform: valueOf("kind") === "video" ? "Facebook Feed" : "Facebook Reels", file: oneFile, hook: valueOf("title") || "CreatorOS", caption: valueOf("caption") || valueOf("description") || "CreatorOS — Create. Grow. Sell. Automate. https://usecreatoros.co" }];
  } else if (valueOf("date")) {
    targets = rows.filter((r) => r.date === valueOf("date"));
  } else if (has("all")) {
    targets = rows.filter((r) => !uploads[key(r)]);
  } else {
    const firstPending = rows.find((r) => !uploads[key(r)]);
    targets = firstPending ? rows.filter((r) => r.date === firstPending.date && !uploads[key(r)]) : [];
  }

  if (!targets.length) {
    console.log("Nothing pending to post.");
    return;
  }

  console.log(`${dry ? "[dry] " : ""}${targets.length} post(s) as ${state}:\n`);
  const failures = [];
  const minSchedule = Math.floor(Date.now() / 1000) + 10 * 60;
  for (const r of targets) {
    const file = path.join(factoryOut, r.file);
    if (!existsSync(file)) {
      console.log(`  SKIP ${r.file} (render it first: node marketing/factory/generate.mjs)`);
      continue;
    }
    const isReel = r.platform === "Facebook Reels";
    const scheduledTime = r.utc ? Math.floor(Date.parse(r.utc) / 1000) : r.date && r.time ? unixFor(r.date, r.time) : undefined;
    if (state === "SCHEDULED" && scheduledTime && scheduledTime < minSchedule) {
      console.log(`  SKIP ${r.date} ${r.time} ${r.platform} (slot is in the past; use --state published or --date ${r.date})`);
      continue;
    }
    const when = r.date && r.time ? `${r.date} ${r.time}` : "now";
    if (dry) {
      console.log(`  would post ${isReel ? "Reel" : "video"} ${r.file}  state=${state} @ ${when}  "${r.hook}"`);
      continue;
    }
    try {
      const id = isReel
        ? await uploadReel(file, { description: r.caption, state, scheduledTime })
        : await uploadFeedVideo(file, { description: r.caption, title: r.hook, state, scheduledTime });
      if (r.date && r.time) {
        uploads[key(r)] = { id, kind: isReel ? "reel" : "video", state, url: `https://www.facebook.com/${id}`, uploadedAt: new Date().toISOString() };
        saveUploads(uploads);
      }
      console.log(`  posted ${isReel ? "Reel" : "video"} ${when} -> https://www.facebook.com/${id} (${state})`);
    } catch (e) {
      failures.push(`${r.date} ${r.time} ${r.platform}: ${e.message}`);
      console.log(`  FAILED ${r.date} ${r.time} ${r.platform}: ${e.message}`);
    }
  }
  if (failures.length) {
    console.log(`\n${failures.length} failure(s):`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

async function cmdTest() {
  requireCreds();
  const file = valueOf("file") || "creatoros-hook-9x16.mp4";
  const p = path.join(factoryOut, file);
  if (!existsSync(p)) throw new Error("Video not found: " + file + " (run marketing/factory/generate.mjs first)");
  const state = resolveState();
  const isReel = valueOf("kind") !== "video";
  console.log(`Uploading ${file} as ${isReel ? "Reel" : "video"} (${state})...`);
  const description = valueOf("caption") || "CreatorOS — One workspace for your whole creator business. Start free at https://usecreatoros.co";
  const id = isReel ? await uploadReel(p, { description, state }) : await uploadFeedVideo(p, { description, state, title: valueOf("title") });
  console.log(`Done: https://www.facebook.com/${id}  (${state})`);
}

async function cmdDelete() {
  requireCreds();
  const uploads = loadJson();
  const dry = has("dry");
  const idArg = valueOf("id");
  const ids = idArg
    ? idArg.split(",").map((s) => s.trim()).filter(Boolean)
    : has("all")
      ? Object.values(uploads).map((v) => v.id)
      : [];
  if (!ids.length) throw new Error("Provide --id <postId[,postId]> or --all");

  console.log(`${dry ? "[dry] " : ""}Deleting ${ids.length} post(s):\n`);
  for (const id of ids) {
    const rec = Object.entries(uploads).find(([, v]) => v.id === id);
    if (dry) {
      console.log(`  would delete ${id}${rec ? `  (${rec[0]})` : ""}`);
      continue;
    }
    try {
      await graph(id, { method: "DELETE" });
      console.log(`  deleted ${id}${rec ? `  (${rec[0]})` : ""}`);
      if (rec) delete uploads[rec[0]];
    } catch (e) {
      console.log(`  FAILED ${id}: ${e.message}`);
    }
  }
  if (!dry) saveUploads(uploads);
}

async function cmdPost() {
  requireCreds();
  const message = valueOf("message");
  if (!message) throw new Error('Provide --message "text" (optional --link <url>)');
  const link = valueOf("link");
  const params = { message };
  if (link) params.link = link;
  const out = await graph(`${PAGE_ID}/feed`, { method: "POST", params });
  console.log(`Posted: https://www.facebook.com/${out.id}`);
}

async function cmdStats() {
  requireCreds();
  const page = await graph(PAGE_ID, { params: { fields: "name,fan_count,followers_count" } });
  const feed = await graph(`${PAGE_ID}/published_posts`, { params: { fields: "id,message,created_time,permalink_url", limit: "10" } });
  console.log(`${page.name} — ${page.followers_count ?? page.fan_count ?? "?"} followers\n`);
  for (const p of feed.data || []) {
    const msg = (p.message || "").replace(/\s+/g, " ").slice(0, 60);
    console.log(`  ${p.created_time}  ${msg}  ${p.permalink_url || ""}`);
  }
}

async function main() {
  if (command === "whoami") return cmdWhoami();
  if (command === "plan") return cmdPlan();
  if (command === "upload") return cmdUpload();
  if (command === "test") return cmdTest();
  if (command === "delete") return cmdDelete();
  if (command === "post") return cmdPost();
  if (command === "stats") return cmdStats();
  console.error("Unknown command: " + command);
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
