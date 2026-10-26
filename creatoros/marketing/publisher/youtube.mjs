/**
 * YouTube connector for the CreatorOS content factory (Phase 2).
 *
 * Posts the videos + copy produced by marketing/factory/generate.mjs straight
 * to your channel. Auth is a one-time browser consent; after that the refresh
 * token is reused forever.
 *
 * ONE-TIME SETUP (Google Cloud Console, ~5 min):
 *   1. Create a project, then enable "YouTube Data API v3".
 *   2. OAuth consent screen -> External -> add your Google account as a Test user.
 *   3. Credentials -> Create credentials -> OAuth client ID -> type "Desktop app".
 *   4. Copy the Client ID + Client secret into marketing/publisher/.env :
 *         YOUTUBE_CLIENT_ID=xxxx.apps.googleusercontent.com
 *         YOUTUBE_CLIENT_SECRET=xxxx
 *
 * USAGE:
 *   node marketing/publisher/youtube.mjs auth                 # one-time browser consent
 *   node marketing/publisher/youtube.mjs whoami               # verify the connection
 *   node marketing/publisher/youtube.mjs plan                 # show the upload schedule
 *   node marketing/publisher/youtube.mjs upload --next --dry  # preview next uploads
 *   node marketing/publisher/youtube.mjs upload --next        # upload (private by default)
 *   node marketing/publisher/youtube.mjs upload --all --schedule # auto-publish on calendar date/time
 *   node marketing/publisher/youtube.mjs upload --date 2026-10-16 --privacy unlisted
 *   node marketing/publisher/youtube.mjs test --file creatoros-hook-9x16.mp4 --privacy public
 *   node marketing/publisher/youtube.mjs publish --all --privacy public   # flip already-uploaded videos
 *   node marketing/publisher/youtube.mjs schedule [--limit 3] [--dry]     # set publishAt on existing uploads
 *   node marketing/publisher/youtube.mjs stats
 *   node marketing/publisher/youtube.mjs monitor              # append a views snapshot + delta
 *   node marketing/publisher/youtube.mjs upload --next --lang en
 *
 * Security: the client secret and refresh token live only in this folder and are
 * gitignored. Tokens are never printed to stdout.
 *
 * Note: videos.insert costs 1600 quota units; the free daily quota (10,000) allows
 * ~6 uploads/day per project — plenty for a 1-2 posts/day calendar.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import http from "node:http";
import path from "node:path";
import { exec } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const factoryOut = path.resolve(here, "..", "factory", "out");
const calendarFile = path.join(factoryOut, "content-calendar.csv");
const tokenFile = path.join(here, ".youtube-token.json");
const uploadsFile = path.join(here, ".uploads.json");
const statsFile = path.join(here, ".stats-history.jsonl");
const envFile = path.join(here, ".env");

const YOUTUBE_PLATFORM = "YouTube Shorts";
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];
const AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function loadEnv() {
  const env = { ...process.env };
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}
const ENV = loadEnv();
const CLIENT_ID = ENV.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = ENV.YOUTUBE_CLIENT_SECRET;
const PORT = Number(ENV.YOUTUBE_REDIRECT_PORT || 4571);
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;

const args = process.argv.slice(2);
const command = args[0] || "plan";
const has = (f) => args.includes("--" + f);
const valueOf = (f) => {
  const i = args.indexOf("--" + f);
  return i >= 0 ? args[i + 1] : undefined;
};

function requireClient() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error(`Missing credentials. Put these in ${path.relative(process.cwd(), envFile)}:\n`);
    console.error("  YOUTUBE_CLIENT_ID=xxxx.apps.googleusercontent.com");
    console.error("  YOUTUBE_CLIENT_SECRET=xxxx\n");
    process.exit(1);
  }
}

const loadJson = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};
const saveToken = (t) => writeFileSync(tokenFile, JSON.stringify(t, null, 2) + "\n");

function openBrowser(url) {
  const cmd =
    process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

async function postForm(url, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OAuth error ${res.status}: ${json.error_description || json.error}`);
  return json;
}

async function cmdAuth() {
  requireClient();
  const url = new URL(AUTH_BASE);
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account consent");
  // A Google account can own several channels (a personal one plus brand
  // channels). The chooser defaults to the personal channel and brand channels
  // are only picked by hand, so pin the account when it is known.
  const loginHint = valueOf("login-hint") || ENV.YOUTUBE_LOGIN_HINT;
  if (loginHint) url.searchParams.set("login_hint", loginHint);

  console.log("Opening Google consent in your browser. If it does not open, visit:\n\n" + url.toString() + "\n");

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, REDIRECT_URI);
      if (u.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const c = u.searchParams.get("code");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h2>CreatorOS YouTube connected.</h2><p>You can close this tab.</p>");
      server.close();
      c ? resolve(c) : reject(new Error("No code returned (consent denied?)."));
    });
    server.on("error", reject);
    server.listen(PORT, "127.0.0.1", () => openBrowser(url.toString()));
    setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for consent (5 min)."));
    }, 300000).unref();
  });

  const token = await postForm(TOKEN_URL, {
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });
  if (!token.refresh_token) {
    console.error("No refresh token returned. Revoke prior access at https://myaccount.google.com/permissions and retry.");
    process.exit(1);
  }
  saveToken({
    refresh_token: token.refresh_token,
    access_token: token.access_token,
    expires_at: Date.now() + (token.expires_in - 60) * 1000,
    scope: token.scope,
  });
  console.log("Saved credentials to " + path.relative(process.cwd(), tokenFile));

  // Google's account chooser lists Google accounts; a brand channel has to be
  // selected explicitly. That mismatch is silent, and every subsequent upload
  // lands on the personal channel, so verify and say so loudly.
  const expected = ENV.YOUTUBE_CHANNEL_ID || valueOf("channel");
  try {
    const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { Authorization: "Bearer " + token.access_token },
    });
    const json = await res.json().catch(() => ({}));
    const item = json.items?.[0];
    if (item) {
      console.log(`Connected channel: ${item.snippet?.title} (${item.id})`);
      if (expected && item.id !== expected) {
        console.error(`\nWARNING: wrong channel. Expected ${expected}, authorised ${item.snippet?.title} (${item.id}).`);
        console.error("Every upload would go to that channel. Re-run auth and pick the brand channel,");
        console.error("or set YOUTUBE_LOGIN_HINT to the Google account that owns the intended one.");
      }
    }
  } catch (e) {
    console.error("Could not verify the connected channel:", e instanceof Error ? e.message : e);
  }

  console.log("Verify with: node marketing/publisher/youtube.mjs whoami");
}

async function accessToken() {
  const t = loadJson(tokenFile, null);
  if (!t?.refresh_token) {
    console.error("Not connected yet. Run: node marketing/publisher/youtube.mjs auth");
    process.exit(1);
  }
  if (t.access_token && t.expires_at && Date.now() < t.expires_at) return t.access_token;
  const fresh = await postForm(TOKEN_URL, {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: t.refresh_token,
    grant_type: "refresh_token",
  });
  t.access_token = fresh.access_token;
  t.expires_at = Date.now() + (fresh.expires_in - 60) * 1000;
  saveToken(t);
  return t.access_token;
}

async function cmdWhoami() {
  requireClient();
  const token = await accessToken();
  const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${json.error?.message || ""}`);
  const chs = json.items || [];
  if (!chs.length) throw new Error("No YouTube channel on this Google account.");
  console.log(`Connected as: ${chs[0].snippet.title}`);
  for (const ch of chs) {
    console.log(`  - ${ch.snippet.title}  (${ch.statistics?.videoCount ?? "?"} videos, id ${ch.id})`);
  }
  if (chs.length > 1) console.log("\nMultiple channels found. Re-run auth and pick the CreatorOS one.");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/\r\n/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const data = rows.filter((r) => r.length > 1);
  const [header, ...body] = rows.filter((r) => r.length > 1).length ? rows.filter((r) => r.length > 1) : [[]];
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function calendar() {
  if (!existsSync(calendarFile)) throw new Error("No calendar yet. Run: node marketing/factory/generate.mjs");
  return parseCsv(readFileSync(calendarFile, "utf8"));
}

const rowKey = (r) => `${r.date} ${r.time} ${r.platform}`;

function cmdPlan() {
  const rows = parseCsv(readFileSync(calendarFile, "utf8"));
  const yt = rows.filter((r) => r.platform === YOUTUBE_PLATFORM);
  const uploads = loadJson(uploadsFile, {});
  console.log(`${rows.length} scheduled posts, ${runsLabel(rows)}. YouTube Shorts slots: ${yt.length}\n`);
  for (const r of yt) {
    const done = uploads[`${r.date} ${r.time} ${r.platform}`];
    console.log(`  ${done ? "[uploaded]" : "[ pending ]"} ${r.date} ${r.time}  ${r.file}  "${r.hook}"`);
  }
}
function runsLabel(rows) {
  const dates = [...new Set(rows.map((r) => r.date))];
  return `${dates.length} day(s), ${dates[0]} .. ${dates[dates.length - 1]}`;
}

function tagsFrom(hashtags) {
  return String(hashtags || "")
    .split(/\s+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean);
}

// YouTube search is keyword-driven, so tags lean on what US/UK creators actually
// type ("link in bio", "sell digital products", "creator tools"), not just the
// brand's own hook words.
function buildTags(hashtags) {
  const base = [
    "shorts",
    "creatoros",
    "link in bio",
    "linkinbio",
    "creator tools",
    "creatortools",
    "creator economy",
    "creatoreconomy",
    "how to sell digital products",
    "sell digital products",
    "content creator tips",
    "creator business",
    "all in one creator platform",
    "make money as a creator",
    "online business tools",
  ];
  return [...new Set([...tagsFrom(hashtags), ...base])]
    .map((t) => t.slice(0, 30))
    .slice(0, 15);
}

// A brand suffix on the title keeps the hook readable while adding the one
// keyword a US/UK viewer is most likely to search.
function buildTitle(hook) {
  const clean = String(hook || "").replace(/\s+/g, " ").trim();
  return `${clean} | CreatorOS`.slice(0, 100);
}

// Description leads with the hook, adds a searchable keyword line, then the
// caption, a clear CTA and the campaign link. Hashtags help Shorts discovery.
function buildDescription(row, link) {
  const caption = String(row.caption || "").replace(/\s+/g, " ").trim();
  const hook = String(row.hook || "").trim();
  const keywords = "CreatorOS is the all-in-one creator platform for bio pages, digital products, courses, bookings, email and analytics.";
  return [
    hook,
    "",
    keywords,
    "",
    caption,
    "",
    `Start free — no card required: ${link}`,
  ]
    .filter((line) => line !== undefined)
    .join("\n")
    .slice(0, 5000);
}

function campaignLink(market) {
  const content = (market || "").toLowerCase() === "uk" ? "uk" : "us";
  return `https://usecreatoros.co/?utm_source=youtube&utm_medium=social&utm_campaign=launch_us_uk&utm_content=${content}`;
}

/** RFC3339 timestamp in the machine's local timezone, e.g. 2026-10-16T09:00:00+05:30.
 * YouTube requires this exact format for status.publishAt. */
function localRfc3339(dateStr, timeStr) {
  const d = new Date(`${dateStr}T${timeStr}:00`);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${dateStr}T${timeStr}:00${sign}${hh}:${mm}`;
}

async function uploadVideo(token, file, { title, description, tags, privacy, publishAt, lang }) {
  const metadata = {
    snippet: {
      title: title.slice(0, 100),
      description,
      tags,
      categoryId: "22",
      ...(lang && lang !== "none" ? { defaultLanguage: lang, defaultAudioLanguage: lang } : {}),
    },
    status: {
      privacyStatus: publishAt ? "private" : privacy,
      publishAt: publishAt || undefined,
      selfDeclaredMadeForKids: false,
    },
  };
  const boundary = "creatoros_" + Date.now();
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, readFileSync(file), tail]);
  const res = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Upload failed ${res.status}: ${json.error?.message || ""}`);
  return json;
}

async function cmdUpload() {
  const rows = parseCsv(readFileSync(calendarFile, "utf8")).filter((r) => r.platform === YOUTUBE_PLATFORM);
  if (!rows.length) throw new Error("No YouTube Shorts rows in the calendar.");
  const uploads = loadJson(uploadsFile, {});
  const privacy = valueOf("privacy") || "private";
  const dry = has("dry");
  const date = valueOf("date");
  const schedule = has("schedule");
  const lang = valueOf("lang") || "en";

  let targets;
  if (date) {
    targets = rows.filter((r) => r.date === date);
  } else if (has("all")) {
    targets = rows;
  } else {
    const pendingDates = [...new Set(rows.map((r) => r.date))].filter((d) =>
      rows.some((r) => r.date === d && !uploads[`${r.date} ${r.time} ${r.platform}`]),
    );
    const next = pendingDates[0];
    targets = rows.filter((r) => r.date === next);
  }
  targets = targets.filter((r) => !has("all") || !uploads[`${r.date} ${r.time} ${r.platform}`]);

  if (!targets.length) {
    console.log("Nothing pending to upload.");
    return;
  }

  console.log(
    `${dry ? "DRY RUN - " : ""}${targets.length} upload(s) at ${schedule ? "scheduled" : `privacy="${privacy}"`}:\n`,
  );
  const token = dry ? null : await accessToken();
  for (const r of targets) {
    const file = path.join(factoryOut, r.file);
    const publishAt = schedule ? r.utc || localRfc3339(r.date, r.time) : undefined;
    if (!existsSync(file)) {
      console.log(`  SKIP ${r.file} (render it first: node marketing/factory/generate.mjs)`);
      continue;
    }
    if (dry) {
      console.log(`  would upload ${r.file}  title="${r.hook}"  go-live=${publishAt || `${r.date} ${r.time}`}`);
      continue;
    }
    const created = await uploadVideo(token, file, {
      title: buildTitle(r.hook),
      description: buildDescription(r, campaignLink(r.market)),
      tags: buildTags(r.caption),
      privacy,
      publishAt,
      lang,
    });
    uploads[`${r.date} ${r.time} ${r.platform}`] = {
      videoId: created.id,
      url: `https://youtu.be/${created.id}`,
      privacy,
      uploadedAt: new Date().toISOString(),
    };
    writeFileSync(uploadsFile, JSON.stringify(uploads, null, 2) + "\n");
    console.log(`  uploaded ${r.date} ${r.time} -> https://youtu.be/${created.id} (${privacy})`);
  }
}

async function cmdTest() {
  requireClient();
  const file = valueOf("file") || "creatoros-hook-9x16.mp4";
  const privacy = valueOf("privacy") || "unlisted";
  const title = valueOf("title") || "CreatorOS — test upload";
  const description = valueOf("description") || "Test upload from CreatorOS. Start free at usecreatoros.co";
  const lang = valueOf("lang") || "en";
  const p = path.join(factoryOut, file);
  if (!existsSync(p)) throw new Error("Video not found: " + file + " (run marketing/factory/generate.mjs first)");
  console.log(`Uploading ${file} as ${privacy} (lang=${lang})...`);
  const token = await accessToken();
  const created = await uploadVideo(token, p, {
    title,
    description,
    tags: buildTags("creatoros linkinbio creatortools shorts"),
    privacy,
    lang,
  });
  console.log(`Uploaded: https://youtu.be/${created.id}  (${privacy})`);
}

async function channelVideos(token) {
  const h = { Authorization: `Bearer ${token}` };
  const chJson = await (await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true", { headers: h })).json();
  const ch = chJson.items?.[0];
  const uploads = ch?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error("No uploads playlist found for this channel.");
  const plJson = await (
    await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=25&playlistId=${uploads}`, { headers: h })
  ).json();
  const ids = (plJson.items || []).map((i) => i.contentDetails.videoId).join(",");
  if (!ids) return { channel: ch, videos: [] };
  const vJson = await (
    await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status,contentDetails&id=${ids}`, { headers: h })
  ).json();
  return { channel: ch, videos: vJson.items || [] };
}

async function setPrivacy(token, id, privacy) {
  // A video that already carries a future `publishAt` cannot be promoted straight
  // to public: YouTube treats a public status that still has a scheduling time as
  // "make it public at that time" and leaves it private until then. It also
  // rejects an explicit `publishAt: ""` / null as an invalid scheduled time, and
  // omitting the field simply keeps the old value. The one path that clears the
  // schedule is cycling through `unlisted`, after which `public` takes effect now.
  const put = async (status) => {
    const res = await fetch("https://www.googleapis.com/youtube/v3/videos?part=status", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: { ...status, selfDeclaredMadeForKids: false } }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Update failed ${res.status}: ${json.error?.message || ""}`);
    return json;
  };

  if (privacy === "public") {
    const current = await fetch("https://www.googleapis.com/youtube/v3/videos?part=status&id=" + id, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .catch(() => ({}));
    if (current.items?.[0]?.status?.publishAt) {
      await put({ privacyStatus: "unlisted" });
    }
  }
  return put({ privacyStatus: privacy });
}

async function setSchedule(token, id, publishAt) {
  const res = await fetch("https://www.googleapis.com/youtube/v3/videos?part=status", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id, status: { privacyStatus: "private", publishAt, selfDeclaredMadeForKids: false } }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Schedule failed ${res.status}: ${json.error?.message || ""}`);
  return json;
}

/** Replace a video's snippet (title, description, tags) without re-uploading. */
async function setSnippet(token, id, { title, description, tags, lang }) {
  const res = await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      snippet: {
        title: title.slice(0, 100),
        description,
        tags,
        categoryId: "22",
        ...(lang && lang !== "none" ? { defaultLanguage: lang, defaultAudioLanguage: lang } : {}),
      },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Snippet update failed ${res.status}: ${json.error?.message || ""}`);
  return json;
}

/**
 * Refresh title/description/tags on videos ALREADY on the channel so the new
 * search-optimised metadata reaches existing Shorts too. Matches calendar rows
 * to channel videos by normalised title (with or without the brand suffix).
 */
async function cmdUpdate() {
  requireClient();
  const token = await accessToken();
  const rows = parseCsv(readFileSync(calendarFile, "utf8")).filter((r) => r.platform === YOUTUBE_PLATFORM);
  const { videos } = await channelVideos(token);
  const byTitle = new Map((videos || []).map((v) => [normTitle(v.snippet.title), v]));
  const dry = has("dry");
  const lang = valueOf("lang") || "en";

  console.log(`${dry ? "[dry] " : ""}Updating metadata for ${rows.length} calendar slot(s):\n`);
  for (const r of rows) {
    const v = byTitle.get(normTitle(r.hook)) || byTitle.get(normTitle(buildTitle(r.hook)));
    if (!v) {
      console.log(`  [skip] no channel video matches "${r.hook}"`);
      continue;
    }
    const title = buildTitle(r.hook);
    const description = buildDescription(r, campaignLink(r.market));
    const tags = buildTags(r.caption);
    if (dry) {
      console.log(`  would update ${v.id}  title="${title}"`);
      continue;
    }
    await setSnippet(token, v.id, { title, description, tags, lang });
    console.log(`  updated ${v.id}  title="${title}"  (${v.status?.privacyStatus})`);
  }
}

const normTitle = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Schedule videos that are ALREADY uploaded (recorded in .uploads.json) instead
 * of uploading them again.
 *
 * `upload --schedule` re-uploads the file and costs quota; when a video for the
 * same hook is already on the channel this matches it by title and sets its
 * `publishAt` from the calendar slot. `--limit N` schedules only the next N
 * slots; `--dry` previews without touching the channel.
 */
async function cmdSchedule() {
  requireClient();
  const token = await accessToken();
  const uploads = loadJson(uploadsFile, {});
  const ids = Object.values(uploads).map((v) => v.videoId);
  if (!ids.length) throw new Error("No uploaded videos recorded in .uploads.json");
  const vJson = await (
    await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${ids.join(",")}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  const byTitle = new Map((vJson.items || []).map((v) => [normTitle(v.snippet.title), v]));

  const rows = parseCsv(readFileSync(calendarFile, "utf8")).filter((r) => r.platform === YOUTUBE_PLATFORM);
  const limit = Number(valueOf("limit") || 0);
  const targets = limit > 0 ? rows.slice(0, limit) : rows;
  const dry = has("dry");

  console.log(`${dry ? "[dry] " : ""}Scheduling ${targets.length} existing video(s):\n`);
  for (const r of targets) {
    const v = byTitle.get(normTitle(r.hook));
    const at = r.utc || localRfc3339(r.date, r.time);
    if (!v) {
      console.log(`  [skip] no uploaded video matches "${r.hook}"`);
      continue;
    }
    if (v.status?.privacyStatus === "public") {
      console.log(`  [skip] already public, left live: ${v.id}  ${r.hook}`);
      continue;
    }
    if (dry) {
      console.log(`  ${v.id}  ${r.date} ${r.time}  (${v.status?.privacyStatus} -> private @ ${at})  ${r.hook}`);
      continue;
    }
    const json = await setSchedule(token, v.id, at);
    console.log(`  ${v.id}  scheduled @ ${json.status?.publishAt || at}  (${json.status?.privacyStatus})  ${r.hook}`);
  }
  console.log("\nDone.");
}

/**
 * Change the privacy of videos already uploaded (recorded in .uploads.json).
 *
 * `upload` only sets privacy at upload time, so a video parked as private could
 * not be promoted without re-uploading it (costing quota and duplicating it).
 * This flips the existing video instead. Targets: --all | --date YYYY-MM-DD |
 * --id <videoId>; with none given, only those not already at --privacy.
 */
async function cmdPublish() {
  requireClient();
  const privacy = valueOf("privacy") || "public";
  if (!["public", "unlisted", "private"].includes(privacy)) {
    throw new Error("--privacy must be public | unlisted | private");
  }
  const token = await accessToken();
  const uploads = loadJson(uploadsFile, {});
  const entries = Object.entries(uploads);
  const dry = has("dry");
  const id = valueOf("id");
  const date = valueOf("date");
  let targets;
  if (id) targets = entries.filter(([, v]) => v.videoId === id);
  else if (date) targets = entries.filter(([k]) => k.startsWith(date));
  else if (has("all")) targets = entries;
  else targets = entries.filter(([, v]) => v.privacy !== privacy);
  if (!targets.length) {
    console.log("Nothing to publish.");
    return;
  }
  console.log(`${dry ? "[dry] " : ""}Setting privacy=${privacy} on ${targets.length} video(s):\n`);
  for (const [key, v] of targets) {
    if (dry) {
      console.log(`  ${v.videoId}  ${key}  (${v.privacy} -> ${privacy})`);
      continue;
    }
    const json = await setPrivacy(token, v.videoId, privacy);
    v.privacy = privacy;
    v.updatedAt = new Date().toISOString();
    console.log(`  ${v.videoId}  ${key}  -> ${json.status?.privacyStatus || privacy}`);
  }
  if (!dry) writeFileSync(uploadsFile, JSON.stringify(uploads, null, 2) + "\n");
  console.log("\nDone.");
}

/**
 * Delete videos already uploaded (recorded in .uploads.json).
 *
 * Used when a video was uploaded from a superseded render (e.g. before the
 * hook text was burned in) and would otherwise linger as a duplicate. Targets:
 * --id <videoId> (repeatable via comma) | --all. `--dry` previews.
 */
async function cmdDelete() {
  requireClient();
  const token = await accessToken();
  const uploads = loadJson(uploadsFile, {});
  const dry = has("dry");
  const idArg = valueOf("id");
  const ids = idArg
    ? idArg.split(",").map((s) => s.trim()).filter(Boolean)
    : has("all")
      ? Object.values(uploads).map((v) => v.videoId)
      : [];
  if (!ids.length) throw new Error("Provide --id <videoId[,videoId]> or --all");

  console.log(`${dry ? "[dry] " : ""}Deleting ${ids.length} video(s):\n`);
  for (const vid of ids) {
    const rec = Object.entries(uploads).find(([, v]) => v.videoId === vid);
    const label = rec ? `${vid}  ${rec[1].title || ""}  (${rec[0]})` : vid;
    if (dry) {
      console.log(`  would delete ${label}`);
      continue;
    }
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${vid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      console.log(`  deleted ${label}`);
      if (rec) delete uploads[rec[0]];
    } else {
      const j = await res.json().catch(() => ({}));
      console.log(`  FAILED ${label}: ${res.status} ${j.error?.message || ""}`);
    }
  }
  if (!dry) writeFileSync(uploadsFile, JSON.stringify(uploads, null, 2) + "\n");
  console.log("\nDone.");
}

async function cmdStats() {
  requireClient();
  const token = await accessToken();
  const { channel, videos } = await channelVideos(token);
  console.log(`Recent uploads for ${channel.snippet.title}:\n`);
  for (const v of videos) {
    const s = v.statistics || {};
    const secs = (v.contentDetails?.duration || "").replace(/^PT/, "").toLowerCase();
    console.log(
      `  ${(v.status?.privacyStatus || "").padEnd(8)} ${String(s.viewCount || 0).padStart(6)} views  ` +
        `${String(s.likeCount || 0).padStart(4)} likes  ${String(s.commentCount || 0).padStart(3)} comments  ` +
        `[${secs}]  ${v.snippet.title}`,
    );
  }
  console.log("\nAudience geography/demographics: YouTube Studio -> Analytics -> Audience.");
}

function loadSnapshots() {
  try {
    return readFileSync(statsFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

async function cmdMonitor() {
  requireClient();
  const token = await accessToken();
  const { channel, videos } = await channelVideos(token);
  const snaps = loadSnapshots();
  const prevViews = snaps.length ? snaps[snaps.length - 1].views || {} : {};
  const views = {};
  for (const v of videos) views[v.id] = Number(v.statistics?.viewCount || 0);
  appendFileSync(statsFile, JSON.stringify({ at: new Date().toISOString(), channel: channel.snippet.title, views }) + "\n");

  const total = Object.values(views).reduce((a, b) => a + b, 0);
  const prevTotal = Object.values(prevViews).reduce((a, b) => a + b, 0);
  console.log(`[${new Date().toISOString()}] ${channel.snippet.title}: ${total} total views (+${total - prevTotal} since last check)\n`);
  for (const v of videos) {
    const delta = views[v.id] - (prevViews[v.id] ?? views[v.id]);
    console.log(`  ${(v.status?.privacyStatus || "").padEnd(8)} ${String(views[v.id]).padStart(6)} (+${delta})  ${v.snippet.title}`);
  }
  console.log(`\n${snaps.length + 1} snapshot(s) saved to ${path.relative(process.cwd(), statsFile)}`);
}

async function cmdBackfillLang() {
  requireClient();
  const token = await accessToken();
  const lang = valueOf("lang") || "en";
  const { videos } = await channelVideos(token);
  let n = 0;
  for (const v of videos) {
    const sn = v.snippet || {};
    if (sn.defaultLanguage === lang) continue;
    const body = {
      id: v.id,
      snippet: {
        title: sn.title,
        description: sn.description,
        categoryId: sn.categoryId || "22",
        tags: sn.tags || [],
        defaultLanguage: lang,
        defaultAudioLanguage: lang,
      },
    };
    const res = await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      console.log(`  FAILED ${v.id}: ${j.error?.message || res.status}`);
      continue;
    }
    console.log(`  set lang=${lang} on ${v.id}  ${sn.title}`);
    n++;
  }
  console.log(`\nDone. Updated ${n} video(s).`);
}

async function main() {
  if (command === "auth") return cmdAuth();
  if (command === "whoami") return cmdWhoami();
  if (command === "plan") return cmdPlan();
  if (command === "upload") return cmdUpload();
  if (command === "publish") return cmdPublish();
  if (command === "schedule") return cmdSchedule();
  if (command === "delete") return cmdDelete();
  if (command === "stats") return cmdStats();
  if (command === "monitor") return cmdMonitor();
  if (command === "backfill-lang") return cmdBackfillLang();
  if (command === "update") return cmdUpdate();
  if (command === "test") return cmdTest();
  console.error("Unknown command: " + command);
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
