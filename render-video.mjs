import puppeteer from "puppeteer";
import { spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// === CONFIG ===
const FPS = 30;
const DEFAULT_DURATION_S = 15;
const FRAME_INTERVAL_MS = 1000 / FPS;

// Sources: [label, html file, output prefix, duration_s (optional), audio file (optional)]
const SOURCES = [
  ["CZ", path.join(__dirname, "video-irresistible.html"), "video-irresistible"],
  ["EN", path.join(__dirname, "video-irresistible-en.html"), "video-irresistible-en"],
  ["RESTAURANTS", path.join(__dirname, "video-restaurants.html"), "video-restaurants", 30],
  ["FUNNEL", path.join(__dirname, "video-funnel-mix.html"), "video-funnel-mix", 30],
  ["WORDPRESS", path.join(__dirname, "video-wordpress-problems.html"), "video-wordpress-problems", 45, path.join(__dirname, "video-wordpress-problems-voiceover.mp3")],
  ["WORDPRESS-CZ", path.join(__dirname, "video-wordpress-problems-cz.html"), "video-wordpress-problems-cz", 45, path.join(__dirname, "video-wordpress-problems-cz-voiceover.mp3")],
];

// Formats: [name, width, height]
const FORMATS = [
  ["9x16", 1080, 1920],
  ["4x5", 1080, 1350],
  ["1x1", 1080, 1080],
  ["16x9", 1920, 1080],
];

// CLI args: node render-video.mjs [lang] [format]
// e.g.: node render-video.mjs EN 4x5
// or:   node render-video.mjs (renders all)
const argLang = process.argv[2]?.toUpperCase();
const argFormat = process.argv[3];

async function renderFormat(htmlFile, outputPrefix, formatName, width, height, durationS, audioFile) {
  const totalFrames = FPS * durationS;
  const outputFile = path.join(__dirname, `${outputPrefix}-${formatName}.mp4`);

  console.log(`\n=== ${outputPrefix} ${formatName} (${width}x${height}) ${durationS}s ===`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [`--window-size=${width},${height}`, "--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`file://${htmlFile}`, { waitUntil: "networkidle0" });

  await new Promise((r) => setTimeout(r, 1000));

  await page.evaluate(() => {
    document.getAnimations({ subtree: true }).forEach((a) => a.pause());
    const hint = document.querySelector(".hint");
    if (hint) hint.style.display = "none";
  });

  // Spawn ffmpeg and pipe raw PNG frames to stdin
  const hasAudio = audioFile && existsSync(audioFile);
  console.log(`Capturing ${totalFrames} frames → piping to ffmpeg${hasAudio ? " (with audio)" : ""}...`);

  const ffmpegArgs = [
    "-y",
    "-f", "image2pipe",
    "-framerate", String(FPS),
    "-i", "-",
  ];
  if (hasAudio) ffmpegArgs.push("-i", audioFile);
  ffmpegArgs.push(
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-crf", "18",
    "-preset", "slow",
  );
  if (hasAudio) ffmpegArgs.push("-c:a", "aac", "-b:a", "192k", "-shortest");
  ffmpegArgs.push(
    "-vf", `scale=${width}:${height}`,
    "-r", String(FPS),
    outputFile,
  );

  const ffmpeg = spawn("ffmpeg", ffmpegArgs, { stdio: ["pipe", "inherit", "inherit"] });

  const ffmpegDone = new Promise((resolve, reject) => {
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
    ffmpeg.on("error", reject);
  });

  for (let i = 0; i < totalFrames; i++) {
    const timeMs = i * FRAME_INTERVAL_MS;

    await page.evaluate((t) => {
      document.getAnimations({ subtree: true }).forEach((a) => { a.currentTime = t; });
    }, timeMs);

    const pngBuffer = await page.screenshot({ type: "png", encoding: "binary" });

    // Write to ffmpeg stdin, with backpressure handling
    const canWrite = ffmpeg.stdin.write(pngBuffer);
    if (!canWrite) {
      await new Promise((r) => ffmpeg.stdin.once("drain", r));
    }

    if (i % 60 === 0) console.log(`  ${i}/${totalFrames} (${(timeMs / 1000).toFixed(1)}s)`);
  }

  ffmpeg.stdin.end();
  await browser.close();
  await ffmpegDone;

  console.log(`Done: ${outputFile}`);
}

async function main() {
  const sources = argLang ? SOURCES.filter(([l]) => l === argLang) : SOURCES;
  const formats = argFormat ? FORMATS.filter(([n]) => n === argFormat) : FORMATS;

  if (sources.length === 0) {
    console.error(`Unknown lang: ${argLang}. Available: ${SOURCES.map(([l]) => l).join(", ")}`);
    process.exit(1);
  }
  if (formats.length === 0) {
    console.error(`Unknown format: ${argFormat}. Available: ${FORMATS.map(([n]) => n).join(", ")}`);
    process.exit(1);
  }

  for (const [label, htmlFile, prefix, dur, audio] of sources) {
    const durationS = dur || DEFAULT_DURATION_S;
    for (const [fName, w, h] of formats) {
      await renderFormat(htmlFile, prefix, fName, w, h, durationS, audio);
    }
  }

  console.log("\nAll done!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
