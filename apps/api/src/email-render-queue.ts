import { createHash, randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { AgentImageAttachment } from "@e-nora/ai";
import type { SupabaseClient } from "@supabase/supabase-js";

export const KLAVIYO_RENDER_MAX_HTML_CHARS = 150_000;
export const KLAVIYO_RENDER_MAX_SCREENSHOT_BYTES = 20 * 1024 * 1024;
export const KLAVIYO_RENDER_MAX_PENDING_JOBS = 500;
export const A26_RENDER_POLICY_VERSION = "a26-render-v2-offline-1280x800-390x844";
export const A26_RENDER_CONTEXT_LABEL =
  "Revision visual asincrona A26; solo simulacion de primera pantalla desktop/movil, no evidencia de entrega real";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CAPTURE_FILE_PATTERN = /^(desktop|mobile)-(first-screen|full)\.png$/;

export type KlaviyoRenderQueueJob = { id: string; html: string };
export type KlaviyoEmailRenderScope = {
  organizationId: string;
  storeId: string | null;
  accountId: string;
  externalTemplateId: string;
};
export type KlaviyoRenderQueueState =
  | { status: "queued" | "processing" }
  | { status: "completed"; result: Record<string, unknown> }
  | { status: "failed"; code: "render_failed"; failed_at?: string }
  | { status: "missing" };

export function a26RenderIdFromSnapshot(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const blocks = (snapshot as Record<string, unknown>).blocks;
  if (!Array.isArray(blocks)) return null;
  for (const block of blocks) {
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const record = block as Record<string, unknown>;
    if (record.label !== A26_RENDER_CONTEXT_LABEL || !record.data || typeof record.data !== "object") continue;
    const id = (record.data as Record<string, unknown>).render_id;
    if (typeof id === "string" && UUID_PATTERN.test(id)) return id;
  }
  return null;
}

export function isAllowedA26RenderCaptureName(value: string): boolean {
  return CAPTURE_FILE_PATTERN.test(value);
}

export function validateKlaviyoRenderQueueJob(
  value: unknown,
): value is KlaviyoRenderQueueJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    UUID_PATTERN.test(row.id) &&
    typeof row.html === "string" &&
    row.html.length > 0 &&
    row.html.length <= KLAVIYO_RENDER_MAX_HTML_CHARS
  );
}

export function stableKlaviyoRenderJobId(
  scope: KlaviyoEmailRenderScope,
  html: string,
): string {
  const htmlHash = createHash("sha256").update(html).digest("hex");
  const bytes = createHash("sha256")
    .update(
      [
        scope.organizationId,
        scope.storeId ?? "aggregate",
        scope.accountId,
        scope.externalTemplateId,
        htmlHash,
        A26_RENDER_POLICY_VERSION,
      ].join("\0"),
    )
    .digest("hex")
    .slice(0, 32)
    .split("");
  bytes[12] = "5";
  bytes[16] = "a";
  const hex = bytes.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function prepareKlaviyoEmailRenderReview(
  spoolRoot: string,
  scope: KlaviyoEmailRenderScope,
  html: string,
): Promise<{
  review: Record<string, unknown>;
  images: AgentImageAttachment[];
}> {
  const id = stableKlaviyoRenderJobId(scope, html);
  try {
    let state = await readKlaviyoEmailRenderState(spoolRoot, id);
    if (state.status === "failed" || state.status === "missing") {
      const retryFile = path.join(spoolRoot, "failed", `${id}.retry`);
      let retry = { attempts: 0, last_at: 0 };
      try { retry = JSON.parse(await readFile(retryFile, "utf8")); } catch { /* first failure */ }
      if (state.status === "failed" && state.failed_at && retry.last_at === 0) retry.last_at = Date.parse(state.failed_at);
      if (retry.attempts >= 3 || Date.now() - retry.last_at < 60_000 * 2 ** retry.attempts) {
        return { review: { status: "failed", render_id: id, attempts: retry.attempts, simulation: true, retry_after: new Date(retry.last_at + 60_000 * 2 ** retry.attempts).toISOString() }, images: [] };
      }
      if (state.status === "failed") {
        await writeFile(retryFile, JSON.stringify({ attempts: retry.attempts + 1, last_at: Date.now() }), { mode: 0o660 });
        await rm(path.join(spoolRoot, "failed", `${id}.json`), { force: true });
        state = { status: "missing" };
      }
    }
    if (state.status === "missing") {
      await enqueueKlaviyoEmailRender(spoolRoot, { id, html });
      state = { status: "queued" };
    }
    const images: AgentImageAttachment[] = [];
    if (state.status === "completed") {
      for (const viewport of ["desktop", "mobile"] as const) {
        const fileName = `${viewport}-first-screen.png`;
        const capture = await readKlaviyoEmailRenderCapture(
          spoolRoot,
          id,
          fileName,
        );
        if (capture && capture.byteLength <= 1_500_000) {
          images.push({
            base64: Buffer.from(capture).toString("base64"),
            mediaType: "image/png",
            role: "simulacion visual",
            label: `${viewport}, primera pantalla; simulacion del navegador, no entrega real`,
          });
        }
      }
    }
    return {
      review: {
        status: state.status,
        simulation: true,
        render_id: id,
        html_hash: createHash("sha256").update(html).digest("hex"),
        renderer_policy_version: A26_RENDER_POLICY_VERSION,
        artifact_retention_hours: 24,
        external_resources_policy: "all_external_requests_blocked",
        external_requests_blocked: state.status === "completed" ? state.result.externalRequestsBlocked ?? null : null,
        rendered_at: state.status === "completed" ? state.result.renderedAt ?? null : null,
        capture_metadata: state.status === "completed" ? state.result.captures ?? [] : [],
        visual_claim_limit: "La ausencia de imagenes/fuentes externas no demuestra un defecto del email original.",
        screenshots_supplied_to_vision: images.length,
        scope:
          "primer pantallazo desktop y movil; no representa inbox ni personalizacion individual",
      },
      images,
    };
  } catch {
    return { review: { status: "unavailable", simulation: true }, images: [] };
  }
}

/** Reconcile worker completion without another model call or any network in Chromium. */
export async function reconcileA26RenderReceipts(client: SupabaseClient, spoolRoot: string) {
  const rows = await client.from("a26_render_receipts").select("render_id,receipt,created_at")
    .in("receipt->>status", ["queued", "processing"]).order("created_at").limit(500);
  if (rows.error) throw new Error("a26_render_receipts_unavailable");
  for (const row of rows.data ?? []) {
    const state = await readKlaviyoEmailRenderState(spoolRoot, row.render_id);
    const expired = state.status === "missing" && Date.now() - Date.parse(row.created_at) > 24 * 3_600_000;
    if (state.status === "queued" || state.status === "processing" || (state.status === "missing" && !expired)) continue;
    const saved = await client.from("a26_render_receipts").update({ receipt: {
      ...row.receipt, status: expired ? "expired_or_not_available" : state.status,
      ...(state.status === "completed" ? { worker_receipt: state.result } : {}),
      model_review_status: "human_review_available_without_model_rerun",
    }, updated_at: new Date().toISOString() }).eq("render_id", row.render_id);
    if (saved.error) throw new Error("a26_render_receipt_persist_failed");
  }
}

export async function enqueueKlaviyoEmailRender(
  spoolRoot: string,
  job: KlaviyoRenderQueueJob,
): Promise<{ status: "queued" | "already_queued" }> {
  if (!validateKlaviyoRenderQueueJob(job))
    throw new Error("klaviyo_render_job_invalid");
  const queuedDir = path.join(spoolRoot, "queued");
  await mkdir(queuedDir, { recursive: true });
  const target = path.join(queuedDir, `${job.id}.json`);
  const existingState = await readKlaviyoEmailRenderState(spoolRoot, job.id);
  if (existingState.status !== "missing") return { status: "already_queued" };
  try {
    await access(target);
    return { status: "already_queued" };
  } catch {
    // Expected when this idempotency key has not yet been queued.
  }
  const pendingNames = await readdir(queuedDir);
  const pendingCount = pendingNames.filter((name) =>
    /^[0-9a-f-]{36}\.json$/i.test(name),
  ).length;
  if (pendingCount >= KLAVIYO_RENDER_MAX_PENDING_JOBS)
    throw new Error("klaviyo_render_queue_full");
  const temporary = path.join(queuedDir, `.${job.id}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(job), {
      flag: "wx",
      mode: 0o660,
    });
    await rename(temporary, target);
    return { status: "queued" };
  } catch (error) {
    await rm(temporary, { force: true });
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      return { status: "already_queued" };
    throw error;
  }
}

export async function readKlaviyoEmailRenderState(
  spoolRoot: string,
  id: string,
): Promise<KlaviyoRenderQueueState> {
  if (!UUID_PATTERN.test(id)) return { status: "missing" };
  const completedFile = path.join(spoolRoot, "completed", id, "result.json");
  try {
    const result: unknown = JSON.parse(await readFile(completedFile, "utf8"));
    if (
      !result ||
      typeof result !== "object" ||
      (result as Record<string, unknown>).id !== id
    ) {
      return { status: "missing" };
    }
    return { status: "completed", result: result as Record<string, unknown> };
  } catch {
    // Try the small failure marker and then queue positions.
  }
  try {
    const failed: unknown = JSON.parse(
      await readFile(path.join(spoolRoot, "failed", `${id}.json`), "utf8"),
    );
    if (
      failed &&
      typeof failed === "object" &&
      (failed as Record<string, unknown>).id === id
    ) {
      const failedAt = (failed as Record<string, unknown>).failedAt;
      return { status: "failed", code: "render_failed", ...(typeof failedAt === "string" && Number.isFinite(Date.parse(failedAt)) ? { failed_at: failedAt } : {}) };
    }
  } catch {
    /* Not failed. */
  }
  for (const [directory, status] of [
    ["processing", "processing"],
    ["queued", "queued"],
  ] as const) {
    try {
      await access(path.join(spoolRoot, directory, `${id}.json`));
      return { status };
    } catch {
      /* Check next state. */
    }
  }
  return { status: "missing" };
}

export async function readKlaviyoEmailRenderCapture(
  spoolRoot: string,
  id: string,
  fileName: string,
): Promise<Uint8Array | null> {
  if (!UUID_PATTERN.test(id) || !CAPTURE_FILE_PATTERN.test(fileName))
    return null;
  const target = path.join(spoolRoot, "completed", id, fileName);
  try {
    const info = await stat(target);
    if (
      !info.isFile() ||
      info.size <= 0 ||
      info.size > KLAVIYO_RENDER_MAX_SCREENSHOT_BYTES
    )
      return null;
    return await readFile(target);
  } catch {
    return null;
  }
}
