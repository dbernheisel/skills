#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function usage(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error(
    "Usage: render-webm.mjs INPUT.svg [OUTPUT.webm] " +
      "[--duration SECONDS] [--width PIXELS] [--height PIXELS] [--force]",
  );
  process.exit(message ? 1 : 0);
}

function positiveNumber(value, flag) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) usage(`${flag} must be positive`);
  return number;
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) usage();

const positional = [];
let duration;
let width = 1280;
let height = 720;
let force = false;

for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === "--duration") {
    duration = positiveNumber(args[++index], "--duration");
  } else if (argument === "--width") {
    width = Math.round(positiveNumber(args[++index], "--width"));
  } else if (argument === "--height") {
    height = Math.round(positiveNumber(args[++index], "--height"));
  } else if (argument === "--force") {
    force = true;
  } else if (argument.startsWith("-")) {
    usage(`unknown option: ${argument}`);
  } else {
    positional.push(argument);
  }
}

if (positional.length < 1 || positional.length > 2) usage("expected an input and optional output");

const input = resolve(positional[0]);
const defaultName = `${basename(input, extname(input))}.webm`;
const output = resolve(positional[1] ?? defaultName);

try {
  accessSync(input, constants.R_OK);
} catch {
  usage(`cannot read input: ${input}`);
}
if (existsSync(output) && !force) usage(`output already exists: ${output}; pass --force to replace it`);

const ffmpegCheck = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
if (ffmpegCheck.error?.code === "ENOENT") usage("ffmpeg is required on PATH");
if (ffmpegCheck.status !== 0) usage("ffmpeg could not be executed");

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  usage("Playwright is not installed; run npm install in the visualize-svg skill directory");
}

const svg = readFileSync(input, "utf8").replace(/<\?xml[^?]*\?>\s*/i, "");
const sourceBase = pathToFileURL(`${dirname(input)}/`).href;
const work = mkdtempSync(`${tmpdir()}/visualize-svg-webm-`);
const rawVideoDirectory = resolve(work, "raw");
let browser;

function parseTime(value) {
  const text = String(value).trim();
  if (/^[\d.]+ms$/.test(text)) return Number.parseFloat(text) / 1000;
  if (/^[\d.]+s$/.test(text)) return Number.parseFloat(text);
  if (/^[\d.]+$/.test(text)) return Number.parseFloat(text);
  return undefined;
}

function estimateSmilDuration(source) {
  const timing = /\b(begin|dur)\s*=\s*["']([^"']+)["']/gi;
  const durations = [];
  const begins = [];
  let match;
  while ((match = timing.exec(source))) {
    const values = match[2].split(";").map(parseTime).filter(Number.isFinite);
    if (match[1].toLowerCase() === "dur") durations.push(...values);
    else begins.push(...values);
  }
  return Math.max(0, ...begins) + Math.max(0, ...durations);
}

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: rawVideoDirectory, size: { width, height } },
  });
  const page = await context.newPage();
  const recordingEpoch = Date.now();
  const video = page.video();

  await page.setContent(
    `<!doctype html><html><head><base href="${sourceBase}"><style>` +
      "html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#fff}" +
      "body{display:grid;place-items:center}" +
      "svg{display:block;max-width:100vw;max-height:100vh;width:100%;height:100%}" +
      `</style></head><body>${svg}</body></html>`,
    { waitUntil: "load" },
  );
  await page.evaluate(() => document.fonts?.ready);

  const cssDuration = await page.evaluate(() => {
    const totals = document.getAnimations().map((animation) => {
      const timing = animation.effect?.getComputedTiming();
      if (Number.isFinite(timing?.endTime)) return timing.endTime / 1000;
      const configured = animation.effect?.getTiming();
      const iteration = Number(configured?.duration);
      const delay = Number(configured?.delay ?? 0);
      return Number.isFinite(iteration) ? Math.max(0, delay + iteration) / 1000 : 0;
    });
    return Math.max(0, ...totals);
  });
  const seconds = duration ?? Math.max(estimateSmilDuration(svg), cssDuration);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("Could not infer an animation cycle; pass --duration SECONDS");
  }

  await page.evaluate(() => {
    const root = document.querySelector("svg");
    if (typeof root?.setCurrentTime === "function") root.setCurrentTime(0);
    for (const animation of document.getAnimations()) {
      animation.cancel();
      animation.play();
    }
  });
  const animationEpoch = Date.now();
  await page.waitForTimeout(Math.ceil((seconds + 0.35) * 1000));
  await context.close();

  const rawVideo = await video.path();
  const leadSeconds = Math.max(0, (animationEpoch - recordingEpoch) / 1000);
  const encoded = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-ss",
      leadSeconds.toFixed(3),
      "-i",
      rawVideo,
      "-t",
      seconds.toFixed(3),
      "-an",
      "-c:v",
      "libvpx-vp9",
      "-pix_fmt",
      "yuv420p",
      output,
    ],
    { stdio: "inherit" },
  );
  if (encoded.status !== 0) throw new Error("ffmpeg failed to encode the WebM");

  console.log(`WebM created: ${output} (${seconds.toFixed(3)}s, ${width}x${height})`);
} catch (error) {
  if (error?.message?.includes("Executable doesn't exist")) {
    console.error("Playwright Chromium is missing; run: npx playwright install chromium");
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  rmSync(work, { recursive: true, force: true });
}
