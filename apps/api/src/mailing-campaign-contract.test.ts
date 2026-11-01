import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildWeeklyMailingEmailBrief, mailingCampaignViewSchema, mailingEmailStateSchema } from "@e-nora/contracts";
import {
  authorizeMailingCampaign,
  campaignNeedsResume,
  isMailingGraphEnabled,
  readMailingVerbatimTexts,
  startMailingCampaign,
} from "./mailing-campaign.js";
import { readMarketingDraftIdempotencyKey } from "./marketing-draft-idempotency.js";
import { reviewMailingDraft } from "./mailing-campaign-review.js";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");
const ORG = "22222222-2222-4222-8222-222222222222";
const OTHER_ORG = "66666666-6666-4666-8666-666666666666";
const STORE = "33333333-3333-4333-8333-333333333333";
const SEQ = "11111111-1111-4111-8111-111111111111";

test("ADR-0025: migracion, API, runtime y pantalla estan conectados", async () => {
  const [migration, hardening, klaviyo, server, runtime, graph, planner, panel, config] = await Promise.all([
    read("../../../supabase/migrations/20261209100000_mailing_campaign_graph.sql"),
    read("../../../supabase/migrations/20261210100000_mailing_campaign_graph_hardening.sql"),
    read("./klaviyo.ts"),
    read("./server.ts"),
    read("./mailing-campaign.ts"),
    read("./mailing-campaign-graph.ts"),
    read("../../web/src/app/marketing/weekly-mailing-planner.tsx"),
    read("../../web/src/app/marketing/mailing-campaign-panel.tsx"),
    read("../../../packages/config/src/index.ts"),
  ]);
  // Migracion idempotente, con tenant/tienda, RLS de solo lectura y borrado en cascada.
  for (const table of ["mailing_campaign_checkpoints", "mailing_campaign_checkpoint_writes", "marketing_mailing_campaign_emails"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migration, /organization_id uuid not null references public\.organizations \(id\) on delete cascade/);
  assert.match(migration, /add column if not exists orchestrator/);
  assert.doesNotMatch(migration, /grant (insert|update|delete)[^;]*to authenticated/);
  // API: rutas y reanudacion desde la decision existente (sin segundo sistema de aprobacion).
  for (const route of ["/run", "/campaign", "/resume", "/emails/:sequenceNumber/review", "/emails/:sequenceNumber/retry"]) {
    assert.ok(server.includes(`/marketing/weekly-mailing-plan/:sequenceId${route}`), route);
  }
  const decisionRoute = server.slice(server.indexOf("/marketing/drafts/:draftId/decision\""));
  assert.match(decisionRoute.slice(0, 2_000), /decideMarketingContentDraft\([\s\S]*advanceMailingCampaignForDraft\(/);
  // Runtime: los nodos llaman a los runners actuales; nada escribe en Klaviyo.
  assert.match(runtime, /runMarketingContentDraft\(/);
  assert.match(runtime, /setMarketingDraftSchedule\(/);
  assert.doesNotMatch(runtime + graph, /scheduleMarketingKlaviyoCampaign|pushDraftToKlaviyoTemplate|campaign-send-jobs|runContenidoEmailAgent/);
  assert.doesNotMatch(runtime + graph, /@anthropic-ai|from "openai"|@langchain\/(openai|anthropic)|ChatModel/);
  assert.match(runtime, /step_type: "graph_retry"/);
  // Endurecimiento: migracion idempotente, lease, y el envio a Klaviyo ya no espera al consultor (la revision es opinion, no veto).
  assert.match(hardening, /add column if not exists graph_lease_until/);
  assert.match(hardening, /add column if not exists failure_decision/);
  assert.match(hardening, /attempt between 0 and 4/);
  assert.doesNotMatch(hardening, /create table(?! if not exists)/);
  const pushFn = klaviyo.slice(klaviyo.indexOf("export async function pushDraftToKlaviyoTemplate"));
  assert.doesNotMatch(pushFn.slice(0, 6_000), /marketing_draft_awaiting_consultant_review/);
  // Los textos literales llegan a A11 y a la revision automatica.
  assert.match(runtime, /verbatim_texts: verbatimTexts/);
  assert.match(runtime, /readMailingVerbatimTexts\(clientState\)/);
  assert.match(planner, /verbatim_texts: verbatimTexts/);
  assert.match(panel, /emails\/\$\{email\.sequence_number\}\/retry/);
  // Pantalla: componentes nativos y el estado por email.
  assert.match(planner, /\/run`/);
  assert.match(planner, /<MailingCampaignPanel/);
  assert.match(panel, /<DataTable\b/);
  assert.match(panel, /<Badge\b/);
  assert.match(panel, /<Card\b/);
  assert.doesNotMatch(panel, /bg-surface|border-edge/);
  assert.match(config, /MAILING_GRAPH_ENABLED: z\.enum\(\["true", "false"\]\)\.optional\(\)/);
});

test("flag apagado por defecto: el arranque no existe y el navegador sigue con su bucle", async () => {
  assert.equal(isMailingGraphEnabled({}, ORG), false);
  assert.equal(isMailingGraphEnabled({ MAILING_GRAPH_ENABLED: "false" }, ORG), false);
  assert.equal(isMailingGraphEnabled({ MAILING_GRAPH_ENABLED: "true" }, ORG), true);
  assert.equal(isMailingGraphEnabled({ MAILING_GRAPH_ENABLED: "true", MAILING_GRAPH_ORGS: OTHER_ORG }, ORG), false);
  const result = await startMailingCampaign(
    { SUPABASE_URL: "http://unused.invalid" } as any,
    { memberships: [], profile: { platform_role: "consultant" } } as any,
    ORG,
    SEQ,
    {},
  );
  assert.deepEqual(result, { ok: false, statusCode: 404, error: "mailing_graph_disabled" });
  const planner = await read("../../web/src/app/marketing/weekly-mailing-planner.tsx");
  assert.match(planner, /if \(mailingGraphEnabled && sequenceIdempotencyId && sequenceStatus === "planned"\)/);
  assert.match(planner, /idempotency_key: `\$\{sequenceIdempotencyId\}:\$\{emailPlan\.sequence_number\}`/);
  assert.match(planner, /\/marketing\/drafts\/\$\{payload\.draft\.id\}\/schedule/);
});

test("el brief conserva condiciones, evidencia y zona horaria de la revisión", () => {
  const brief = buildWeeklyMailingEmailBrief({
    objective: "conversion", audience: "vip", offer: "", instructions: "sin descuentos", campaignName: "Reposición",
    plan: { diagnosis: "D", sequence_rationale: "S", visual_direction: "V", success_criteria: ["success-marker"],
      stop_criteria: ["stop-marker"], experiment: { hypothesis: "experiment-marker" }, sources: [{ reference: "source-marker" }] },
    email: { title: "T", angle: "A", objective: "O", audience: "Au", subject_direction: "SD", preheader_direction: "PD",
      cta: "C", copy_brief: "CB", visual_modules: "VM", evidence: [{ label: "evidence-marker" }] },
    index: 1, total: 3, scheduledDate: "2026-10-14", timezone: "Europe/Madrid", revision: "approved-revision",
  });
  for (const marker of ["success-marker", "stop-marker", "experiment-marker", "source-marker", "evidence-marker", "approved-revision", "Europe/Madrid", "sin descuentos"]) assert.ok(brief.includes(marker), marker);
  assert.match(brief, /No acredita programación ni envío/);
});

test("aislamiento: otra organizacion, cuenta de tienda u otra tienda no leen ni reanudan", () => {
  const sequence = { organization_id: ORG, store_id: STORE };
  const consultant = { memberships: [{ organization_id: ORG, role: "consultant" }], profile: { platform_role: "consultant" } } as any;
  const outsider = { memberships: [{ organization_id: OTHER_ORG, role: "owner" }], profile: { platform_role: "client" } } as any;
  // Cuenta limitada a tienda: no tiene membership de organizacion (auth-context la separa).
  const storeOnly = { memberships: [], storeMemberships: [{ organization_id: ORG, role: "manager", accessSource: "membership", access_scope: "store", store_ids: [STORE] }], profile: { platform_role: "client" } } as any;
  const viewer = { memberships: [{ organization_id: ORG, role: "viewer" }], profile: { platform_role: "client" } } as any;
  assert.equal(authorizeMailingCampaign(consultant, ORG, sequence).ok, true);
  assert.equal(authorizeMailingCampaign(outsider, ORG, sequence).ok, false);
  assert.equal(authorizeMailingCampaign(storeOnly, ORG, sequence).ok, true);
  assert.equal(authorizeMailingCampaign(storeOnly, ORG, { ...sequence, store_id: OTHER_ORG }).ok, false);
  assert.equal(authorizeMailingCampaign(viewer, ORG, sequence).ok, false);
  // La secuencia de otra organizacion no existe para esta (las consultas filtran por organization_id).
  assert.equal(authorizeMailingCampaign(outsider, OTHER_ORG, { organization_id: ORG, store_id: STORE }).ok, false);
  assert.equal(authorizeMailingCampaign(consultant, ORG, null).ok, false);
  assert.deepEqual(
    authorizeMailingCampaign(consultant, ORG, sequence, "77777777-7777-4777-8777-777777777777"),
    { ok: false, statusCode: 404, error: "mailing_campaign_not_found" },
  );
  assert.equal(authorizeMailingCampaign(consultant, ORG, sequence, STORE).ok, true);
});

test("claves de idempotencia de reintento: :r1 a :r4, nunca mas", () => {
  for (const k of [1, 2, 3, 4]) {
    assert.equal(readMarketingDraftIdempotencyKey(`${SEQ}:2:r${k}`), `${SEQ}:2:r${k}`);
  }
  assert.equal(readMarketingDraftIdempotencyKey(`${SEQ}:2:r5`), null);
  assert.equal(readMarketingDraftIdempotencyKey(`${SEQ}:2`), `${SEQ}:2`);
});

test("revision automatica: enlaces, campos, textos literales y asunto", () => {
  assert.deepEqual(reviewMailingDraft({
    subject: "Hola {{ first_name|default:\"amiga\" }}",
    preheader: "Tu pedido te espera",
    html: '<a href="https://tienda.es/x">Ver</a> {% unsubscribe %}',
    plain_text: "Ver",
    verbatim_texts: ["Ver"],
  }), { passed: true, reasons: [] });
  const bad = reviewMailingDraft({
    subject: "x".repeat(61),
    html: '<a href="#">a</a><a href="/rel">b</a><a href="https://example.com">c</a> {{ first_name }} {{ broken',
    plain_text: "[nombre]",
    verbatim_texts: ["Envío gratis"],
  });
  assert.equal(bad.passed, false);
  for (const fragment of ["61 caracteres", "sin destino", "no es una URL absoluta", "marcador de ejemplo", "sin cerrar", "valor por defecto", "marcadores", "Envío gratis"]) {
    assert.ok(bad.reasons.some((reason) => reason.includes(fragment)), fragment);
  }
  assert.equal(reviewMailingDraft({ subject: "Ok", preheader: "x", html: "<p>sin enlaces</p>", plain_text: null }).passed, false);
});

test("revision automatica: baja sin CTA, preheader y marcadores", () => {
  const unsubscribeOnly = reviewMailingDraft({
    subject: "Ok", preheader: "Resumen", html: '<p>Hola</p><a href="{% unsubscribe_url %}">Baja</a>', plain_text: null,
  });
  assert.equal(unsubscribeOnly.passed, false, "solo el enlace de baja no es llamada a la accion");
  assert.ok(unsubscribeOnly.reasons.some((reason) => reason.includes("ningún enlace")));
  const ok = { subject: "Ok", preheader: "Resumen", html: '<a href="https://tienda.es/x">Ver</a><a href="{% unsubscribe_url %}">Baja</a>', plain_text: null };
  assert.equal(reviewMailingDraft(ok).passed, true);
  assert.ok(reviewMailingDraft({ ...ok, preheader: "" }).reasons.some((reason) => reason.includes("preheader está vacío")));
  assert.ok(reviewMailingDraft({ ...ok, preheader: "p".repeat(141) }).reasons.some((reason) => reason.includes("141 caracteres")));
  // "siglo XX" es texto legitimo; XXX o "XX %" son marcadores sin rellenar.
  assert.equal(reviewMailingDraft({ ...ok, plain_text: "Una pieza del siglo XX" }).passed, true);
  assert.equal(reviewMailingDraft({ ...ok, plain_text: "Ahorra XXX hoy" }).passed, false);
  assert.equal(reviewMailingDraft({ ...ok, plain_text: "Hasta un XX% menos" }).passed, false);
});

test("textos literales de la campaña: se leen del estado guardado, saneados", () => {
  assert.deepEqual(readMailingVerbatimTexts({ verbatim_texts: [" Envío gratis ", "", 4, "x".repeat(2_001), "Ok"] }), ["Envío gratis", "Ok"]);
  assert.deepEqual(readMailingVerbatimTexts({}), []);
  assert.deepEqual(readMailingVerbatimTexts(null), []);
});

test("campaña parada: decision sin aplicar, email detenido o todo terminado sin cerrar", () => {
  const now = Date.parse("2026-10-08T12:00:00.000Z");
  const old = "2026-10-08T11:00:00.000Z";
  const fresh = "2026-10-08T11:59:00.000Z";
  const row = (extra: Record<string, unknown>) => ({ status: "awaiting_approval", updated_at: old, marketing_content_drafts: { status: "pending_approval" }, ...extra });
  assert.equal(campaignNeedsResume("in_progress", [row({})], now), false, "esperando a una persona no es estar parado");
  assert.equal(campaignNeedsResume("in_progress", [row({ marketing_content_drafts: { status: "approved" } })], now), true);
  assert.equal(campaignNeedsResume("in_progress", [row({ status: "drafting" })], now), true);
  assert.equal(campaignNeedsResume("in_progress", [row({ status: "drafting", updated_at: fresh })], now), false);
  assert.equal(campaignNeedsResume("in_progress", [row({ status: "failed" })], now), false, "fallido sin decidir espera a una persona");
  assert.equal(campaignNeedsResume("in_progress", [row({ status: "failed", failure_decision: "retry" })], now), true);
  assert.equal(campaignNeedsResume("in_progress", [row({ status: "scheduled" }), row({ status: "rejected" })], now), true, "todos terminados y sin cerrar");
  assert.equal(campaignNeedsResume("in_progress", [], now), true, "missing bootstrap checkpoint remains discoverable");
  assert.equal(campaignNeedsResume("abandoned", [row({ status: "drafting" })], now), false);
  assert.equal(campaignNeedsResume("completed", [row({ status: "scheduled" })], now), false);
});

test("contrato: estado de email y vista validan con Zod", () => {
  const email = {
    sequence_number: 1, title: "T", scheduled_for: "2026-10-14T07:00:00.000Z", brief: "b", image_url: null,
    status: "awaiting_approval", attempt: 2, draft_id: null, auto_review_passed: false,
    rejections: [{ attempt: 0, source: "auto_review", reasons: ["x"], at: "2026-10-08T10:00:00.000Z" }],
    last_error: null, decided_by: null, decided_role: null,
  };
  assert.equal(mailingEmailStateSchema.safeParse(email).success, true);
  assert.equal(mailingEmailStateSchema.safeParse({ ...email, attempt: 4 }).success, true);
  assert.equal(mailingEmailStateSchema.safeParse({ ...email, attempt: 5 }).success, false, "el tope vive tambien en el contrato");
  assert.equal(mailingCampaignViewSchema.safeParse({
    sequence_id: SEQ, campaign_name: "c", sequence_status: "in_progress", orchestrator: "graph",
    requires_consultant_review: false, needs_resume: false, emails: [],
  }).success, true);
});
