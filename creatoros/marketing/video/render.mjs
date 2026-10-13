import { chromium } from "playwright";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const outDir = path.join(repoRoot, "marketing");

const FPS = 30;
const DURATION = 10;
const TOTAL = FPS * DURATION;

const VARIANTS = [
  { key: "16x9", w: 1920, h: 1080, ts: 1.0, sFrac: 0.615, poster: 6.9 },
  { key: "1x1", w: 1080, h: 1080, ts: 1.15, sFrac: 0.92, poster: 6.9 },
  { key: "9x16", w: 1080, h: 1920, ts: 1.5, sFrac: 0.94, poster: 6.9 },
];

const htmlFile = path.join(here, "animation.html");
const musicFile = path.join(here, "music.m4a");

const wanted = process.argv.slice(2);
const selected = wanted.length ? VARIANTS.filter((v) => wanted.includes(v.key)) : VARIANTS;

function runFfmpeg(args) {
  const r = spawnSync("ffmpeg", args, { stdio: ["ignore", "ignore", "inherit"] });
  if (r.error) throw new Error("ffmpeg not found on PATH: " + r.error.message);
  if (r.status !== 0) throw new Error("ffmpeg exited with code " + r.status);
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

async function renderVariant(page, v) {
  const framesDir = path.join(here, `.frames-${v.key}`);
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });

  const url = pathToFileURL(htmlFile).href + `?w=${v.w}&h=${v.h}&ts=${v.ts}&sFrac=${v.sFrac}`;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));

  console.log(`[${v.key}] rendering ${TOTAL} frames @ ${v.w}x${v.h}...`);
  for (let i = 0; i < TOTAL; i++) {
    await page.evaluate((tt) => window.__seek(tt), i / FPS);
    await page.screenshot({ path: path.join(framesDir, `frame_${String(i + 1).padStart(4, "0")}.png`), type: "png" });
    if (i % 45 === 0) process.stdout.write(`\r  [${v.key}] ${i}/${TOTAL}`);
  }
  console.log(`\r  [${v.key}] ${TOTAL}/${TOTAL} frames`);

  await page.evaluate((tt) => window.__seek(tt), v.poster);
  await page.screenshot({ path: path.join(outDir, `creatoros-promo-${v.key}-poster.png`), type: "png" });

  console.log(`[${v.key}] encoding + muxing audio...`);
  runFfmpeg([
    "-y",
    "-framerate", String(FPS), "-start_number", "1", "-i", path.join(framesDir, "frame_%04d.png"),
    "-i", musicFile,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k",
    "-shortest",
    "-movflags", "+faststart",
    path.join(outDir, `creatoros-promo-${v.key}.mp4`),
  ]);

  rmSync(framesDir, { recursive: true, force: true });
  console.log(`[${v.key}] done -> marketing/creatoros-promo-${v.key}.mp4`);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  buildMusic();

  const browser = await chromium.launch();
  for (const v of selected) {
    const context = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

    await renderVariant(page, v);

    if (errors.length) {
      console.warn(`  [${v.key}] ${errors.length} page error(s):`);
      for (const e of errors.slice(0, 5)) console.warn("    - " + e);
    }
    await context.close();
  }
  await browser.close();
  console.log("\nAll variants rendered.");
}

main().catch((e) => { console.error(e); process.exit(1); });
