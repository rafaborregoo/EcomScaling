import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { AGENT_JUDGE_RUBRICS, JUDGE_RUBRIC_VERSION } from "@e-nora/ai";
import { agentJudgeEvalCaseInputSchema, createJudgeDatasetVisualAttachments, matchesJudgeDatasetVisualEvidence, prepareJudgeDatasetVisualUploads, storeJudgeDatasetVisualUploads, validateAgentJudgeEvalLabels } from "./agent-judge-dataset.js";

const agent = "a05_estrategia_campanas" as const;
const rubric = AGENT_JUDGE_RUBRICS[agent];
const labels = rubric.map((criterion) => ({ criterion_id: criterion.id, score: 3, status: "evaluable" as const, critical_failure: false, rationale: "La evidencia respalda esta valoración.", evidence_refs: ["evidence.metric"] }));
const caseInput = (overrides: Record<string, unknown> = {}) => ({
  agent_code: agent, dataset_version: "judge-gold-v7", rubric_version: JUDGE_RUBRIC_VERSION, split: "development",
  provenance: "synthetic", privacy_reviewed: false, scenario: "Plan ante una campaña estacional.",
  evidence: { metric: "ventas estables" }, artifact: { plan: "preparación y seguimiento" }, ...overrides,
});

test("blind dataset accepts synthetic development fixtures and rejects synthetic holdout", () => {
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(caseInput()).success, true);
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(caseInput({ split: "holdout" })).success, false);
});

test("blind dataset requires privacy review and rejects likely personal data", () => {
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(caseInput({ provenance: "anonymized_production", privacy_reviewed: false })).success, false);
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(caseInput({ provenance: "anonymized_production", privacy_reviewed: true, evidence: { metric: "contacto@empresa.es" } })).success, false);
});

test("gold labels must cover the rubric and point to evidence that exists", () => {
  assert.equal(validateAgentJudgeEvalLabels(agent, labels, { metric: "ventas" }, { plan: "acciones" }).ok, true);
  assert.deepEqual(validateAgentJudgeEvalLabels(agent, labels.slice(1), { metric: "ventas" }, { plan: "acciones" }), { ok: false, detail: "criterion_set_mismatch" });
  const badReference = labels.map((label, index) => index ? label : { ...label, evidence_refs: ["evidence.missing"] });
  assert.deepEqual(validateAgentJudgeEvalLabels(agent, badReference, { metric: "ventas" }, { plan: "acciones" }), { ok: false, detail: `evidence_reference_not_found:${rubric[0]!.id}` });
});

test("critical failure requires a critical criterion scored at most one", () => {
  const criticalIndex = rubric.findIndex((criterion) => criterion.critical);
  const invalid = labels.map((label, index) => index === criticalIndex ? { ...label, score: 3, critical_failure: true } : label);
  assert.deepEqual(validateAgentJudgeEvalLabels(agent, invalid, { metric: "ventas" }, { plan: "acciones" }), { ok: false, detail: "invalid_critical_failure" });
});

const organizationId = "123e4567-e89b-42d3-a456-426614174000";
const visualRef = (overrides: Record<string, unknown> = {}) => ({
  storage_bucket: "marketing-assets", storage_path: `${organizationId}/judge/a15.png`, sha256: "a".repeat(64),
  media_type: "image/png", role: "input", entity_type: "instagram_image_bank", ...overrides,
});
const visualCase = (agentCode: string, visualImages: unknown[]) => caseInput({
  agent_code: agentCode, provenance: "anonymized_production", privacy_reviewed: true,
  evidence: { organization_id: organizationId, visual_images: visualImages },
});

test("visual gold cases require tenant-scoped private storage references and agent-specific coverage", () => {
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(visualCase("a15_analista_imagenes", [visualRef()])).success, true);
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(visualCase("a15_analista_imagenes", [visualRef({ storage_path: "other-org/judge/a15.png" })])).success, false);
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(visualCase("a15_analista_imagenes", [visualRef({ storage_path: `${organizationId}/../other/a15.png` })])).success, false);
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(visualCase("a15_analista_imagenes", [visualRef({ url: "https://example.com/image.png" })])).success, false);
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(visualCase("a16_texto_sobre_imagen", [
    visualRef({ role: "input" }), visualRef({ role: "render" }), visualRef({ role: "reference" }),
  ])).success, false);
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(visualCase("a16_texto_sobre_imagen", [
    visualRef({ role: "input" }), visualRef({ role: "render", entity_type: "a16_render_capture" }),
    visualRef({ role: "neighbor", entity_type: "a16_render_capture" }),
  ])).success, true);
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(visualCase("a26_contenido_email", [
    visualRef({ entity_type: "a26_email_render_capture", role: "render", viewport: "desktop" }),
  ])).success, false);
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(visualCase("a26_contenido_email", [
    visualRef({ entity_type: "a26_email_render_capture", role: "render", viewport: "desktop" }),
    visualRef({ entity_type: "a26_email_render_capture", role: "render", viewport: "mobile" }),
  ])).success, true);
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(visualCase("a23_creatividad_meta", [
    visualRef({ entity_type: "meta_creative_image", related_entity_id: organizationId, ad_id: organizationId }),
  ])).success, false);
  assert.equal(agentJudgeEvalCaseInputSchema.safeParse(visualCase("a23_creatividad_meta", [
    visualRef({ entity_type: "meta_creative_image", related_entity_id: organizationId, ad_id: organizationId, period_start: "2026-10-01", period_end: "2026-10-31" }),
  ])).success, true);
});

test("visual evidence references resolve to scoped signed URLs and must match bytes and media types", async () => {
  const requests: Array<{ bucket: string; path: string }> = [];
  const db = { storage: { from(bucket: string) { return { async createSignedUrl(path: string) {
    requests.push({ bucket, path });
    return { data: { signedUrl: `https://storage.example/signed/${encodeURIComponent(path)}` }, error: null };
  } }; } } };
  const resolved = await createJudgeDatasetVisualAttachments(db, { organization_id: organizationId, visual_images: [visualRef()] });
  assert.ok(resolved);
  assert.deepEqual(requests, [{ bucket: "marketing-assets", path: `${organizationId}/judge/a15.png` }]);
  assert.ok(resolved.attachments[0] && "url" in resolved.attachments[0]);
  assert.equal("url" in resolved.attachments[0] ? resolved.attachments[0].url : null, `https://storage.example/signed/${encodeURIComponent(`${organizationId}/judge/a15.png`)}`);
  assert.equal(matchesJudgeDatasetVisualEvidence({ imageSha256: ["a".repeat(64)], images: [{ base64: "aGVsbG8=", mediaType: "image/png", label: "visual" }] }, resolved), true);
  assert.equal(matchesJudgeDatasetVisualEvidence({ imageSha256: ["b".repeat(64)], images: [{ base64: "aGVsbG8=", mediaType: "image/png", label: "visual" }] }, resolved), false);
  assert.equal(matchesJudgeDatasetVisualEvidence({ imageSha256: ["a".repeat(64)], images: [{ base64: "aGVsbG8=", mediaType: "image/jpeg", label: "visual" }] }, resolved), false);
  assert.equal(await createJudgeDatasetVisualAttachments(db, { organization_id: organizationId, visual_images: [visualRef({ storage_path: "other-org/file.png" })] }), null);
  assert.equal(await createJudgeDatasetVisualAttachments(db, { organization_id: organizationId, visual_images: [visualRef(), visualRef()] }), null);
  assert.equal(requests.length, 1, "invalid references must not reach Storage");
});

test("visual upload validates file signatures and returns immutable tenant-scoped refs", async () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString("base64");
  const upload = { bytes_base64: png, media_type: "image/png", role: "input", entity_type: "instagram_image_bank", label: "Activo de prueba" };
  assert.equal(prepareJudgeDatasetVisualUploads(organizationId, [upload])?.length, 1);
  assert.equal(prepareJudgeDatasetVisualUploads(organizationId, [{ ...upload, bytes_base64: Buffer.from("not an image").toString("base64") }]), null);
  assert.equal(prepareJudgeDatasetVisualUploads(organizationId, [{ ...upload, role: "render", entity_type: "meta_creative_image", related_entity_id: organizationId, ad_id: organizationId }]), null);

  const storedPaths: string[] = [];
  const db = { storage: { from(bucket: string) {
    assert.equal(bucket, "marketing-assets");
    return {
      async upload(path: string) { storedPaths.push(path); return { error: null }; },
      async remove(paths: string[]) { storedPaths.splice(0, storedPaths.length, ...storedPaths.filter((path) => !paths.includes(path))); return { error: null }; },
    };
  } } };
  const result = await storeJudgeDatasetVisualUploads(db, organizationId, "gold-v1", [upload]);
  assert.ok(result);
  assert.equal(result.refs.length, 1);
  const ref = result.refs[0] as Record<string, unknown>;
  assert.equal(ref.storage_bucket, "marketing-assets");
  assert.equal(String(ref.storage_path).startsWith(`${organizationId}/judge-dataset/gold-v1/`), true);
  assert.equal(ref.sha256, createHash("sha256").update(Buffer.from(png, "base64")).digest("hex"));
  assert.equal("bytes_base64" in ref, false);
  assert.equal(storedPaths.length, 1);
  await result.rollback();
  assert.equal(storedPaths.length, 0);
});
