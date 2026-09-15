import assert from "node:assert/strict";
import test from "node:test";
import {
  costBreakdown,
  funnelSteps,
  deltaPct,
  monthLabel,
  monthlyChartRows,
  targetStatus,
  targetsByKey,
  totalCosts,
  type PanelFinancial,
} from "./panel-view-model";

const financial: PanelFinancial = {
  net_revenue_ex_tax: 1000,
  net_profit: 100,
  net_margin_pct: 10,
  cogs: 400,
  payment_fees: 25,
  shipping_costs: 100,
  shipping_charged: 60,
  shipping_net: -40,
  fixed_costs: 275,
  fixed_pct_revenue: 27.5,
  ads_spend: 100,
  ads_by_platform: { meta: 100 },
  orders_count: 20,
  new_customers: 15,
  cac_blended: 6.67,
  aov_ex_tax: 50,
  cogs_per_order: 20,
  shipping_per_order: 5,
  fixed_per_order: 13.75,
  cac_per_order: 5,
  contribution_per_order: 20,
  breakeven_cac_per_order: 10,
  mbee: 5,
  breakeven_roas: 5,
};

test("el desglose de costes ordena de mayor a menor", () => {
  const slices = costBreakdown(financial);

  assert.deepEqual(
    slices.map((slice) => slice.concepto),
    [
      "Producto (COGS)",
      "Gastos fijos",
      "Envíos",
      "Publicidad",
      "Comisiones de pago",
    ],
    "lo que importa del desglose es cuál es el bocado grande",
  );
  assert.equal(slices[0]?.pct_ingresos, 40);
});

test("un concepto a cero no ocupa sitio en el desglose", () => {
  const slices = costBreakdown({ ...financial, ads_spend: 0 });
  assert.ok(!slices.some((slice) => slice.concepto === "Publicidad"));
});

test("sin ingresos el desglose no divide entre cero", () => {
  const slices = costBreakdown({ ...financial, net_revenue_ex_tax: 0 });
  assert.equal(slices[0]?.pct_ingresos, 0);
});

test("el coste total suma las cinco partidas", () => {
  assert.equal(totalCosts(financial), 900);
  assert.equal(
    financial.net_revenue_ex_tax - totalCosts(financial),
    financial.net_profit,
    "ingresos menos costes tiene que dar el beneficio que calculó el motor",
  );
});

test("el objetivo mensual gana al anual", () => {
  const byKey = targetsByKey([
    { metric_key: "net_margin_pct", target_value: 20, period: "yearly" },
    { metric_key: "net_margin_pct", target_value: 15, period: "monthly" },
  ]);
  assert.equal(byKey.net_margin_pct, 15);
});

test("en el CAC, cumplir es estar por DEBAJO", () => {
  // Sin esto, un CAC bueno se pintaría en rojo.
  assert.equal(targetStatus(8, 11.37, "abajo"), "cumple");
  assert.equal(targetStatus(13, 11.37, "abajo"), "no_cumple");
  assert.equal(targetStatus(15, 10, "arriba"), "cumple");
});

test("sin objetivo no se juzga la cifra", () => {
  assert.equal(targetStatus(8, undefined, "abajo"), null);
  assert.equal(targetStatus(null, 10, "arriba"), null);
});

test("la etiqueta del mes se lee de la cadena, no con Date", () => {
  // `new Date("2026-09-01")` es medianoche UTC; formateado en España sale
  // agosto. Esta trampa ya se comió una comprobación de la serie mensual.
  assert.equal(monthLabel("2026-09-01"), "SEP");
  assert.equal(monthLabel("2026-01-01"), "ENE");
  assert.equal(monthLabel("2026-12-01"), "DIC");
});

test("los meses vacíos se quedan en el gráfico, a cero", () => {
  const rows = monthlyChartRows([
    { month: "2026-07-01", orders_count: 0, net_revenue_ex_tax: 0, net_profit: 0 },
    { month: "2026-08-01", orders_count: 3, net_revenue_ex_tax: 500, net_profit: 80 },
  ]);

  assert.equal(rows.length, 2, "el hueco tiene que verse como barra a cero");
  assert.deepEqual(rows[1], { mes: "AGO", Ingresos: 500, Beneficio: 80 });
});

test("sin periodo anterior no hay variación que enseñar", () => {
  assert.equal(deltaPct(100, null), null);
  assert.equal(deltaPct(100, 0), null, "dividir entre cero daría un infinito");
  assert.equal(deltaPct(150, 100), 50);
});

test("la variación funciona aunque el periodo anterior fuese en pérdidas", () => {
  // De -100 a +50 es una mejora, no un -150 %.
  assert.equal(deltaPct(50, -100), 150);
});

test("el embudo encadena la caída de un paso al siguiente", () => {
  const steps = funnelSteps({
    has_sessions: true,
    sessions: 1000,
    checkouts_started: 200,
    orders_count: 100,
    has_checkout_data: true,
  });

  assert.deepEqual(
    steps.map((step) => step.paso),
    ["Sesiones", "Pago iniciado", "Compras"],
  );
  assert.equal(steps[1]?.pct_del_anterior, 20, "200 de 1000 sesiones");
  assert.equal(steps[2]?.pct_del_anterior, 50, "100 de los 200 que pagaron");
  assert.equal(steps[2]?.pct_del_total, 10, "y 100 de las 1000 sesiones");
});

test("un paso sin dato se omite; no se pinta a cero", () => {
  // Pintar 0 diría que nadie inició el pago, cuando lo que pasa es que en ese
  // periodo todavía no sincronizábamos checkouts.
  const steps = funnelSteps({
    has_sessions: true,
    sessions: 1000,
    checkouts_started: 0,
    orders_count: 100,
    has_checkout_data: false,
  });

  assert.deepEqual(
    steps.map((step) => step.paso),
    ["Sesiones", "Compras"],
  );
  assert.equal(steps[1]?.pct_del_anterior, 10, "la caída se mide contra sesiones");
});

test("sin sesiones no hay embudo que enseñar", () => {
  assert.deepEqual(
    funnelSteps({
      has_sessions: false,
      sessions: 0,
      checkouts_started: 0,
      orders_count: 5,
      has_checkout_data: false,
    }),
    [],
  );
  assert.deepEqual(funnelSteps(null), []);
});
