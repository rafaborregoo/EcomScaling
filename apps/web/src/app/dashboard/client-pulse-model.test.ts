/**
 * La cascada del panel del cliente tiene que llegar a su propio total: si las
 * barras no suman el beneficio que se enseña al final, el cliente deja de
 * creerse todo lo demás.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { fmtCurrency, fmtEur, moneyFlow, monthlyWithProjection, unitEconomics } from "./client-pulse-model";

const financial = {
  net_sales: 48230,
  net_revenue_ex_tax: 39860,
  cogs: 14350,
  shipping_costs: 3980,
  payment_fees: 1190,
  ads_spend: 11270,
  fixed_costs: 2130,
  net_profit: 6940,
  orders_count: 812,
  aov_ex_tax: 49.09,
  cogs_per_order: 17.67,
  shipping_per_order: 4.9,
  payment_fee_per_order: 1.47,
  cac_per_order: 13.88,
  fixed_per_order: 2.62,
};

function landing(rows: ReturnType<typeof moneyFlow>) {
  const start = rows.findIndex((r) => r.label === "Ingreso sin IVA");
  return rows.slice(start + 1, -1).reduce((acc, r) => acc + r.value, rows[start].value);
}

test("la cascada cuadra con el beneficio", () => {
  const rows = moneyFlow(financial);
  assert.equal(rows.at(-1)?.value, 6940);
  assert.equal(landing(rows), 6940);
  assert.ok(!rows.some((r) => r.label === "Otros ajustes"));
});

test("un hueco del motor financiero sale como fila, no se esconde", () => {
  const rows = moneyFlow({ ...financial, net_profit: 6500 });
  const other = rows.find((r) => r.label === "Otros ajustes");
  assert.equal(other?.value, -440);
  assert.equal(landing(rows), 6500);
});

test("el pedido medio se reparte entero", () => {
  const slices = unitEconomics(financial);
  const total = slices.reduce((acc, s) => acc + s.value, 0);
  assert.ok(Math.abs(total - financial.aov_ex_tax) < 0.01);
});

test("la proyección arranca del último mes cerrado y llega a diciembre", () => {
  const monthly = ["01", "02", "03", "04", "05", "06", "07", "08", "09"].map((m, i) => ({
    month: `2026-${m}-01`,
    value: i === 8 ? 20000 : 30000 * Math.pow(1.05, i),
  }));
  const points = monthlyWithProjection(monthly, new Date("2026-09-28T12:00:00Z"));
  assert.equal(points.find((p) => p.month === "2026-09")?.kind, "current");
  const projection = points.filter((p) => p.kind === "projection");
  assert.deepEqual(projection.map((p) => p.month), ["2026-10", "2026-11", "2026-12"]);
  assert.ok(Math.abs(projection[0].value - 30000 * Math.pow(1.05, 8)) < 1);
});

test("los euros se agrupan también con cuatro cifras", () => {
  assert.equal(fmtEur(9870), "9.870 €");
  assert.equal(fmtEur(-14350.5, 2), "−14.350,50 €");
});

test("sin diferencia entre ventas e ingreso sin IVA hay una sola fila de ingreso", () => {
  const rows = moneyFlow({ ...financial, net_sales: 39860 });
  assert.deepEqual(
    rows.filter((r) => r.kind === "total").map((r) => r.label),
    ["Ingreso sin IVA"],
  );
  assert.equal(landing(rows), 6940);
});

test("las monedas agrupan también con cuatro cifras y usan el menos tipográfico", () => {
  assert.equal(fmtCurrency(7463, "EUR").replace(/ /g, " "), "7.463 €");
  assert.equal(fmtCurrency(-7463, "EUR").replace(/ /g, " "), "−7.463 €");
});

import { changeText, clientReadable, pickFinding, shortMoney } from "./client-pulse-model";

test("cada sección recibe su propio hallazgo y no repite el de otra", () => {
  const sales = { title: "Ventas netas de 48.596,60 € en 881 pedidos", severity: "info", evidence: "" };
  const meta = { title: "El ROAS de Meta cae en prospección", severity: "high", evidence: "", area: "meta" };
  const diagnostic = {
    output: {
      sections: [{ key: "adquisicion", label: "Adquisición", findings: [sales, meta] }],
      findings: [],
    },
  };
  const taken = new Set<typeof sales>();
  assert.equal(pickFinding(diagnostic, /meta|adquis/i, taken), meta, "prefiere el que habla de Meta");
  assert.equal(pickFinding(diagnostic, /adquis|canal/i, taken), sales);
  assert.equal(pickFinding(diagnostic, /adquis|canal/i, taken), null, "no repite");
});

test("el texto de la IA pierde las frases con jerga de sistema", () => {
  const evidence =
    "Lecturas disponibles: Sudadera 25, Camiseta 40, Bolso 12. Estado tracked_current para los tres productos. inventory_sync_is_stale=true. La sincronización tenía 99,9 horas.";
  assert.equal(clientReadable(evidence), "Lecturas disponibles: Sudadera 25, Camiseta 40, Bolso 12. La sincronización tenía 99,9 horas.");
  assert.equal(clientReadable("days_of_cover y coverageDays son null."), null);
  assert.equal(clientReadable("Última sincronización 2026-10-09 06:09:50 UTC."), null);
});

test("las variaciones grandes y los ejes se leen en español", () => {
  assert.equal(changeText(319), "×4,2");
  assert.equal(changeText(42.4), "42 %");
  assert.equal(changeText(-0.1), "0,1 %");
  assert.equal(shortMoney(23100), "23 mil €");
  assert.equal(shortMoney(54200), "54 mil €");
});
