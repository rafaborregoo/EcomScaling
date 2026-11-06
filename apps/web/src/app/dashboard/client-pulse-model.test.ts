/**
 * La cascada del panel del cliente tiene que llegar a su propio total: si las
 * barras no suman el beneficio que se enseña al final, el cliente deja de
 * creerse todo lo demás.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { channelReading, channelSync, chartScale, fmtCurrency, fmtEur, moneyFlow, monthlyWithProjection, unitEconomics, type ChannelSync } from "./client-pulse-model";

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

test("el gráfico incluye ventas negativas y la comparación sin recortarlas", () => {
  for (const [values, comparison] of [
    [[120, -75, 40], -180],
    [[-25, -90], -10],
    [[0.2, -0.05], 0.8],
  ] as const) {
    const scale = chartScale(values, comparison);
    assert.ok(scale.bottom <= Math.min(0, ...values, comparison));
    assert.ok(scale.top >= Math.max(0, ...values, comparison));
    assert.ok(scale.top > scale.bottom);
    assert.ok(scale.ticks.includes(0));
    assert.equal(scale.ticks[0], scale.bottom);
    assert.equal(scale.ticks.at(-1), scale.top);
  }
});

test("channelReading: si no se pudo leer la conexión no dice «Sin conectar»", () => {
  const unknown = channelReading({ name: "Klaviyo", sync: "unknown", hasData: false, metric: "10 €", detail: "x", emptyDetail: "y", connectDetail: "z" });
  assert.deepEqual(unknown, { value: "Sin datos", detail: "No se ha podido comprobar Klaviyo" });
  assert.equal(channelReading({ name: "Klaviyo", sync: "unknown", hasData: true, metric: "10 €", detail: "x", emptyDetail: "y", connectDetail: "z" }).value, "10 €");
});

const reading = (sync: ChannelSync, hasData: boolean) =>
  channelReading({ name: "Klaviyo", sync, hasData, metric: "0 €", detail: "Atribuidos", emptyDetail: "Sin envíos", connectDetail: "Conecta tu email" });

test("un canal sin datos fiables nunca enseña un cero", () => {
  assert.equal(reading("reconnect", false).value, "Sin datos");
  assert.equal(reading("stale", false).value, "Sin datos");
  assert.equal(reading("ok", false).value, "Sin datos");
  assert.equal(reading("off", true).value, "Sin conectar");
  assert.equal(reading("ok", true).value, "0 €");
  assert.match(reading("reconnect", true).detail, /incompleto/);
});

test("un fallo de sincronización no pide reconectar; un permiso caído sí", () => {
  const now = Date.parse("2026-11-04T12:00:00Z");
  const synced = "2026-11-04T10:00:00Z";
  assert.equal(channelSync(null, now), "off");
  assert.equal(channelSync({ status: "connected", last_sync_at: synced }, now), "ok");
  assert.equal(channelSync({ status: "connected", last_sync_at: "2026-11-01T10:00:00Z" }, now), "stale");
  assert.equal(channelSync({ status: "connected", last_sync_at: null }, now), "stale");
  assert.equal(channelSync({ status: "error", last_sync_at: synced, last_error_message: "HTTP 502" }, now), "failed");
  assert.equal(channelSync({ status: "error", last_sync_at: synced, last_error_message: "token expired" }, now), "reconnect");
  assert.equal(channelSync({ status: "revoked", last_sync_at: synced }, now), "reconnect");
});

test("una métrica de unidades enteras no pinta marcas de medio pedido", () => {
  assert.deepEqual(chartScale([0, 1, 1], null, 1).ticks, [0, 1]);
});

test("la escala no divide por cero con una serie vacía o sin ventas", () => {
  for (const values of [[], [0], [0, 0, 0]]) {
    const scale = chartScale(values, null);
    assert.ok(scale.top > scale.bottom);
    assert.ok(scale.ticks.every(Number.isFinite));
  }
});

import { changeText, clientReadable, pickFinding, pickGoals, shortMoney, type GoalObjective } from "./client-pulse-model";

const goal = (metric_key: string, over: Partial<GoalObjective> = {}): GoalObjective => ({
  id: metric_key, metric_key, label: metric_key, unit: "money", direction: "up", target_value: 100, actual_value: 40, progress_pct: 40, period: "monthly", ...over,
});

test("pickGoals: el anillo prefiere ventas y no enseña metas sin cifra ni repetidas", () => {
  const { main, others } = pickGoals([
    goal("cac", { direction: "down" }),
    goal("net_profit"),
    goal("net_revenue_ex_tax"),
    goal("net_profit", { id: "duplicada" }),
    goal("roas", { actual_value: null, progress_pct: null }),
  ]);
  assert.equal(main?.metric_key, "net_revenue_ex_tax");
  assert.deepEqual(others.map((item) => item.id), ["cac", "net_profit", "roas"]);
});

test("pickGoals: sin ventas medibles, la primera meta sin cumplir", () => {
  const { main } = pickGoals([
    goal("roas", { progress_pct: 100 }),
    goal("net_revenue_ex_tax", { actual_value: null, progress_pct: null }),
    goal("aov", { progress_pct: 60 }),
  ]);
  assert.equal(main?.metric_key, "aov");
});

test("pickGoals: una meta que se baja nunca va al anillo", () => {
  assert.equal(pickGoals([goal("cac", { direction: "down" })]).main, null);
});

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
