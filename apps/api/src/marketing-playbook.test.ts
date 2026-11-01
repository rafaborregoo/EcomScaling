import test from "node:test";
import assert from "node:assert/strict";
import {
  canManageInternalMailingPlaybook,
  canPublishInternalMailingPlaybookReference,
  buildInternalMailingDesignContext,
  internalMailingPlaybookDraftSchema,
  internalMailingPlaybookRetrievalEntry,
  previewInternalMailingPlaybook,
  rankInternalMailingPlaybook,
  internalMailingPlaybookCandidateFilter,
  type InternalMailingPlaybookEntry,
} from "./marketing-playbook.js";

test("candidate selection filters relevant principles before the cap and never interpolates filter syntax", () => {
  const filter = internalMailingPlaybookCandidateFilter({ objective: "recompra", audience: "para clientes),status.eq.draft" });
  assert.ok(filter.includes("objective.ilike.*recompra*"));
  assert.ok(filter.includes("content->>when_to_use.ilike.*clientes*"));
  assert.ok(!filter.includes("status.eq.draft"));
  assert.ok(!filter.includes("*para*"));
  assert.match(internalMailingPlaybookCandidateFilter({ objective: "" }), /^id.eq./);
});

test("solo platform admin puede curar el playbook privado", () => {
  assert.equal(canManageInternalMailingPlaybook("platform_admin"), true);
  assert.equal(canManageInternalMailingPlaybook("consultant"), false);
  assert.equal(canManageInternalMailingPlaybook("client"), false);
  assert.equal(canManageInternalMailingPlaybook(null), false);
});

test("publicar referencias externas o importadas exige confirmación de derechos", () => {
  assert.equal(canPublishInternalMailingPlaybookReference({ type: "internal" }, {}), true);
  assert.equal(canPublishInternalMailingPlaybookReference({ type: "internal" }, { raw_html: "<p>ref</p>" }), false);
  assert.equal(canPublishInternalMailingPlaybookReference({ type: "internal" }, { screenshot_visual_profile: { version: 1 } }), false);
  assert.equal(canPublishInternalMailingPlaybookReference({ type: "internal" }, { screenshot_semantic_analysis: { confidence: "low" } }), false);
  assert.equal(canPublishInternalMailingPlaybookReference({ type: "authorized_import", rights_confirmed: false }, {}), false);
  assert.equal(canPublishInternalMailingPlaybookReference({ type: "authorized_import", rights_confirmed: true }, { reference_text: "ref" }), true);
});

const entry = (overrides: Partial<InternalMailingPlaybookEntry> = {}): InternalMailingPlaybookEntry => ({
  id: "id-1", entry_key: "key-1", version: 1, kind: "strategy", title: "Welcome",
  objective: "welcome new customers with education", audience_tags: ["new customers"],
  lifecycle_tags: ["welcome"], content: { when_to_use: "after first order", excerpt: "private source must not leak", raw_html: "<html>private html</html>", reference_text: "private notes" },
  evidence: {}, source: { type: "authorized_import", rights_confirmed: true }, status: "published",
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", ...overrides,
});

const privateScreenshotProfile: NonNullable<InternalMailingPlaybookEntry["content"]["screenshot_visual_profile"]> = {
  version: 1,
  width: 1,
  height: 1,
  method: "sampled_pixels_quantized",
  colors: [{ hex: "#ffffff", share_percent: 100 }],
  vertical_bands: Array.from({ length: 8 }, (_, index) => ({
    from_percent: index * 12.5,
    to_percent: (index + 1) * 12.5,
    dominant_hex: "#ffffff",
  })),
};

test("playbook drafts validate bounded, explicitly structured content", () => {
  const valid = internalMailingPlaybookDraftSchema.safeParse({
    kind: "strategy", title: "Welcome", objective: "welcome new customers",
    audience_tags: [], lifecycle_tags: [], content: {}, evidence: {},
    source: { type: "internal" },
  });
  assert.equal(valid.success, true);
  assert.equal(internalMailingPlaybookDraftSchema.safeParse({
    kind: "example", title: "Ref", objective: "Inspiration", audience_tags: [], lifecycle_tags: [],
    content: { raw_html: "x".repeat(60_001) }, evidence: {}, source: {},
  }).success, false);
  const invalid = internalMailingPlaybookDraftSchema.safeParse({
    kind: "strategy", title: "x".repeat(181), objective: "x", content: {}, evidence: {}, source: {}, unexpected: true,
  });
  assert.equal(invalid.success, false);
  const screenshotProfile = {
    version: 1, width: 640, height: 1200, method: "sampled_pixels_quantized",
    colors: [{ hex: "#ffffff", share_percent: 52.5 }],
    vertical_bands: Array.from({ length: 8 }, (_, i) => ({ from_percent: i * 12.5, to_percent: (i + 1) * 12.5, dominant_hex: "#ffffff" })),
  };
  assert.equal(internalMailingPlaybookDraftSchema.safeParse({
    kind: "example", title: "Screenshot reference", objective: "Visual inspiration", content: { screenshot_visual_profile: screenshotProfile }, evidence: {}, source: { type: "authorized_import", rights_confirmed: true },
  }).success, true);
  assert.equal(internalMailingPlaybookDraftSchema.safeParse({
    kind: "example", title: "Visual analysis", objective: "Reference only",
    content: {
      screenshot_semantic_analysis: {
        detected_text: [], layout_blocks: [], visual_hierarchy: [], typography: [], ctas: [],
        composition_notes: [], persuasion_cues: [], limitations: ["No performance evidence"], confidence: "low",
      },
      screenshot_analysis_run_id: "00000000-0000-4000-8000-000000000027",
    }, evidence: {}, source: { type: "authorized_import", rights_confirmed: true },
  }).success, true);
  assert.equal(internalMailingPlaybookDraftSchema.safeParse({
    kind: "example", title: "Bad profile", objective: "Visual inspiration", content: { screenshot_visual_profile: { ...screenshotProfile, width: 12001 } }, evidence: {}, source: { type: "authorized_import", rights_confirmed: true },
  }).success, false);
});

test("ranking uses objective/audience, excludes non-strategies, unpublished and unauthorized references", () => {
  const results = rankInternalMailingPlaybook([
    entry({ content: { when_to_use: "after first order", screenshot_visual_profile: privateScreenshotProfile } }),
    entry({ id: "id-2", title: "Promo", kind: "example", objective: "welcome new customers" }),
    entry({ id: "id-3", status: "draft" }),
    entry({ id: "id-5", content: { raw_html: "unauthorized html" }, source: { type: "authorized_import", rights_confirmed: false } }),
    entry({ id: "id-4", title: "Retention", objective: "repeat purchase winback", lifecycle_tags: ["winback"], audience_tags: ["existing customers"] }),
  ], { objective: "welcome education", audience: "new customers" });
  assert.equal(results.length, 1);
  const [result] = results;
  assert.ok(result);
  assert.equal("title" in result, false);
  assert.equal("excerpt" in result, false);
  assert.equal("source" in result, false);
  assert.equal("evidence" in result, false);
  assert.equal("screenshot_visual_profile" in result, false);
  assert.equal(JSON.stringify(results).includes("private source must not leak"), false);
  assert.equal(JSON.stringify(results).includes("private html"), false);
  assert.equal(JSON.stringify(results).includes("private notes"), false);
  assert.equal(JSON.stringify(results).includes("unauthorized html"), false);
});

test("recuperación del playbook recorta cada campo enviado al agente", () => {
  const [result] = rankInternalMailingPlaybook([
    entry({
      content: {
        when_to_use: "x".repeat(5000),
        sequence_arc: "y".repeat(5000),
        persuasion_principles: Array.from({ length: 30 }, () => "z".repeat(1000)),
      },
    }),
  ], { objective: "welcome education" });
  assert.ok(result);
  assert.equal(result.when_to_use?.length, 1000);
  assert.equal(result.sequence_arc?.length, 1500);
  assert.equal(result.persuasion_principles.length, 8);
  assert.equal(result.persuasion_principles[0]?.length, 300);
});

test("A11 composition context returns principles, never internal IDs, names, excerpts or HTML", () => {
  const candidate = entry({
    id: "private-reference-id",
    title: "Internal name that must not leak",
    objective: "launch new product email",
    content: {
      when_to_use: "When launch intent is clear",
      visual_direction: "Editorial hero, product details, proof and CTA",
      excerpt: "Private source copy",
      raw_html: "<table>private original</table>",
    },
  });
  const context = buildInternalMailingDesignContext([candidate], {
    objective: "launch product",
    audience: "new customers",
  });
  assert.equal(context.status, "available");
  assert.equal(context.selected.length, 1);
  const serialized = JSON.stringify(context);
  assert.match(serialized, /Editorial hero/);
  assert.doesNotMatch(serialized, /private-reference-id|Internal name|Private source copy|<table>/);
  assert.equal(buildInternalMailingDesignContext([], { objective: "launch product" }).status, "no_match");
  const bounded = buildInternalMailingDesignContext(
    Array.from({ length: 7 }, (_, index) => entry({
      id: `private-${index}`,
      objective: `launch product ${index}`,
      title: `Internal strategy ${index}`,
    })),
    { objective: "launch product" },
  );
  assert.equal(bounded.selected.length, 4);
});

test("el modo de prueba usa el ranking real y explica sin revelar referencias", () => {
  const candidates = [
    entry({ content: { when_to_use: "After first purchase", sequence_arc: "Educate, then invite", raw_html: "<p>private exact copy</p>", excerpt: "private excerpt" } }),
    entry({ id: "draft-1", status: "draft" }),
    entry({ id: "example-1", kind: "example" }),
    entry({ id: "unauthorized-1", content: { raw_html: "unauthorized secret" }, source: { type: "authorized_import", rights_confirmed: false } }),
  ];
  const preview = previewInternalMailingPlaybook(candidates, { objective: "welcome education", audience: "new customers" });
  const planner = rankInternalMailingPlaybook(candidates, { objective: "welcome education", audience: "new customers" });
  assert.deepEqual(preview.selected.map((item) => item.objective), planner.map((item) => item.objective));
  assert.equal(preview.selected[0]?.title, "Welcome");
  assert.deepEqual(preview.selected[0]?.planner_context, {
    when_to_use: "After first purchase", when_not_to_use: null, sequence_arc: "Educate, then invite",
    visual_direction: null, persuasion_principles: [], cta_guidance: null, risks: [],
  });
  assert.deepEqual(preview.excluded, { not_published: 1, not_strategy: 1, rights_unconfirmed: 1, no_match: 0, outside_top_four: 0 });
  assert.equal(JSON.stringify(preview).includes("private exact copy"), false);
  assert.equal(JSON.stringify(preview).includes("private excerpt"), false);
  assert.equal(JSON.stringify(preview).includes("unauthorized secret"), false);
});

test("la proyección PostgREST conserva el origen/derechos para que A27 no descarte fichas válidas", () => {
  const projected = internalMailingPlaybookRetrievalEntry({
    id: "projection-1", kind: "strategy", title: "Welcome", objective: "welcome new customers",
    audience_tags: ["new customers"], lifecycle_tags: ["welcome"], status: "published",
    source_type: "authorized_import", rights_confirmed: true,
    when_to_use: "After first purchase", sequence_arc: "Teach, then invite",
  });
  assert.equal(projected.source.type, "authorized_import");
  assert.equal(projected.source.rights_confirmed, true);
  assert.equal(rankInternalMailingPlaybook([projected], { objective: "welcome", audience: "new customers" }).length, 1);
  const missingRights = internalMailingPlaybookRetrievalEntry({ ...projected, source_type: "authorized_import", rights_confirmed: false });
  assert.equal(rankInternalMailingPlaybook([missingRights], { objective: "welcome", audience: "new customers" }).length, 0);
});
