#!/usr/bin/env node
/*
 * رندر پست موشن اینستاگرام فوتبالیکا از روی فایل JSON اپیزود.
 *
 *   node motion/render.cjs motion/episodes/ep21.json
 *   node motion/render.cjs motion/episodes/ep21.json --out out/ep21.mp4 --fps 30 --audio music.mp3
 *
 * خروجی: ویدئوی MP4 (H.264، ۱۰۸۰×۱۳۵۰، مناسب پست ۴:۵ اینستاگرام) + تصویر کاور JPG.
 * قالب (template.html) کاملاً بر اساس زمان t رندر می‌شود؛ پس هر فریم دقیق و تکرارپذیر است.
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function loadPlaywright() {
  try { return require("playwright"); } catch (_) {}
  // Fallback for environments with a global install
  const globalRoot = require("child_process").execSync("npm root -g").toString().trim();
  return require(path.join(globalRoot, "playwright"));
}

function parseArgs(argv) {
  const args = { fps: 30, quality: 92 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i];
    else if (a === "--fps") args.fps = Number(argv[++i]);
    else if (a === "--audio") args.audio = argv[++i];
    else if (a === "--cover-at") args.coverAt = Number(argv[++i]);
    else if (a === "--frames") args.frames = argv[++i]; // debug: comma separated seconds → PNGs
    else rest.push(a);
  }
  args.data = rest[0];
  if (!args.data) {
    console.error("usage: node motion/render.cjs <episode.json> [--out file.mp4] [--fps 30] [--audio music.mp3] [--cover-at sec] [--frames 1,2.5]");
    process.exit(2);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const data = JSON.parse(fs.readFileSync(args.data, "utf8"));
  const base = path.basename(args.data, ".json");
  const out = path.resolve(args.out || path.join(__dirname, "out", `${base}.mp4`));
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const { chromium } = loadPlaywright();
  const launch = { args: ["--force-color-profile=srgb", "--font-render-hinting=none"] };
  if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  page.on("console", (m) => { if (m.type() === "error") console.error("[page]", m.text()); });
  await page.addInitScript((d) => { window.EPISODE_DATA = d; window.__RENDER = true; }, data);
  await page.goto("file://" + path.join(__dirname, "template.html"));
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 30000 });
  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error(err);
  const total = await page.evaluate(() => window.__total);
  const stage = page.locator("#stage");

  const shot = async (t, file, type = "jpeg") => {
    await page.evaluate((x) => window.__render(x), t);
    return stage.screenshot({ type, quality: type === "jpeg" ? args.quality : undefined, path: file, animations: "allow", caret: "initial" });
  };

  if (args.frames) {
    for (const s of args.frames.split(",").map(Number)) {
      const f = out.replace(/\.mp4$/, `-t${s}.png`);
      await shot(s, f, "png");
      console.log(f);
    }
    await browser.close();
    return;
  }

  // Cover: by default the end of the "stat"/"match" scene — the most eye-catching frame.
  let coverAt = args.coverAt;
  if (coverAt == null) {
    let t = 0;
    for (const sc of data.scenes) {
      const d = sc.duration || 4;
      if (sc.type === "stat" || sc.type === "match") { coverAt = t + d - 0.6; break; }
      t += d;
    }
    if (coverAt == null) coverAt = Math.min(2.5, total);
  }
  const cover = out.replace(/\.mp4$/, "-cover.jpg");
  await shot(coverAt, cover);

  const holdEnd = 0.6; // keep last frame on screen briefly
  const frames = Math.round((total + holdEnd) * args.fps);
  const ff = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(args.fps), "-c:v", "mjpeg", "-i", "-"];
  if (args.audio) ff.push("-i", args.audio);
  else ff.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
  ff.push(
    "-map", "0:v", "-map", "1:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high",
    "-r", String(args.fps), "-c:a", "aac", "-b:a", "192k",
  );
  if (args.audio) ff.push("-af", `afade=t=out:st=${(total + holdEnd - 1.2).toFixed(2)}:d=1.2`);
  ff.push("-shortest", "-movflags", "+faststart", out);
  const enc = spawn("ffmpeg", ff, { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => enc.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg exited " + c)))));

  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const t = Math.min(i / args.fps, total);
    const buf = await shot(t);
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once("drain", r));
    if (i % args.fps === 0) process.stdout.write(`\rframe ${i}/${frames}`);
  }
  enc.stdin.end();
  await done;
  await browser.close();
  console.log(`\rdone in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${out}\ncover → ${cover}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
