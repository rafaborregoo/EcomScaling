import assert from "node:assert/strict";
import test from "node:test";
import { campaignAlert, campaignState, roasText } from "./campaign-model";

const base = {
  campaign_id: "c1", name: "Prospecting", objective: "Ventas", effective_status: "ACTIVE",
  budget: null, ad_set_count: 1, active_ad_set_count: 1, ad_count: 1,
  rejected_ad_count: 0, learning_ad_set_count: 0, learning_limited_ad_set_count: 0,
  spend: 100, impressions: 1000, clicks: 10, purchases: 2, purchase_value: 200,
  roas: 2, cpm: null, cpc: null, purchase_action_type: "purchase", days_with_data: 7,
  daily_spend: [],
};

test("rechazos manda sobre cualquier otro aviso", () => {
  assert.deepEqual(campaignAlert({ ...base, rejected_ad_count: 1, learning_limited_ad_set_count: 1 }, 1), { text: "1 anuncio rechazado", tone: "bad" });
});

test("aprendizaje limitado sin rechazos", () => {
  assert.deepEqual(campaignAlert({ ...base, learning_limited_ad_set_count: 1 }, 1), { text: "Aprendizaje limitado", tone: "warn" });
});

test("bajo el equilibrio solo si esta activa", () => {
  assert.deepEqual(campaignAlert({ ...base, roas: 0.5 }, 1), { text: "Bajo el equilibrio", tone: "bad" });
  assert.equal(campaignAlert({ ...base, roas: 0.5, effective_status: "PAUSED" }, 1), null);
});

test("sin equilibrio calculado no se puede juzgar el ROAS", () => {
  assert.equal(campaignAlert({ ...base, roas: 0.5 }, null), null);
});

test("sin ningun aviso", () => {
  assert.equal(campaignAlert(base, 1), null);
});

test("roasText redondea sin arrastrar ceros", () => {
  assert.equal(roasText(2), "2×");
  assert.equal(roasText(null), "—");
});

test("campaignState traduce estados conocidos y deja pasar los que no", () => {
  assert.equal(campaignState("ACTIVE").label, "Activa");
  assert.equal(campaignState("WEIRD_STATUS").label, "WEIRD_STATUS");
  assert.equal(campaignState(null).label, "Sin estado");
});
