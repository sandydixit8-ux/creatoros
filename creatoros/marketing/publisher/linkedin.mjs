/**
 * CreatorOS LinkedIn publisher.
 *
 * Posts the content-factory clips to a LinkedIn Company Page using the
 * `ugcPosts` / Videos API. LinkedIn has two relevant APIs and this uses the
 * version that works with a Company Page token:
 *
 *   1. Register a video upload -> receive an uploadUrl + video urn.
 *   2. PUT the binary to that url.
 *   3. Create a UGC post whose media references the video urn, with the
 *      calendar caption as the commentary.
 *
 * LinkedIn has no per-post scheduling through this API, so a slot still in the
 * future is *parked*: `plan` marks it [future] and `upload` (default/--next)
 * only posts a slot whose time has arrived. `--date` / `--all` override that.
 *
 * Credentials live in `marketing/publisher/.env` (gitignored):
 *
 *   LINKEDIN_ACCESS_TOKEN=...            # token with w_organization_social + r_organization_social
 *   LINKEDIN_ORG_ID=144019338            # numeric Company Page id (or urn:li:organization:...)
 *   LINKEDIN_API_VERSION=202401          # optional; LinkedIn-Version header
 *   LINKEDIN_PUBLIC_BASE_URL=https://... # optional; where rendered clips are served
 *
 * The token must be obtained by an admin of the Page via LinkedIn's 3-legged
 * OAuth (see docs/LINKEDIN-SETUP.md). `w_organization_social` requires the app
 * to be approved for that scope. Company Page id is in the admin URL:
 * linkedin.com/company/<id>/admin/dashboard/.
 *
 * Usage:
 *   node marketing/publisher/linkedin.mjs whoami
 *   node marketing/publisher/linkedin.mjs plan
 *   node marketing/publisher/linkedin.mjs upload --next --dry
 *   node marketing/publisher/linkedin.mjs upload --next --url https://.../clip.mp4
 *   node marketing/publisher/linkedin.mjs upload --date 2026-10-31
 *   node marketing/publisher/linkedin.mjs stats
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const factoryOut = path.resolve(here, "..", "factory", "out");
const calendarFile = path.join(factoryOut, "content-calendar.csv");
const uploadsFile = path.join(here, ".li-uploads.json");
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
const TOKEN = ENV.LINKEDIN_ACCESS_TOKEN;
const ORG_ID_RAW = ENV.LINKEDIN_ORG_ID;
const API_VERSION = ENV.LINKEDIN_API_VERSION || "202401";
const PUBLIC_BASE = (ENV.LINKEDIN_PUBLIC_BASE_URL || "").replace(/\/$/, "");
const BASE = "https://api.linkedin.com/v2";

const LI_PLATFORMS = ["LinkedIn"];

const args = process.argv.slice(2);
const command = args[0] || "plan";
const has = (f) => args.includes("--" + f);
const valueOf = (f) => {
  const i = args.indexOf("--" + f);
  return i >= 0 ? args[i + 1] : undefined;
};

/** Normalise the Company Page id to a full urn whether a bare number or a urn was given. */
function orgUrn() {
  if (!ORG_ID_RAW) return "";
  return ORG_ID_RAW.startsWith("urn:") ? ORG_ID_RAW : `urn:li:organization:${ORG_ID_RAW}`;
}

function requireCreds() {
  if (!TOKEN || !ORG_ID_RAW) {
    console.error(`Missing credentials. Put these in ${path.relative(process.cwd(), envFile)}:\n`);
    console.error("  LINKEDIN_ACCESS_TOKEN=...   # w_organization_social + r_organization_social");
    console.error("  LINKEDIN_ORG_ID=144019338   # numeric Page id from the admin URL");
    console.error("  LINKEDIN_PUBLIC_BASE_URL=https://...# where rendered clips are served");
    console.error("  # optional: LINKEDIN_API_VERSION=202401");
    process.exit(1);
  }
}

function headers(extra = {}) {
  return {
    Authorization: `Bearer ${TOKEN}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": API_VERSION,
    ...extra,
  };
}

async function jsonCall(pathname, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: headers(body ? { "Content-Type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 200) }; }
  if (!res.ok) {
    throw new Error(`LinkedIn API ${res.status}: ${json?.message || json?.error?.message || text.slice(0, 200)}`);
  }
  return json;
}

async function cmdWhoami() {
  requireCreds();
  const orgs = await jsonCall(
    `/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(id,localizedName,vanityName)))`
  );
  const els = orgs.elements || [];
  console.log(`Token administers ${els.length} organization(s):`);
  for (const e of els) {
    const o = e["organization~"] || {};
    console.log(`  ${o.localizedName || "?"}  (id ${o.id || "?"}${o.vanityName ? `, /${o.vanityName}` : ""})`);
  }
  console.log(`\nConfigured target: ${orgUrn() || "(none)"}`);
  console.log(`API version: ${API_VERSION}`);
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
  return parseCsv(readFileSync(calendarFile, "utf8")).filter((r) => LI_PLATFORMS.includes(r.platform));
}

const key = (r) => `${r.date} ${r.time} ${r.platform}`;

function cmdPlan() {
  const rows = calendar();
  const uploads = loadJson();
  const now = Date.now();
  console.log(`LinkedIn slots: ${rows.length}\n`);
  for (const r of rows) {
    const done = uploads[key(r)];
    const due = r.utc ? Date.parse(r.utc) <= now : true;
    const mark = done ? "[posted]" : due ? "[due]" : "[future]";
    console.log(`  ${mark} ${r.date} ${r.time}  ${r.platform.padEnd(9)}  ${r.file}  "${r.hook}"`);
  }
}

// --- uploads ----------------------------------------------------------------

function loadJson() {
  return existsSync(uploadsFile) ? JSON.parse(readFileSync(uploadsFile, "utf8")) : {};
}
function saveUploads(u) {
  writeFileSync(uploadsFile, JSON.stringify(u, null, 2) + "\n");
}

function sourceFile(r) {
  const explicit = valueOf("file");
  return path.join(factoryOut, explicit || r.file);
}

/**
 * Video post flow: initialise the upload, PUT the file to the returned url,
 * then create a UGC post referencing the now-populated video urn.
 */
async function publishVideo({ file, commentary }) {
  const owner = orgUrn();
  const init = await jsonCall("/assets?action=registerUpload", {
    method: "POST",
    body: {
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-video"],
        owner,
        serviceRelationships: [
          { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
        ],
      },
    },
  });
  const value = init.value || {};
  const uploadUrl = value.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
  const asset = value.asset;
  if (!uploadUrl || !asset) throw new Error("LinkedIn did not return an uploadUrl/asset");

  const buf = readFileSync(file);
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/octet-stream" },
    body: buf,
  });
  if (!put.ok) {
    const txt = await put.text().catch(() => "");
    throw new Error(`LinkedIn binary upload ${put.status}: ${txt.slice(0, 200)}`);
  }

  const post = await jsonCall("/ugcPosts", {
    method: "POST",
    body: {
      author: owner,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: commentary },
          shareMediaCategory: "VIDEO",
          media: [{ status: "READY", media: asset, title: { text: "CreatorOS" } }],
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    },
  });
  return post.id;
}

async function cmdUpload() {
  requireCreds();
  const rows = calendar();
  if (!rows.length) throw new Error("No LinkedIn rows in the calendar.");
  const uploads = loadJson();
  const dry = has("dry");
  const now = Date.now();

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

  console.log(`${dry ? "[dry] " : ""}${targets.length} post(s):\n`);
  const failures = [];
  for (const r of targets) {
    const file = sourceFile(r);
    if (!existsSync(file)) {
      console.log(`  SKIP ${path.basename(file)} (render it first: node marketing/factory/generate.mjs)`);
      continue;
    }
    if (dry) {
      console.log(`  would post ${path.basename(file)}  ${r.date} ${r.time}  as ${orgUrn()}\n    "${r.hook}"`);
      continue;
    }
    try {
      const id = await publishVideo({ file, commentary: r.caption || r.hook });
      const urlId = String(id).replace(/^urn:li:share:/, "").replace(/^urn:li:ugcPost:/, "");
      uploads[key(r)] = { id, url: `https://www.linkedin.com/feed/update/${id}/`, uploadedAt: new Date().toISOString() };
      saveUploads(uploads);
      console.log(`  posted ${r.date} ${r.time} -> ${uploads[key(r)].url}`);
      void urlId;
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
  if (!rec) throw new Error("Provide --id <ugcPostUrn> that exists in .li-uploads.json");
  const dry = has("dry");
  if (dry) {
    console.log(`would delete LinkedIn post ${idArg}  (${rec[0]})`);
    return;
  }
  await jsonCall(`/ugcPosts/${encodeURIComponent(idArg)}`, { method: "DELETE" });
  delete uploads[rec[0]];
  saveUploads(uploads);
  console.log(`deleted ${idArg}  (${rec[0]})`);
}

async function cmdStats() {
  requireCreds();
  const org = await jsonCall(`/organizations/${encodeURIComponent(orgUrn())}?projection=(id,localizedName,vanityName)`);
  console.log(`Page: ${org.localizedName || "?"}  (${org.id || orgUrn()})`);
  const followers = await jsonCall(
    `/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn())}`
  );
  const el = (followers.elements || [])[0] || {};
  const fs = el.followerCounts || {};
  const total = Object.values(fs.organicFollowerCount ?? {}).reduce((a, b) => a + Number(b || 0), 0);
  console.log(`  Followers (organic, by associationType): ${JSON.stringify(fs.organicFollowerCount || {})}`);
  void total;
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
