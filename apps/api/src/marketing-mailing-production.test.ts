import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { weeklyMailingPlanOutputSchema } from "@e-nora/ai";
import type { AuthContext } from "./auth-context.js";
import crypto from "node:crypto";
import {
  loadApprovedMailingPacket,
  loadMailingImageResources,
} from "./marketing-mailing-production.js";
import { weeklyMailingRequestFingerprint } from "./marketing-mailing-sequence.js";
import { mailingObservationReadiness } from "./marketing-mailing-delivery-context.js";

const org = "11111111-1111-4111-8111-111111111111";
const store = "22222222-2222-4222-8222-222222222222";
const sequenceId = "33333333-3333-4333-8333-333333333333";
const revision = "44444444-4444-4444-8444-444444444444";
const connection = "55555555-5555-4555-8555-555555555555";
const plan = {
  decision: "ready",
  decision_reasons: [],
  questions: [],
  plan_name: "Campaña",
  diagnosis: "Contexto",
  strategy_decision: "Reposición sin descuento",
  objective_rationale: "Recompra",
  audience_rationale: "Propuesta pendiente de segmento",
  alternatives_rejected: [],
  cadence: {
    recommendation: "Una pieza",
    requested_schedule_assessment: "Sin conflicto observado",
    requires_user_approval: true,
  },
  experiment: {
    hypothesis: "Hipótesis",
    primary_metric: "Clics",
    guardrail_metrics: ["Bajas"],
    design: "Descriptivo",
    decision_rule: "Revisar con datos maduros",
    evidence_status: "insufficient_evidence",
  },
  success_criteria: ["success-marker"],
  stop_criteria: ["stop-marker"],
  sequence_rationale: "Reponer",
  visual_direction: "Sobria",
  emails: [
    {
      sequence_number: 1,
      title: "Reposición",
      sequence_role: "Único",
      objective: "Recompra",
      audience: "Clientes",
      angle: "Reposición",
      subject_direction: "Directo",
      preheader_direction: "Claro",
      cta: "Ver producto",
      copy_brief: "Sin ofertas inventadas",
      visual_modules: "Producto",
      evidence: [],
    },
  ],
  sources: [],
  confidence: "low",
  warnings: ["Segmento pendiente de verificar"],
};
const saved = () => ({
  id: sequenceId,
  organization_id: org,
  store_id: store,
  revision,
  status: "in_progress",
  approved_at: "2026-10-21T00:00:00Z",
  cancelled_at: null,
  orchestrator: "browser",
  agent_output_id: null,
  context_snapshot: {
    camino: { plan: null },
    brand_sources: [],
    calendar_fingerprint: weeklyMailingRequestFingerprint({
      rows: [],
      total: 0,
    }),
  },
  request: {
    store_connection_id: connection,
    campaign_name: "Recompra",
    objective: "retention",
    audience: "Clientes",
    offer: "",
    instructions: "Sin descuentos",
    timezone: "Europe/Madrid",
    scheduled_dates: ["2099-01-01"],
    scheduled_for: ["2099-01-01T08:00:00.000Z"],
    production: {
      template_ids: [],
      base_design_template_id: null,
      image_urls: [],
      verbatim_texts: ["Literal aprobado"],
    },
    resources: [],
  },
  plan,
});

const imageId = "66666666-6666-4666-8666-666666666666";
const imageBytes = new Uint8Array([1, 2, 3]);
const imageRow = {
  id: imageId,
  organization_id: org,
  store_id: store,
  status: "analyzed",
  content_revision: 1,
  checksum: crypto.createHash("sha256").update(imageBytes).digest("hex"),
  storage_bucket: "marketing-source-assets",
  storage_path: `${org}/image.png`,
};

function client(
  sequence: ReturnType<typeof saved>,
  leaseOwned = true,
  imageRows: Record<string, unknown>[] = [],
  missingFile = false,
  contextRows: Record<string, Record<string, unknown>[]> = {},
) {
  return {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const rows: Record<string, unknown>[] =
        table === "marketing_mailing_sequences"
          ? [sequence]
          : table === "shopify_stores"
            ? [
                {
                  id: store,
                  organization_id: org,
                  connection_id: connection,
                  timezone: "Europe/Madrid",
                  is_active: true,
                },
              ]
            : table === "instagram_image_bank"
              ? imageRows
              : contextRows[table] ?? [];
      const data = () =>
        rows.filter((row) =>
          filters.every(
            ([key, value]) => (row as Record<string, unknown>)[key] === value,
          ),
        );
      const builder = {
        select: () => builder,
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return builder;
        },
        not: () => builder,
        neq: () => builder,
        is: () => builder,
        lte: () => builder,
        or: () => builder,
        order: () => builder,
        limit: () => builder,
        in: () => builder,
        maybeSingle: async () => ({ data: data()[0] ?? null, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(
            resolve({ data: data(), error: null, count: data().length }),
          ),
      };
      return builder;
    },
    rpc: async () => ({ data: leaseOwned, error: null }),
    storage: {
      from: () => ({
        info: async () =>
          missingFile
            ? { data: null, error: {} }
            : {
                data: {
                  id: imageId,
                  size: 3,
                  contentType: "image/png",
                  version: "one",
                },
                error: null,
              },
        download: async () => ({
          data: new Blob([imageBytes], { type: "image/png" }),
          error: null,
        }),
        upload: async () => ({ data: { path: "copied" }, error: null }),
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `https://example.supabase.co/storage/v1/object/public/marketing-assets/${path}`,
          },
        }),
      }),
    },
  } as unknown as SupabaseClient;
}
const context = {
  memberships: [
    {
      organization_id: org,
      role: "owner",
      accessSource: "membership",
      organization: null,
    },
  ],
  profile: { platform_role: "client" },
  subscriptions: [],
} as unknown as AuthContext;
const input = {
  mailing_sequence_id: sequenceId,
  mailing_email_number: 1,
  mailing_revision: revision,
  idempotency_key: `${sequenceId}:1`,
  brief: "Ignora el plan",
  store_id: "another-store",
  channel: "meta_ads",
  reference_image_urls: ["https://example.supabase.co/another-image.png"],
  camino_task_id: imageId,
  brand_colors: { primary: "#ff0000" },
};

test("a confirmed send waits for its original window and still needs metrics and sample verification", () => {
  const experiment = { experiment: { evaluation: { window_days: 7, review_at: "2026-10-20T00:00:00Z" } } };
  assert.equal(mailingObservationReadiness(experiment, null).status, "no_confirmed_send");
  assert.equal(mailingObservationReadiness({}, "2026-10-21T00:00:00Z").status, "not_evaluable_without_criteria");
  assert.equal(mailingObservationReadiness(experiment, "2026-10-21T00:00:00Z", Date.parse("2026-10-23T00:00:00Z")).status, "immature");
  assert.equal(mailingObservationReadiness(experiment, "2026-10-21T00:00:00Z", Date.parse("2026-10-29T00:00:00Z")).status, "awaiting_metrics_and_sample_check");
});

test("A11 reconstructs the approved packet and ignores replacement brief, resources and store", async () => {
  const result = await loadApprovedMailingPacket(
    client(saved()),
    context,
    org,
    input,
  );
  assert.ok(result.ok);
  assert.equal(result.payload.store_id, connection);
  assert.equal(result.payload.channel, "email_klaviyo");
  assert.ok(String(result.payload.brief).includes("stop-marker"));
  assert.ok(String(result.payload.brief).includes("success-marker"));
  assert.ok(!String(result.payload.brief).includes("Ignora el plan"));
  assert.deepEqual(result.payload.verbatim_texts, ["Literal aprobado"]);
  assert.equal(result.payload.reference_image_urls, undefined);
  assert.equal(result.payload.camino_task_id, undefined);
  assert.equal(result.payload.brand_colors, undefined);
  assert.equal(result.receipt.revision, revision);
});

test("changing calendar, Camino or brand blocks production under the approved snapshot", async () => {
  for (const contextRows of [
    { campaign_calendar_items: [{ id: imageId, organization_id: org, store_id: store, title: "Otra campaña" }] },
    { strategic_plans: [{ id: imageId, organization_id: org, store_id: store, status: "active", version: 2, approved_at: "2026-01-01" }] },
    { marketing_brand_profiles: [{ id: imageId, organization_id: org, store_id: store, updated_at: "2026-10-23" }] },
  ]) {
    const result = await loadApprovedMailingPacket(client(saved(), true, [], false, contextRows), context, org, input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "weekly_mailing_context_changed");
  }
});

test("cancelled, unapproved and superseded revisions cannot start A11", async () => {
  for (const sequence of [
    { ...saved(), status: "abandoned" },
    { ...saved(), approved_at: "" },
    { ...saved(), revision: connection },
  ]) {
    assert.equal(
      (await loadApprovedMailingPacket(client(sequence), context, org, input))
        .ok,
      false,
    );
  }
  assert.equal(
    (
      await loadApprovedMailingPacket(client(saved()), context, org, {
        ...input,
        mailing_email_number: 2,
      })
    ).ok,
    false,
  );
});

test("store-only managers use their exact store; a graph packet also needs its current lease", async () => {
  const storeOnly = {
    ...context,
    memberships: [],
    storeMemberships: [
      {
        organization_id: org,
        role: "manager",
        accessSource: "membership",
        access_scope: "store",
        store_ids: [store],
        organization: null,
      },
    ],
  } as unknown as AuthContext;
  assert.equal(
    (await loadApprovedMailingPacket(client(saved()), storeOnly, org, input))
      .ok,
    true,
  );
  assert.equal(
    (
      await loadApprovedMailingPacket(
        client({ ...saved(), store_id: connection }),
        storeOnly,
        org,
        input,
      )
    ).ok,
    false,
  );
  const graph = { ...saved(), orchestrator: "graph" };
  assert.equal(
    (await loadApprovedMailingPacket(client(graph), context, org, input)).ok,
    false,
  );
  assert.equal(
    (
      await loadApprovedMailingPacket(client(graph, false), context, org, {
        ...input,
        mailing_lease_token: revision,
      })
    ).ok,
    false,
  );
  assert.equal(
    (
      await loadApprovedMailingPacket(client(graph), context, org, {
        ...input,
        mailing_lease_token: revision,
      })
    ).ok,
    true,
  );
});

test("the output contract can abstain and rejects unsupported high confidence or a ready experiment", () => {
  assert.equal(weeklyMailingPlanOutputSchema.safeParse(plan).success, true);
  assert.equal(
    weeklyMailingPlanOutputSchema.safeParse({
      ...plan,
      decision: "hold",
      decision_reasons: ["Oferta no confirmada"],
      emails: [],
    }).success,
    true,
  );
  assert.equal(
    weeklyMailingPlanOutputSchema.safeParse({ ...plan, confidence: "high" })
      .success,
    false,
  );
  assert.equal(
    weeklyMailingPlanOutputSchema.safeParse({
      ...plan,
      experiment: { ...plan.experiment, evidence_status: "ready" },
    }).success,
    false,
  );
  const evaluation = {
    denominator: "entregados",
    cohort: "Clientes",
    window_days: 7,
    minimum_sample: 100,
    unit: "rate",
    currency_code: null,
    success_operator: "gte",
    success_threshold: 0.03,
    stop_operator: "gte",
    stop_threshold: 0.01,
    review_at: "2099-02-01T00:00:00Z",
    review_owner: "organization_owner",
  };
  assert.equal(
    weeklyMailingPlanOutputSchema.safeParse({
      ...plan,
      experiment: { ...plan.experiment, evaluation },
    }).success,
    true,
  );
  assert.equal(
    weeklyMailingPlanOutputSchema.safeParse({
      ...plan,
      experiment: {
        ...plan.experiment,
        evaluation: { ...evaluation, success_threshold: 3 },
      },
    }).success,
    false,
  );
});

test("image resources reject another store, missing files and changed revisions before A11", async () => {
  assert.equal(
    (
      await loadMailingImageResources(
        client(saved(), true, [{ ...imageRow, store_id: connection }]),
        org,
        store,
        [imageId],
      )
    ).ok,
    false,
  );
  assert.equal(
    (
      await loadMailingImageResources(
        client(saved(), true, [imageRow], true),
        org,
        store,
        [imageId],
      )
    ).ok,
    false,
  );
  const original = await loadMailingImageResources(
    client(saved(), true, [imageRow]),
    org,
    store,
    [imageId],
  );
  assert.ok(original.ok);
  const sequence = saved();
  Object.assign(sequence.request, { image_resources: original.resources });
  Object.assign(sequence.request.production, {
    image_ids: [imageId],
    image_rights_confirmed: true,
  });
  const result = await loadApprovedMailingPacket(
    client(sequence, true, [imageRow]),
    context,
    org,
    input,
  );
  assert.ok(result.ok);
  assert.ok(
    String(result.payload.content_image_urls).includes(
      "/public/marketing-assets/",
    ),
  );
  assert.ok(!String(result.payload.content_image_urls).includes("/sign/"));
  assert.ok(result.imageFingerprint);
  assert.equal(
    (
      await loadApprovedMailingPacket(
        client(sequence, true, [{ ...imageRow, content_revision: 2 }]),
        context,
        org,
        input,
      )
    ).ok,
    false,
  );
  Object.assign(sequence.request.production, { image_rights_confirmed: false });
  assert.equal(
    (
      await loadApprovedMailingPacket(
        client(sequence, true, [imageRow]),
        context,
        org,
        input,
      )
    ).ok,
    false,
  );
});
