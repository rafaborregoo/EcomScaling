import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import {
  hasQueuedRenderJobs,
  hasRenderArtifactCapacity,
  processNextRenderJob,
  pruneExpiredRenderArtifacts,
  recoverInterruptedRenderJobs,
} from "./render-core.mjs";

const spoolRoot = process.env.EMAIL_RENDER_SPOOL ?? "/spool";
await mkdir(spoolRoot, { recursive: true });
const recoveredJobs = await recoverInterruptedRenderJobs(spoolRoot);
if (recoveredJobs > 0) console.info("email_render_jobs_recovered", recoveredJobs);
let stopping = false;
let lastPrunedAt = 0;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});

while (!stopping) {
  let browser;
  try {
    if (Date.now() - lastPrunedAt > 60 * 1_000) {
      await pruneExpiredRenderArtifacts(spoolRoot);
      lastPrunedAt = Date.now();
    }
    if (!(await hasQueuedRenderJobs(spoolRoot))) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      continue;
    }
    if (!(await hasRenderArtifactCapacity(spoolRoot))) {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      continue;
    }
    browser = await chromium.launch({ headless: true, chromiumSandbox: true });
    const processed = await processNextRenderJob(spoolRoot, browser);
    await browser.close();
    if (!processed) await new Promise((resolve) => setTimeout(resolve, 1_000));
  } catch (error) {
    if (browser) await browser.close().catch(() => undefined);
    // Keep diagnostics content and provider exceptions out of container logs.
    console.error(
      "email_render_worker_iteration_failed",
      error?.name ?? "Error",
    );
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}
