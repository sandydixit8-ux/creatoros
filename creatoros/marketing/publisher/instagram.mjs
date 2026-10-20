/**
 * CreatorOS Instagram Reels publisher.
 *
 * Publishes the content-factory 9:16 cuts to an Instagram Business account that
 * is linked to a Facebook Page, using the Instagram Graph API (the Reels flow:
 * create a media container, wait for it to process, then publish).
 *
 * Instagram has no native scheduling through the API, so a slot that is still in
 * the future is *parked* as "due" and published by the operator once its time
 * arrives (or via `--schedule` on a local helper). `plan` shows which slots are
 * due now, which keeps the same calendar as Facebook/YouTube instead of inventing
 * a second one.
 *
 * Credentials live in `marketing/publisher/.env` (gitignored):
 *
 *   IG_USER_ID=17841400000000000          # IG Business account id (NOT the @handle)
 *   IG_ACCESS_TOKEN=EAAG...               # long-lived Page/IG Graph token
 *   IG_GRAPH_VERSION=v23.0                # optional, defaults to v23.0
 *   IG_PUBLIC_BASE_URL=https://...        # optional; required for video_url hosting
 *
 * Instagram's Reels API pulls the video from a public URL, so the render must be
 * reachable over the internet. If `IG_PUBLIC_BASE_URL` is set, clips are served
 * from `${IG_PUBLIC_BASE_URL}/${file}`; otherwise `--url` must give a direct link
 * per post.
 *
 * Usage:
 *   node marketing/publisher/instagram.mjs whoami
 *   node marketing/publisher/instagram.mjs plan
 *   node marketing/publisher/instagram.mjs upload --next --dry
 *   node marketing/publisher/instagram.mjs upload --next --url https://.../clip.mp4
 *   node marketing/publisher/instagram.mjs upload --date 2026-10-22
 *   node marketing/publisher/instagram.mjs stats
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const factoryOut = path.resolve(here, "..", "factory", "out");
const calendarFile = path.join(factoryOut, "content-calendar.csv");
const uploadsFile = path.join(here, ".ig-uploads.json");
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
const IG_USER_ID = ENV.IG_USER_ID;
const IG_TOKEN = ENV.IG_ACCESS_TOKEN;
const VERSION = ENV.IG_GRAPH_VERSION || "v23.0";
const PUBLIC_BASE = (ENV.IG_PUBLIC_BASE_URL || "").replace(/\/$/, "");
const BASE = `https://graph.facebook.com/${VERSION}`;

const IG_PLATFORMS = ["Instagram Reels", "Instagram Feed"];

const args = process.argv.slice(2);
const command = args[0] || "plan";
const has = (f) => args.includes("--" + f);
const valueOf = (f) => {
  const i = args.indexOf("--" + f);
  return i >= 0 ? args[i + 1] : undefined;
};

function requireCreds() {
  if (!IG_USER_ID || !IG_TOKEN) {
    console.error(`Missing credentials. Put these in ${path.relative(process.cwd(), envFile)}:\n`);
    console.error("  IG_USER_ID=17841400000000000   (Instagram Business account id)");
    console.error("  IG_ACCESS_TOKEN=EAAG...        (long-lived Page/IG Graph token)");
    console.error("  IG_PUBLIC_BASE_URL=https://... # where rendered clips are served");
    console.error("  # optional: IG_GRAPH_VERSION=v23.0");
    console.error("\nThe IG account must be a Business/Creator account linked to a Facebook Page,");
    console.error("and the token needs instagram_basic, instagram_content_publish, pages_show_list.");
    process.exit(1);
  }
}

/** Call the IG Graph API. GET puts params in the query, POST in a form body. */
async function graph(pathname, { method = "GET", params = {} } = {}) {
  const url = new URL(`${BASE}/${pathname}`);
  const form = new URLSearchParams(params);
  form.set("access_token", IG_TOKEN);
  const init = { method };
  if (method === "GET") url.search = form.toString();
  else init.body = form;
  const res = await fetch(url.toString(), init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Instagram API ${res.status}: ${json?.error?.message || JSON.stringify(json).slice(0, 200)}`);
  }
  return json;
}

async function cmdWhoami() {
  requireCreds();
  const me = await graph(IG_USER_ID, {
    params: { fields: "id,username,name,followers_count,media_count" },
  });
  console.log(`Connected to Instagram: @${me.username || "?"}  (${me.id})`);
  if (me.name) console.log(`  ${me.name}`);
  console.log(`  ${me.followers_count ?? "?"} followers, ${me.media_count ?? "?"} media`);
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
  return parseCsv(readFileSync(calendarFile, "utf8")).filter((r) => IG_PLATFORMS.includes(r.platform));
}

const key = (r) => `${r.date} ${r.time} ${r.platform}`;

function cmdPlan() {
  const rows = calendar();
  const uploads = loadJson();
  const now = Date.now();
  console.log(`Instagram slots: ${rows.length}\n`);
  for (const r of rows) {
    const done = uploads[key(r)];
    const due = r.utc ? Date.parse(r.utc) <= now : true;
    const mark = done ? "[posted]" : due ? "[due]" : "[future]";
    console.log(`  ${mark} ${r.date} ${r.time}  ${r.platform.padEnd(16)}  ${r.file}  "${r.hook}"`);
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
      "Instagram needs a public video URL. Set IG_PUBLIC_BASE_URL in marketing/publisher/.env or pass --url <https://.../clip.mp4>."
    );
  }
  return `${PUBLIC_BASE}/${r.file}`;
}

/**
 * Reels publish flow: create a container (media_type=REELS, video_url), poll
 * until it reports FINISHED, then publish. Container creation can be async, so
 * a hard timeout is used rather than assuming it is ready immediately.
 */
async function publishReel({ videoUrl, caption }) {
  const container = await graph(`${IG_USER_ID}/media`, {
    method: "POST",
    params: { media_type: "REELS", video_url: videoUrl, caption, share_to_feed: "true" },
  });
  const creationId = container.id;
  if (!creationId) throw new Error("Instagram did not return a media container id");

  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const status = await graph(creationId, { params: { fields: "status_code,status" } });
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR") throw new Error(`Instagram rejected the clip: ${status.status || "ERROR"}`);
    await new Promise((r) => setTimeout(r, 5000));
  }

  const published = await graph(`${IG_USER_ID}/media_publish`, {
    method: "POST",
    params: { creation_id: creationId },
  });
  return published.id;
}

async function cmdUpload() {
  requireCreds();
  const rows = calendar();
  if (!rows.length) throw new Error("No Instagram rows in the calendar.");
  const uploads = loadJson();
  const dry = has("dry");
  const now = Date.now();

  let targets;
  if (valueOf("date")) {
    targets = rows.filter((r) => r.date === valueOf("date"));
  } else if (has("all")) {
    targets = rows.filter((r) => !uploads[key(r)]);
  } else {
    // Default and --next: the earliest slot that is not yet posted and whose time
    // has arrived (or has no time), so a future slot is not posted early.
    const pendingDue = rows.filter((r) => !uploads[key(r)] && (!r.utc || Date.parse(r.utc) <= now));
    targets = pendingDue.length ? [pendingDue[0]] : [];
  }

  if (!targets.length) {
    console.log("Nothing due to post. (Use --date or --all to override.)");
    return;
  }

  console.log(`${dry ? "[dry] " : ""}${targets.length} Reel(s):\n`);
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
    if (dry) {
      console.log(`  would post Reel ${r.file}  ${r.date} ${r.time}  url=${videoUrl}\n    "${r.hook}"`);
      continue;
    }
    try {
      const id = await publishReel({ videoUrl, caption: r.caption || r.hook });
      uploads[key(r)] = {
        id,
        kind: "reel",
        url: `https://www.instagram.com/reel/${id}`,
        uploadedAt: new Date().toISOString(),
      };
      saveUploads(uploads);
      console.log(`  posted Reel ${r.date} ${r.time} -> ${uploads[key(r)].url}`);
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

async function cmdDelete() {
  requireCreds();
  const uploads = loadJson();
  const idArg = valueOf("id");
  const rec = idArg ? Object.entries(uploads).find(([, v]) => v.id === idArg) : undefined;
  if (!rec) throw new Error("Provide --id <mediaId> that exists in .ig-uploads.json");
  const dry = has("dry");
  if (dry) {
    console.log(`would delete IG media ${idArg}  (${rec[0]})`);
    return;
  }
  await graph(idArg, { method: "DELETE" });
  delete uploads[rec[0]];
  saveUploads(uploads);
  console.log(`deleted ${idArg}  (${rec[0]})`);
}

async function cmdStats() {
  requireCreds();
  const me = await graph(IG_USER_ID, {
    params: { fields: "username,followers_count,media_count" },
  });
  console.log(`@${me.username || "?"} — ${me.followers_count ?? "?"} followers, ${me.media_count ?? "?"} media\n`);
  const media = await graph(`${IG_USER_ID}/media`, {
    params: { fields: "id,caption,permalink,media_type,timestamp,like_count,comments_count", limit: "10" },
  });
  for (const m of media.data || []) {
    const cap = (m.caption || "").replace(/\s+/g, " ").slice(0, 50);
    console.log(`  ${m.timestamp}  ${(m.media_type || "").padEnd(10)}  ♥${m.like_count ?? 0} 💬${m.comments_count ?? 0}  ${cap}`);
  }
}

async function main() {
  if (command === "whoami") return cmdWhoami();
  if (command === "plan") return cmdPlan();
  if (command === "upload") return cmdUpload();
  if (command === "delete") return cmdDelete();
  if (command === "stats") return cmdStats();
  console.error("Unknown command: " + command);
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
