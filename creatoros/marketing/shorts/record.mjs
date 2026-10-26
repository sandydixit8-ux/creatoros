// Renders marketing/shorts/etsy-fees-uk.html to a real 1080x1920 MP4.
// Deterministic: each frame is rendered at a fixed timestamp, so the output
// does not depend on machine speed, dropped frames or video-capture timing.
//
// Usage (from creatoros/):
//   node marketing/shorts/record.mjs [pathToVoiceoverFile]
//
// Voiceover: pass a 30s wav to mux. If omitted, the MP4 is silent.

import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const htmlPath = join(here, "etsy-fees-uk.html");
const buildDir = join(here, "build");
const framesDir = join(buildDir, "frames");
const outPath = join(buildDir, "creatoros-etsy-fees-uk.mp4");

const FPS = 25;
const DURATION_S = 30;
const TOTAL_FRAMES = FPS * DURATION_S;
const WIDTH = 1080;
const HEIGHT = 1920;

const audioArg = process.argv[2] ? resolve(process.argv[2]) : null;
if (audioArg && !existsSync(audioArg)) {
  console.error(`Voiceover not found: ${audioArg}`);
  process.exit(1);
}

rmSync(buildDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});

await page.goto(pathToFileURL(htmlPath).href + "?render=1");
await page.waitForFunction(() => typeof window.__setFrame === "function");

for (let f = 0; f < TOTAL_FRAMES; f++) {
  const t = Math.round((f * 1000) / FPS);
  await page.evaluate((ms) => window.__setFrame(ms), t);
  await page.screenshot({
    path: join(framesDir, `f${String(f).padStart(4, "0")}.jpg`),
    type: "jpeg",
    quality: 92,
  });
  if (f % 125 === 0) process.stdout.write(`frame ${f}/${TOTAL_FRAMES}\n`);
}

await browser.close();

const ffArgs = [
  "-y", "-v", "error",
  "-framerate", String(FPS),
  "-i", join(framesDir, "f%04d.jpg"),
  ...(audioArg ? ["-i", audioArg] : []),
  "-c:v", "libx264",
  "-preset", "slow",
  "-crf", "19",
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
  ...(audioArg ? ["-c:a", "aac", "-b:a", "160k", "-shortest"] : []),
  outPath,
];

execFileSync("ffmpeg", ffArgs, { stdio: "inherit", cwd: root });

console.log(`\nWrote ${outPath}`);
