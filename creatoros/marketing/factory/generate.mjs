/**
 * CreatorOS content factory (Phase 1 automation).
 *
 * One command produces a ready-to-publish marketing kit with NO external API keys:
 *   - renders every video cut x aspect ratio (6s hook / 10s full / 15s teaser)
 *   - generates US + UK hook / caption / hashtag variants
 *   - writes a 14-day posting calendar + manifest
 *
 * Usage:
 *   node marketing/factory/generate.mjs            # default matrix (7 videos)
 *   node marketing/factory/generate.mjs --all       # every cut x ratio (9 videos)
 *   node marketing/factory/generate.mjs --dry       # copy + calendar only, no render
 *   node marketing/factory/generate.mjs hook        # only the hook cut (all ratios)
 *   node marketing/factory/generate.mjs 9x16        # only the vertical ratio (all cuts)
 *   node marketing/factory/generate.mjs hook:9x16   # exactly one video
 *
 * Output: marketing/factory/out/
 */
import { chromium } from "playwright";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const htmlFile = path.join(repoRoot, "marketing", "video", "animation.html");
const musicFile = path.join(repoRoot, "marketing", "video", "music.m4a");
const outDir = path.join(here, "out");
const framesRoot = path.join(outDir, ".frames");
const FPS = 30;

const RATIOS = {
  "16x9": { w: 1920, h: 1080, ts: 1.0, sFrac: 0.615 },
  "1x1": { w: 1080, h: 1080, ts: 1.15, sFrac: 0.92 },
  "9x16": { w: 1080, h: 1920, ts: 1.5, sFrac: 0.94 },
};

const CUTS = {
  hook: { dur: 6, offset: 3.0, speed: 1.0 },
  full: { dur: 10, offset: 0, speed: 1.0 },
  teaser: { dur: 15, offset: 0, speed: 10 / 15 },
};

const DEFAULT_MATRIX = [
  ["hook", "16x9"], ["hook", "1x1"], ["hook", "9x16"],
  ["full", "16x9"], ["full", "1x1"], ["full", "9x16"],
  ["teaser", "9x16"],
];

const HOOKS = {
  us: [
    "Stop paying for 9 different tools.",
    "Linktree + Kajabi + Calendly + Mailchimp — replaced.",
    "Your entire creator business. One link.",
    "Turn followers into customers — without the tool chaos.",
  ],
  uk: [
    "One workspace for your whole creator business.",
    "Nine tools. One tab. Zero chaos.",
    "Your bio, store, bookings and courses — in one place.",
    "Spend less time on tools. More time creating.",
  ],
};

const CAPTIONS = {
  us: [
    "Bio pages, store, courses, bookings, email and analytics in ONE place. Start free — no card required.",
    "The all-in-one OS for creators. Replace your stack and start selling today. Free to start, upgrade when you grow.",
    "One link for your bio, products, courses and bookings — plus the analytics to see what actually converts.",
  ],
  uk: [
    "One workspace for your bio, store, bookings and courses. Start free — no card required.",
    "Stop juggling tools. CreatorOS puts everything a creator business needs in one place. Free to start.",
    "Everything you need to create, grow and sell — in a single, tidy platform.",
  ],
};

const TAGS = {
  us: ["#creatoreconomy", "#linkinbio", "#creatortools", "#sidehustle", "#contentcreator", "#smallbusiness"],
  uk: ["#ukcreators", "#creatoreconomy", "#linkinbio", "#smallbusinessuk", "#contentcreator", "#sidehustle"],
};

const CTA = "Start free — no card required → usecreatoros.co";

const PLATFORMS = {
  us: ["Instagram Reels", "TikTok", "YouTube Shorts", "Facebook Reels", "Facebook Feed", "LinkedIn"],
  uk: ["Instagram Reels", "TikTok", "YouTube Shorts", "Facebook Reels", "Facebook Feed", "X"],
};

const VERTICAL = new Set(["Instagram Reels", "TikTok", "YouTube Shorts", "Facebook Reels"]);

const MARKET_TZ = { us: "America/New_York", uk: "Europe/London" };
const PLATFORM_SLUG = {
  "Instagram Reels": "instagram",
  TikTok: "tiktok",
  "YouTube Shorts": "youtube",
  "Facebook Reels": "facebook",
  "Facebook Feed": "facebook",
  LinkedIn: "linkedin",
  X: "x",
};

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
  return `https://usecreatoros.co/?utm_source=${slug}&utm_medium=social&utm_campaign=launch_us_uk&utm_content=${market}`;
}

function withUtm(text, url) {
  if (text.includes("utm_source=")) return text;
  return text.replace(/https?:\/\/(?=usecreatoros\.co)/g, "").replace(/usecreatoros\.co\/?/g, url);
}

const hasFlag = (f) => process.argv.includes("--" + f);
const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));

let seed = 1337;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length) % arr.length];

const HOOK_ASPECTS = new Set(["9x16", "1x1"]);
const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
const videoFile = (cut, aspect, hook) =>
  cut === "hook" && HOOK_ASPECTS.has(aspect)
    ? `creatoros-hook-${aspect}-${slugify(hook)}.mp4`
    : `creatoros-${cut}-${aspect}.mp4`;

function runFfmpeg(args) {
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (r.error) throw new Error("ffmpeg not found on PATH: " + r.error.message);
  if (r.status !== 0) throw new Error("ffmpeg failed:\n" + (r.stderr || "").split("\n").slice(-12).join("\n"));
}

function buildMusic() {
  if (existsSync(musicFile)) return;
  console.log("Generating royalty-free synthesized music bed...");
  runFfmpeg([
    "-y",
    "-f", "lavfi", "-i", "sine=frequency=110:duration=10",
    "-f", "lavfi", "-i", "sine=frequency=164.81:duration=10",
    "-f", "lavfi", "-i", "sine=frequency=220:duration=10",
    "-f", "lavfi", "-i", "sine=frequency=277.18:duration=10",
    "-f", "lavfi", "-i", "sine=frequency=329.63:duration=10",
    "-filter_complex",
    "[0]volume=0.5[a0];[1]volume=0.32[a1];[2]volume=0.34[a2];[3]volume=0.26[a3];[4]volume=0.22[a4];" +
      "[a0][a1][a2][a3][a4]amix=inputs=5:normalize=0,volume=0.4,tremolo=f=0.15:d=0.28,lowpass=f=2200," +
      "afade=t=in:st=0:d=1.2,afade=t=out:st=8.3:d=1.7,aformat=channel_layouts=stereo",
    "-c:a", "aac", "-b:a", "192k",
    musicFile,
  ]);
}

async function renderVideo(page, cutKey, ratio, hook) {
  const cut = CUTS[cutKey];
  const r = RATIOS[ratio];
  const suffix = hook ? "-" + slugify(hook) : "";
  const frames = Math.round(cut.dur * FPS);
  const frameDir = path.join(framesRoot, `${cutKey}-${ratio}${suffix}`);
  rmSync(frameDir, { recursive: true, force: true });
  mkdirSync(frameDir, { recursive: true });

  const qs = new URLSearchParams({
    w: String(RATIOS[ratio].w),
    h: String(RATIOS[ratio].h),
    ts: String(r.ts),
    sFrac: String(r.sFrac),
    offset: String(cut.offset),
    speed: String(cut.speed),
  });
  if (hook) qs.set("hook", hook);
  await page.setViewportSize({ width: r.w, height: r.h });
  await page.goto(pathToFileURL(htmlFile).href + "?" + qs.toString(), { waitUntil: "load" });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));

  console.log(`  rendering ${cutKey} / ${ratio}${suffix}  (${cut.dur}s, ${frames} frames)`);
  for (let i = 0; i < cut.dur * FPS; i++) {
    await page.evaluate((tt) => window.__seek(tt), i / FPS);
    await page.screenshot({
      path: path.join(framesRoot, `${cutKey}-${ratio}${suffix}`, `f_${String(i + 1).padStart(4, "0")}.png`),
      type: "png",
    });
  }

  const posterAt = Math.round(cut.dur * FPS * 0.7) / FPS;
  await page.evaluate((tt) => window.__seek(tt), posterAt);
  await page.screenshot({ path: path.join(outDir, `creatoros-${cutKey}-${ratio}${suffix}-poster.png`), type: "png" });

  const tmpVideo = path.join(outDir, `.${cutKey}-${ratio}${suffix}.silent.mp4`);
  const finalVideo = path.join(outDir, `creatoros-${cutKey}-${ratio}${suffix}.mp4`);
  const pattern = path.join(framesRoot, `${cutKey}-${ratio}${suffix}`, "f_%04d.png");
  runFfmpeg([
    "-y", "-framerate", String(FPS), "-start_number", "1", "-i", pattern,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", tmpVideo,
  ]);
  runFfmpeg([
    "-y", "-i", tmpVideo,
    "-stream_loop", "-1", "-i", musicFile,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    "-shortest", "-movflags", "+faststart", finalVideo,
  ]);
  rmSync(tmpVideo, { force: true });
  return { cut: cutKey, ratio, hook: hook || undefined, dur: cut.dur, w: r.w, h: r.h, file: path.basename(finalVideo) };
}

function buildCopy() {
  const posts = [];
  for (const market of ["us", "uk"]) {
    const tags = TAGS[market];
    HOOKS[market].forEach((hook, i) => {
      const caption = CAPTIONS[market][i % CAPTIONS[market].length];
      posts.push({
        market,
        hook,
        caption,
        hashtags: tags.join(" "),
        cta: CTA,
        text: `${hook}\n\n${caption}\n\n${CTA}\n\n${tags.join(" ")}`,
      });
    });
  }
  return posts;
}

function aspectFor(platform) {
  return VERTICAL.has(platform) ? "9x16" : "1x1";
}

function cutFor(platform) {
  return VERTICAL.has(platform) ? "hook" : "full";
}

function buildCalendar(posts, available) {
  const rows = [];
  const start = new Date();
  start.setDate(start.getDate() + 1);
  const times = ["09:00", "18:30"];
  let marketToggle = 0;
  const perMarket = { us: 0, uk: 0 };
  for (let d = 0; d < 14; d++) {
    const date = new Date(start);
    date.setDate(start.getDate() + d);
    const iso = date.toISOString().slice(0, 10);
    for (let s = 0; s < times.length; s++) {
      const market = marketToggle++ % 2 === 0 ? "us" : "uk";
      const platform = pick(PLATFORMS[market]);
      let aspect = aspectFor(platform);
      let cut = cutFor(platform);
      if (!available.has(`${cut}:${aspect}`)) {
        const fallback = [...available].find((k) => k.endsWith(":" + aspect)) || [...available][0];
        [cut, aspect] = fallback.split(":");
      }
      const marketPosts = posts.filter((p) => p.market === market);
      const post = marketPosts[perMarket[market]++ % marketPosts.length];
      const tz = MARKET_TZ[market];
      rows.push({
        date: iso,
        time: times[s],
        tz,
        market: market.toUpperCase(),
        platform,
        aspect,
        cut,
        file: videoFile(cut, aspect, post.hook),
        hook: post.hook,
        caption: withUtm(post.text, utmUrl(market, platform)),
        utc: localToUtc(iso, times[s], tz).toISOString(),
      });
    }
  }
  return rows;
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows) {
  const cols = ["date", "time", "tz", "market", "platform", "aspect", "cut", "file", "hook", "caption", "utc"];
  return [cols.join(",")]
    .concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(",")))
    .join("\n") + "\n";
}

function resolveMatrix() {
  let matrix = hasFlag("all")
    ? Object.keys(CUTS).flatMap((c) => Object.keys(RATIOS).map((r) => [c, r]))
    : DEFAULT_MATRIX;
  if (positional.length) {
    const filtered = matrix.filter(([c, r]) => positional.some((p) => p === c || p === r || p === `${c}:${r}`));
    matrix = filtered.length
      ? filtered
      : positional
          .map((p) => (p.includes(":") ? p.split(":") : null))
          .filter((x) => x && CUTS[x[0]] && RATIOS[x[1]]);
  }
  return matrix;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const matrix = resolveMatrix();
  const dry = hasFlag("dry");
  const posts = buildCopy();
  const available = new Set(matrix.map(([c, r]) => `${c}:${r}`));

  const videos = [];
  if (!dry) {
    buildMusic();
    const browser = await chromium.launch();
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    try {
      for (const [cut, ratio] of matrix) {
        if (cut === "hook" && HOOK_ASPECTS.has(ratio)) {
          for (const market of ["us", "uk"]) {
            for (const hook of HOOKS[market]) {
              videos.push(await renderVideo(page, cut, ratio, hook));
            }
          }
        } else {
          videos.push(await renderVideo(page, cut, ratio));
        }
      }
    } finally {
      await browser.close();
      rmSync(framesRoot, { recursive: true, force: true });
    }
  }

  const calendar = buildCalendar(posts, available);
  writeFileSync(path.join(outDir, "captions.json"), JSON.stringify(posts, null, 2) + "\n");
  writeFileSync(path.join(outDir, "content-calendar.csv"), toCsv(calendar));
  writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), dryRun: dry, videos, posts: posts.length, calendarRows: calendar.length },
      null,
      2,
    ) + "\n",
  );

  console.log(`\nDone. ${videos.length} video(s), ${posts.length} copy variants, ${calendar.length} calendar rows.`);
  console.log(`Output: ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
