// Usage: node render.mjs [--out out/episode.mp4] [--fps 30] [--stills 0.5,5,12]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const out = resolve(here, arg("out", "out/episode.mp4"));
const fps = +arg("fps", 30);
const stills = arg("stills", "").split(",").filter(Boolean).map(Number);
mkdirSync(dirname(out), { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--force-device-scale-factor=1", "--font-render-hinting=none"],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(pathToFileURL(resolve(here, "index.html")).href + "?render=1");
await page.waitForFunction(() => window.__ready === true);
const duration = await page.evaluate(() => window.__duration);
const seek = (t) => page.evaluate((x) => window.__seek(x), t);

for (const t of stills) {
  await seek(t);
  await page.screenshot({ path: out.replace(/\.mp4$/, `-t${t}.png`) });
}
if (stills.length) { await browser.close(); process.exit(0); }

const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
const frames = Math.round(duration * fps);
for (let i = 0; i < frames; i++) {
  await seek(i / fps);
  const png = await page.screenshot({ type: "png" });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await seek(0.6);
await page.screenshot({ path: out.replace(/\.mp4$/, "-poster.png") });
await browser.close();
console.log(`wrote ${out} (${frames} frames, ${duration}s)`);
