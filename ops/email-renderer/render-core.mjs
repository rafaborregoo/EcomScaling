import {
  access,
  chmod,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const MAX_JOB_HTML_CHARS = 150_000;
export const MAX_CAPTURE_HEIGHT = 12_000;
export const MAX_CAPTURE_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_COMPLETED_CAPTURE_BYTES = 1024 * 1024 * 1024;
export const MAX_RENDER_JOB_CAPTURE_BYTES = 4 * MAX_CAPTURE_FILE_BYTES;
export const CAPTURE_VIEWPORTS = Object.freeze([
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
]);

const HTML_POLICY = [
  "default-src 'none'",
  "script-src 'none'",
  "connect-src 'none'",
  "font-src data:",
  "img-src data: blob:",
  "style-src 'unsafe-inline'",
  "media-src data:",
  "frame-src 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

export function validateRenderJob(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (typeof value.id !== "string" || !/^[0-9a-f-]{36}$/i.test(value.id))
    return null;
  if (
    typeof value.html !== "string" ||
    value.html.length === 0 ||
    value.html.length > MAX_JOB_HTML_CHARS
  )
    return null;
  return { id: value.id, html: value.html };
}

export function makeIsolatedDocument(html) {
  const policy = `<meta http-equiv="Content-Security-Policy" content="${HTML_POLICY}">`;
  const base = '<base href="about:blank">';
  const prefix = /<head\b[^>]*>/i;
  if (prefix.test(html))
    return html.replace(prefix, (match) => `${match}${base}${policy}`);
  return `<!doctype html><html><head>${base}${policy}</head><body>${html}</body></html>`;
}

export async function renderEmailHtml(job, browser, spoolRoot) {
  const validated = validateRenderJob(job);
  if (!validated) throw new Error("invalid_render_job");
  await mkdir(path.join(spoolRoot, "completed"), { recursive: true });
  const jobDir = path.join(spoolRoot, "completed", validated.id);
  await mkdir(jobDir, { recursive: false });
  await chmod(jobDir, 0o2770);
  const result = {
    id: validated.id,
    status: "completed",
    simulation: true,
    externalRequestsBlocked: 0,
    captures: [],
    htmlLength: validated.html.length,
    renderedAt: new Date().toISOString(),
  };

  for (const viewport of CAPTURE_VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      javaScriptEnabled: false,
      serviceWorkers: "block",
      acceptDownloads: false,
    });
    try {
      await context.route("**/*", async (route) => {
        result.externalRequestsBlocked++;
        await route.abort("blockedbyclient");
      });
      const page = await context.newPage();
      page.setDefaultTimeout(8_000);
      await page.setContent(makeIsolatedDocument(validated.html), {
        waitUntil: "domcontentloaded",
        timeout: 8_000,
      });
      const pageHeight = await page.evaluate(() =>
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
        ),
      );
      const captureHeight = Math.max(
        1,
        Math.min(MAX_CAPTURE_HEIGHT, pageHeight),
      );
      const fullPath = path.join(jobDir, `${viewport.name}-full.png`);
      const firstPath = path.join(jobDir, `${viewport.name}-first-screen.png`);
      const firstScreen = await page.screenshot({
        type: "png",
        fullPage: false,
        timeout: 8_000,
      });
      if (firstScreen.byteLength > MAX_CAPTURE_FILE_BYTES)
        throw new Error("render_capture_too_large");
      await writeFile(firstPath, firstScreen, { mode: 0o660 });
      const fullPage = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: viewport.width, height: captureHeight },
        timeout: 8_000,
      });
      if (fullPage.byteLength > MAX_CAPTURE_FILE_BYTES)
        throw new Error("render_capture_too_large");
      await writeFile(fullPath, fullPage, { mode: 0o660 });
      result.captures.push({
        viewport: viewport.name,
        width: viewport.width,
        viewportHeight: viewport.height,
        documentHeight: pageHeight,
        clipped: pageHeight > MAX_CAPTURE_HEIGHT,
        files: [
          `${viewport.name}-first-screen.png`,
          `${viewport.name}-full.png`,
        ],
      });
    } finally {
      await context.close();
    }
  }

  await writeFile(path.join(jobDir, "result.json"), JSON.stringify(result), {
    mode: 0o660,
  });
  return result;
}

export async function processNextRenderJob(spoolRoot, browser) {
  const queued = path.join(spoolRoot, "queued");
  const processing = path.join(spoolRoot, "processing");
  const failed = path.join(spoolRoot, "failed");
  await Promise.all([
    mkdir(queued, { recursive: true }),
    mkdir(processing, { recursive: true }),
    mkdir(failed, { recursive: true }),
  ]);
  const { readdir } = await import("node:fs/promises");
  const names = (await readdir(queued))
    .filter((name) => /^[0-9a-f-]{36}\.json$/i.test(name))
    .sort();
  const name = names[0];
  if (!name) return false;
  const claimedPath = path.join(processing, name);
  try {
    await rename(path.join(queued, name), claimedPath);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "EEXIST") return false;
    throw error;
  }
  const id = name.slice(0, -5);
  try {
    const parsed = JSON.parse(await readFile(claimedPath, "utf8"));
    await renderEmailHtml({ ...parsed, id }, browser, spoolRoot);
  } catch {
    await mkdir(failed, { recursive: true });
    await writeFile(
      path.join(failed, `${id}.json`),
      JSON.stringify({ id, status: "failed", code: "render_failed" }),
      { mode: 0o660 },
    );
    await rm(path.join(spoolRoot, "completed", id), {
      recursive: true,
      force: true,
    });
  } finally {
    await rm(claimedPath, { force: true });
  }
  return true;
}

export function createRenderJobId() {
  return randomUUID();
}

export async function hasQueuedRenderJobs(spoolRoot) {
  const queued = path.join(spoolRoot, "queued");
  await mkdir(queued, { recursive: true });
  const names = await readdir(queued);
  return names.some((name) => /^[0-9a-f-]{36}\.json$/i.test(name));
}

/** Requeues jobs left in processing after an unclean renderer shutdown. */
export async function recoverInterruptedRenderJobs(spoolRoot) {
  const processing = path.join(spoolRoot, "processing");
  const queued = path.join(spoolRoot, "queued");
  const completed = path.join(spoolRoot, "completed");
  await Promise.all([
    mkdir(processing, { recursive: true }),
    mkdir(queued, { recursive: true }),
    mkdir(completed, { recursive: true }),
  ]);
  let recovered = 0;
  for (const name of await readdir(processing)) {
    const match = /^([0-9a-f-]{36})\.json$/i.exec(name);
    if (!match) continue;
    const id = match[1];
    const source = path.join(processing, name);
    const target = path.join(queued, name);
    const resultPath = path.join(completed, id, "result.json");
    try {
      const result = JSON.parse(await readFile(resultPath, "utf8"));
      if (result?.id === id && result?.status === "completed") {
        await rm(source, { force: true });
        continue;
      }
    } catch {
      // Missing or incomplete result: retry the idempotent render from input.
    }
    await rm(path.join(completed, id), { recursive: true, force: true });
    try {
      await access(target);
      await rm(source, { force: true });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await rename(source, target);
      recovered += 1;
    }
  }
  return recovered;
}

export async function getCompletedRenderArtifactBytes(spoolRoot) {
  const completed = path.join(spoolRoot, "completed");
  await mkdir(completed, { recursive: true });
  let bytes = 0;
  for (const job of await readdir(completed, { withFileTypes: true })) {
    if (!job.isDirectory() || !/^[0-9a-f-]{36}$/i.test(job.name)) continue;
    const jobPath = path.join(completed, job.name);
    for (const file of await readdir(jobPath, { withFileTypes: true })) {
      if (!file.isFile() || !(file.name === "result.json" || /^(desktop|mobile)-(first-screen|full)\.png$/.test(file.name))) continue;
      const info = await stat(path.join(jobPath, file.name)).catch(() => null);
      if (info) bytes += info.size;
    }
  }
  return bytes;
}

export async function hasRenderArtifactCapacity(
  spoolRoot,
  maxBytes = MAX_COMPLETED_CAPTURE_BYTES,
  reserveBytes = MAX_RENDER_JOB_CAPTURE_BYTES,
) {
  return (await getCompletedRenderArtifactBytes(spoolRoot)) + reserveBytes <= maxBytes;
}

export async function pruneExpiredRenderArtifacts(
  spoolRoot,
  now = Date.now(),
  retentionMs = 24 * 60 * 60 * 1000,
) {
  const completed = path.join(spoolRoot, "completed");
  const failed = path.join(spoolRoot, "failed");
  await mkdir(completed, { recursive: true });
  await mkdir(failed, { recursive: true });
  const entries = await readdir(completed, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[0-9a-f-]{36}$/i.test(entry.name)) continue;
    const target = path.join(completed, entry.name);
    const info = await stat(target).catch(() => null);
    if (info && now - info.mtimeMs >= retentionMs) {
      await rm(target, { recursive: true, force: true });
      removed++;
    }
  }
  for (const name of await readdir(failed)) {
    if (!/^[0-9a-f-]{36}\.json$/i.test(name)) continue;
    const target = path.join(failed, name);
    const info = await stat(target).catch(() => null);
    if (info?.isFile() && now - info.mtimeMs >= retentionMs) {
      await rm(target, { force: true });
      removed++;
    }
  }
  return removed;
}
