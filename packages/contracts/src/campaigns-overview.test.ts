import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregatePortfolioCampaigns,
  awaitsConsultantReview,
  buildClientCampaignsHeadline,
  buildClientViewCampaignsHeadline,
  buildPortfolioCampaignsHeadline,
  buildStoreCampaignsHeadline,
  campaignWorkState,
  emptySentRollup,
  isWithinNextDays,
  klaviyoWorkState,
  needsClientApproval,
  summarizeClientCampaigns,
  type CampaignBrief,
  type CampaignItemFacts,
  type CampaignWorkState,
} from "./campaigns-overview.js";

// Miercoles 7 de octubre de 2026, 09:00 UTC.
const NOW = Date.parse("2026-10-07T09:00:00Z");

const facts = (patch: Partial<CampaignItemFacts> = {}): CampaignItemFacts => ({
  status: "planned",
  starts_at: "2026-10-12T08:00:00Z",
  has_draft: false,
  draft_status: null,
  klaviyo_status: null,
  meta_status: null,
  is_a05_proposal: false,
  ...patch,
});

function brief(
  id: string,
  title: string,
  day: string,
  state: CampaignWorkState,
  patch: Partial<CampaignBrief> = {},
): CampaignBrief {
  return {
    id,
    title,
    channel: "email",
    starts_at: `2026-10-${day}T08:00:00Z`,
    state,
    origin: "staff",
    review_status: null,
    store_id: null,
    store_label: null,
    ...patch,
  };
}

test("estado: sin pieza, con borrador, aprobada, retrasada y propuesta de A05", () => {
  assert.equal(campaignWorkState(facts(), NOW), "nopiece");
  assert.equal(campaignWorkState(facts({ is_a05_proposal: true }), NOW), "plan");
  assert.equal(campaignWorkState(facts({ has_draft: true, draft_status: "pending_approval" }), NOW), "review");
  assert.equal(campaignWorkState(facts({ has_draft: true, draft_status: "approved" }), NOW), "ready");
  assert.equal(campaignWorkState(facts({ starts_at: "2026-10-05T08:00:00Z" }), NOW), "late");
  assert.equal(campaignWorkState(facts({ status: "cancelled" }), NOW), "cancelled");
  // Una planificada ya publicada sin campaña enlazada no va tarde: salio.
  assert.equal(campaignWorkState(facts({ status: "completed", starts_at: "2026-10-01T08:00:00Z" }), NOW), "sent");
});

test("estado: la campaña real del proveedor manda sobre la fecha", () => {
  assert.equal(campaignWorkState(facts({ klaviyo_status: "Scheduled", starts_at: "2026-10-01T08:00:00Z" }), NOW), "scheduled");
  assert.equal(campaignWorkState(facts({ klaviyo_status: "Sent" }), NOW), "sent");
  assert.equal(campaignWorkState(facts({ meta_status: "ACTIVE" }), NOW), "active");
  assert.equal(campaignWorkState(facts({ meta_status: "PAUSED" }), NOW), "paused");
  assert.equal(klaviyoWorkState("Cancelled"), "cancelled");
  assert.equal(klaviyoWorkState(null), "draft");
});

test("ventana de 7 dias: hoy cuenta aunque la hora ya pasara; ayer no", () => {
  assert.equal(isWithinNextDays("2026-10-07T07:00:00Z", NOW), true);
  assert.equal(isWithinNextDays("2026-10-14T08:00:00Z", NOW), true);
  assert.equal(isWithinNextDays("2026-10-15T08:00:00Z", NOW), false);
  assert.equal(isWithinNextDays("2026-10-06T08:00:00Z", NOW), false);
});

test("revision: solo cuenta lo que creo el cliente y espera al consultor", () => {
  assert.equal(awaitsConsultantReview({ origin: "client", review_status: "pending" }), true);
  assert.equal(awaitsConsultantReview({ origin: "client", review_status: "reviewed" }), false);
  assert.equal(awaitsConsultantReview({ origin: "staff", review_status: "pending" }), false);
});

test("aprobacion del cliente: con consultor no aprueba lo suyo; sin consultor, si", () => {
  const own = { state: "review" as const, origin: "client" as const, review_status: "pending" as const };
  const prepared = { state: "review" as const, origin: "staff" as const, review_status: null };
  assert.equal(needsClientApproval(own, true), false);
  assert.equal(needsClientApproval(prepared, true), true);
  assert.equal(needsClientApproval(own, false), true);
  assert.equal(needsClientApproval({ ...prepared, state: "ready" }, true), false);
});

function summary(name: string, items: CampaignBrief[], lastWeek = emptySentRollup()) {
  return summarizeClientCampaigns({
    organization_id: name.toLowerCase(),
    organization_name: name,
    store_count: 1,
    items,
    last_week: lastWeek,
    nowMs: NOW,
  });
}

test("resumen de cliente: semana, retrasadas, por revisar y sin pieza", () => {
  const result = summary("Huerta Norte", [
    brief("1", "Newsletter", "08", "ready"),
    brief("2", "Segundo envío", "10", "scheduled"),
    brief("3", "Oferta del puente", "11", "nopiece", { origin: "client", review_status: "pending" }),
    brief("4", "Recordatorio", "12", "nopiece"),
    brief("5", "Aceite", "05", "late"),
    brief("6", "Lejana", "22", "nopiece"),
  ]);
  assert.equal(result.week.length, 4);
  assert.equal(result.late, 1);
  assert.equal(result.awaiting_review, 1);
  // La creada por el cliente se revisa aparte: no cuenta como "sin pieza".
  assert.equal(result.no_piece_soon, 1);
  assert.equal(result.scheduled, 1);
});

test("cartera: media ponderada por envios y suma de EUR atribuidos", () => {
  const a = summary("A", [brief("1", "x", "08", "ready")], { sent: 2, open_rate: 0.4, click_rate: 0.04, revenue: 1000 });
  const b = summary("B", [], { sent: 1, open_rate: 0.1, click_rate: 0.01, revenue: 500 });
  const c = summary("C", [], emptySentRollup());
  const totals = aggregatePortfolioCampaigns([a, b, c]);
  assert.equal(totals.last_week.sent, 3);
  assert.ok(Math.abs((totals.last_week.open_rate ?? 0) - 0.3) < 1e-9);
  assert.equal(totals.last_week.revenue, 1500);
  assert.deepEqual(totals.clients_without_sends, ["B", "C"]);
  assert.equal(totals.clients_with_sends, 1);
});

test("titular de cartera: lo que han creado los clientes manda sobre lo que va tarde", () => {
  const huerta = summary(
    "Huerta Norte",
    [
      brief("1", "Newsletter", "08", "ready"),
      brief("2", "Oferta del puente", "11", "nopiece", { origin: "client", review_status: "pending" }),
      brief("3", "Aceite", "05", "late"),
    ],
    { sent: 2, open_rate: 0.3985, click_rate: 0.0345, revenue: 2760 },
  );
  const pet = summary("Pet Market Sur", [brief("4", "Promo", "13", "nopiece", { origin: "client", review_status: "pending" })], {
    sent: 3,
    open_rate: 0.364,
    click_rate: 0.029,
    revenue: 1420,
  });
  const deporte = summary("Deporte Valle", []);
  const clients = [huerta, pet, deporte];
  const totals = aggregatePortfolioCampaigns(clients);
  const headline = buildPortfolioCampaignsHeadline(clients, totals);
  assert.equal(headline.title, "Huerta Norte y Pet Market Sur han creado campañas que esperan tu revisión.");
  assert.match(headline.detail, /^Esta semana salen 3 envíos en 2 clientes, 1 va tarde\./);
  assert.match(headline.detail, /Deporte Valle no tiene nada planificado\./);
  assert.match(headline.detail, /La semana pasada salieron 5 emails con 37,8 % de apertura y 4\.180 € atribuidos por Klaviyo\.$/);
});

test("titular de cartera: sin pendientes de revision, habla de lo que va tarde y, si no, de que todo va bien", () => {
  const late = summary("A", [brief("1", "x", "05", "late"), brief("2", "y", "05", "late")]);
  assert.equal(
    buildPortfolioCampaignsHeadline([late], aggregatePortfolioCampaigns([late])).title,
    "2 campañas van tarde.",
  );
  const fine = summary("B", [brief("3", "z", "08", "ready")]);
  assert.equal(
    buildPortfolioCampaignsHeadline([fine], aggregatePortfolioCampaigns([fine])).title,
    "Tu cartera lleva el calendario al día.",
  );
});

test("titular de cliente: nombra la campaña que creo y la que no ha salido", () => {
  const items = [
    brief("1", "Oferta del puente", "11", "nopiece", { origin: "client", review_status: "pending" }),
    brief("2", "Reposición de aceite", "05", "late"),
    brief("3", "Newsletter", "08", "ready"),
  ];
  const result = summary("Huerta Norte", items);
  const headline = buildClientCampaignsHeadline(result, items);
  assert.equal(
    headline.title,
    "Huerta Norte ha creado «Oferta del puente» y espera tu revisión; además «Reposición de aceite» no ha salido.",
  );
  assert.match(headline.detail, /^Esta semana salen 2 envíos\. La semana pasada no salió ningún email\.$/);
});

test("titular de tienda: lo que creo el cliente, despues lo retrasado, y desglosa la semana", () => {
  const items = [
    brief("1", "Oferta del puente", "11", "nopiece", { origin: "client", review_status: "pending" }),
    brief("2", "Newsletter", "08", "ready"),
    brief("3", "Segundo envío", "10", "scheduled"),
    brief("4", "Recordatorio", "12", "nopiece"),
    brief("5", "Membrillo", "14", "review"),
  ];
  const headline = buildStoreCampaignsHeadline("huertanorte.es", items, NOW);
  assert.equal(headline.title, "«Oferta del puente» la ha creado el cliente y espera tu revisión.");
  assert.equal(
    headline.detail,
    "Esta semana salen 5 envíos: 1 creada por el cliente, 1 lista, 1 programada, 1 en revisión del cliente, 1 sin pieza.",
  );
  const late = [brief("6", "Aceite", "05", "late")];
  assert.equal(
    buildStoreCampaignsHeadline("huertanorte.es", late, NOW).title,
    "«Aceite» debía salir el lunes y no ha salido.",
  );
});

test("titular del cliente: con consultor pide su visto bueno; sin consultor, que apruebe lo suyo", () => {
  const membrillo = brief("1", "Lanzamiento membrillo", "14", "review");
  const withConsultant = buildClientViewCampaignsHeadline({
    clientHasConsultant: true,
    weekCount: 4,
    pendingApproval: [membrillo],
    ownUnderReview: [brief("2", "Oferta del puente", "11", "review", { origin: "client", review_status: "pending" })],
    late: brief("3", "Reposición de aceite", "05", "late"),
  });
  assert.equal(withConsultant.title, "Esta semana salen 4 emails y 1 necesita tu visto bueno.");
  assert.match(withConsultant.detail, /Tu consultor está revisando «Oferta del puente», la que creaste tú\./);
  assert.match(withConsultant.detail, /«Reposición de aceite» se retrasó/);
  // Nada de estados internos para el cliente.
  assert.doesNotMatch(`${withConsultant.title} ${withConsultant.detail}`, /Plan IA|Sin pieza/);

  const alone = buildClientViewCampaignsHeadline({
    clientHasConsultant: false,
    weekCount: 3,
    pendingApproval: [brief("4", "Oferta del puente", "11", "review")],
    ownUnderReview: [],
    late: null,
  });
  assert.equal(alone.title, "Esta semana salen 3 emails: «Oferta del puente» está lista para que la apruebes.");
  assert.match(alone.detail, /Tu asistente escribe los emails/);
});

test("titular del cliente: sin envios y todo aprobado", () => {
  assert.equal(
    buildClientViewCampaignsHeadline({ clientHasConsultant: true, weekCount: 0, pendingApproval: [], ownUnderReview: [], late: null }).title,
    "Esta semana no sale ningún email.",
  );
  assert.equal(
    buildClientViewCampaignsHeadline({ clientHasConsultant: true, weekCount: 1, pendingApproval: [], ownUnderReview: [], late: null }).title,
    "Esta semana sale 1 email y todo está aprobado.",
  );
});
