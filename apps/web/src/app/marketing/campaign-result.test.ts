/**
 * ADR-0021 en codigo. Klaviyo y Meta atribuyen cada uno por su cuenta y la
 * misma venta puede contarse en los dos; sumarlas produce una cifra que no
 * existe y que puede superar a la venta real de Shopify. Este fichero es el
 * unico sitio que decide como se leen esos numeros juntos, asi que aqui es
 * donde tiene que estar escrito que NO se suman.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { campaignResults, canMeasureCampaign } from "./campaign-result";
import type {
  KlaviyoAttribution,
  MetaAttribution,
} from "@/hooks/use-attribution-report";

const klaviyo = {
  connected: true,
  period: { days: 30, start: null, end: "2026-09-06T00:00:00.000Z" },
  totals: {
    revenue: 0,
    conversions: 0,
    recipients: 0,
    delivered: 0,
    open_rate: null,
    click_rate: null,
  },
  previous: null,
  campaigns: [
    {
      id: "kl-1",
      name: "Carrito abandonado",
      subject: null,
      send_time: null,
      revenue: 1240,
      conversions: 31,
      open_rate: 0.42,
      click_rate: 0.06,
    },
  ],
} satisfies KlaviyoAttribution;

const meta = {
  period: { days: 30, start: null, end: "2026-09-06T00:00:00.000Z" },
  acquisition: {
    spend: 0,
    purchases: 0,
    purchase_value: 0,
    roas: null,
    purchase_action_types: [],
  },
  campaigns: [
    {
      campaign_id: "mt-1",
      campaign_name: "Retargeting",
      spend: "500",
      purchases: "18",
      purchase_value: "1400",
      roas: "2.8",
      purchase_action_type: "omni_purchase",
    },
  ],
} satisfies MetaAttribution;

test("una campaña en las dos plataformas devuelve DOS cifras, nunca una suma", () => {
  const results = campaignResults(
    { klaviyo_campaign_id: "kl-1", meta_campaign_id: "mt-1" },
    klaviyo,
    meta,
  );

  assert.equal(results.length, 2, "dos plataformas, dos cifras separadas");
  assert.deepEqual(
    results.map((result) => [result.source, result.revenue]),
    [
      ["Klaviyo", 1240],
      ["Meta", 1400],
    ],
  );
  // 2.640 EUR no existe en ninguna parte: es la misma venta contada dos veces.
  assert.ok(
    !results.some((result) => result.revenue === 2640),
    "sumarlas seria inventar una cifra",
  );
});

test("cada cifra dice quien la atribuye", () => {
  const results = campaignResults(
    { klaviyo_campaign_id: "kl-1", meta_campaign_id: null },
    klaviyo,
    meta,
  );
  assert.equal(results[0]?.source, "Klaviyo");
  // Klaviyo no da retorno sobre gasto: inventarle un ROAS seria peor que no
  // enseñarlo.
  assert.equal(results[0]?.roas, null);
});

test("Meta trae ROAS y sus numeros llegan como texto desde Postgres", () => {
  const results = campaignResults(
    { klaviyo_campaign_id: null, meta_campaign_id: "mt-1" },
    klaviyo,
    meta,
  );
  assert.equal(results[0]?.revenue, 1400);
  assert.equal(results[0]?.roas, 2.8);
});

test("sin enlace no hay resultado, aunque la plataforma tenga datos", () => {
  assert.deepEqual(
    campaignResults(
      { klaviyo_campaign_id: null, meta_campaign_id: null },
      klaviyo,
      meta,
    ),
    [],
    "adivinar la campaña por nombre atribuiria el resultado de otra",
  );
});

test("un enlace a una campaña fuera del periodo no inventa un cero", () => {
  // Un cero se lee como 'no funciono'. La ausencia de datos se lee como otra
  // cosa, y la UI puede decir 'sin datos del periodo'.
  assert.deepEqual(
    campaignResults(
      { klaviyo_campaign_id: "kl-desconocida", meta_campaign_id: null },
      klaviyo,
      meta,
    ),
    [],
  );
});

test("Klaviyo sin conectar no aporta cifras", () => {
  assert.deepEqual(
    campaignResults(
      { klaviyo_campaign_id: "kl-1", meta_campaign_id: null },
      { ...klaviyo, connected: false },
      meta,
    ),
    [],
  );
});

test("una campaña que aun no ha empezado no se puede medir", () => {
  const now = Date.parse("2026-09-06T12:00:00.000Z");
  assert.equal(
    canMeasureCampaign(
      { starts_at: "2026-09-20T00:00:00.000Z", status: "planned" },
      now,
    ),
    false,
  );
  assert.equal(
    canMeasureCampaign(
      { starts_at: "2026-09-01T00:00:00.000Z", status: "in_progress" },
      now,
    ),
    true,
  );
  assert.equal(
    canMeasureCampaign(
      { starts_at: "2026-09-01T00:00:00.000Z", status: "cancelled" },
      now,
    ),
    false,
  );
});
