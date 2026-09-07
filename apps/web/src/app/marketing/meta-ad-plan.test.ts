/**
 * El plan de Meta se arma a partir del borrador aprobado. Lo que se comprueba
 * aqui es lo que costaria dinero real el dia que esto deje de ser dry-run:
 * que el creativo sea el aprobado, que el presupuesto sea el que se tecleo y
 * que preparar dos veces el mismo anuncio no cuente como dos anuncios.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMetaPlanRequest,
  eurosToMinorUnits,
  metaPlanIdempotencyKey,
  metaPlanNamesFromDraft,
} from "./meta-ad-plan";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";

function draftFixture(overrides: Partial<MarketingDraft> = {}): MarketingDraft {
  return {
    id: "8f1c3a2e-1111-4222-8333-444455556666",
    status: "approved",
    content_type: "campaign",
    request: { channel: "meta_ads", brief: "brief sin aprobar" },
    summary: "",
    template_name: "Rebajas de verano",
    subject: "Hasta -50% en toda la tienda",
    preheader: "",
    from_name: "",
    reply_to: null,
    purpose: "",
    audience: "",
    locale: "es-ES",
    tone: "brand",
    plain_text: "Texto principal aprobado por el consultor.",
    html: "",
    blocks: [{ type: "button", content: "Comprar", href: "https://tienda.com/rebajas" }],
    personalization_tokens: [],
    compliance_notes: [],
    sources: [],
    confidence: "medium",
    warnings: [],
    version: 3,
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-01T10:00:00.000Z",
    scheduled_for: null,
    decision_reason: null,
    campaign_item: null,
    ...overrides,
  };
}

const values = {
  adAccountId: "act_123456789",
  campaignObjective: "OUTCOME_SALES",
  dailyBudgetEuros: "25",
};

test("el presupuesto se teclea en euros y viaja en unidades menores", () => {
  // El campo pedia centimos: escribir 30 pensando en 30 EUR configuraba una
  // campaña de 0,30 EUR al dia y nadie lo veia hasta mirar Meta.
  assert.equal(eurosToMinorUnits("25"), 2500);
  assert.equal(eurosToMinorUnits("12,50"), 1250);
  assert.equal(eurosToMinorUnits("12.50"), 1250);
  assert.equal(eurosToMinorUnits(" 8 "), 800);

  for (const invalid of ["0", "-5", "", "abc", "10.999", "1e3"]) {
    assert.ok(
      Number.isNaN(eurosToMinorUnits(invalid)),
      `"${invalid}" no es un presupuesto`,
    );
  }
});

test("el creativo sale del borrador aprobado, no del brief de generacion", () => {
  const request = buildMetaPlanRequest(draftFixture(), values);
  assert.equal(request.ok, true);
  if (!request.ok) return;

  const creative = request.body.creativeSpec as Record<string, unknown>;
  assert.equal(creative.headline, "Hasta -50% en toda la tienda");
  assert.equal(creative.body, "Texto principal aprobado por el consultor.");
  assert.equal(creative.callToAction, "Comprar");
  assert.equal(creative.link, "https://tienda.com/rebajas");
  assert.equal(request.body.dailyBudgetMinor, 2500);
  assert.equal(request.body.campaignName, "Rebajas de verano");
  assert.equal(request.body.adSetName, "Rebajas de verano · conjunto");

  // El brief nunca llega al plan.
  assert.doesNotMatch(JSON.stringify(request.body), /brief sin aprobar/);
});

test("un borrador sin aprobar no puede preparar plan", () => {
  for (const status of ["draft", "pending_approval", "rejected"] as const) {
    const request = buildMetaPlanRequest(draftFixture({ status }), values);
    assert.equal(request.ok, false, `${status} no deberia poder`);
  }
});

test("cuenta y presupuesto se validan antes de salir a la red", () => {
  const sinCuenta = buildMetaPlanRequest(draftFixture(), {
    ...values,
    adAccountId: "  ",
  });
  assert.equal(sinCuenta.ok, false);

  const presupuestoRoto = buildMetaPlanRequest(draftFixture(), {
    ...values,
    dailyBudgetEuros: "0",
  });
  assert.equal(presupuestoRoto.ok, false);
});

test("la clave de idempotencia identifica al borrador, no al instante", () => {
  const draft = draftFixture();
  assert.equal(
    metaPlanIdempotencyKey(draft),
    metaPlanIdempotencyKey(draftFixture()),
    "preparar dos veces el mismo borrador es el mismo anuncio",
  );
  assert.notEqual(
    metaPlanIdempotencyKey(draft),
    metaPlanIdempotencyKey(draftFixture({ version: 4 })),
    "otra version del creativo es otro anuncio",
  );
  // El contrato de integrations la rechaza si no encaja aqui.
  assert.match(metaPlanIdempotencyKey(draft), /^[A-Za-z0-9:_-]{16,200}$/);
});

test("sin nombre de plantilla el plan usa el asunto y nunca queda vacio", () => {
  assert.equal(
    metaPlanNamesFromDraft(draftFixture({ template_name: "" })).campaignName,
    "Hasta -50% en toda la tienda",
  );
  assert.equal(
    metaPlanNamesFromDraft(draftFixture({ template_name: "", subject: "  " }))
      .campaignName,
    "Campaña",
    "el contrato de Meta rechaza un nombre vacio",
  );
});
