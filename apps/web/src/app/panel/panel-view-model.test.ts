import assert from "node:assert/strict";
import test from "node:test";
import {
  costBreakdown,
  funnelSteps,
  opportunities,
  opportunitiesTotal,
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
    cart_additions: 500,
    checkouts_reached: 200,
    purchases: 100,
    has_funnel_steps: true,
    orders_count: 130,
  });

  assert.deepEqual(
    steps.map((step) => step.paso),
    ["Sesiones", "Añadió al carrito", "Llegó al pago", "Compró"],
  );
  assert.equal(steps[1]?.pct_del_anterior, 50, "500 de las 1000 sesiones");
  assert.equal(steps[2]?.pct_del_anterior, 40, "200 de los 500 carritos");
  assert.equal(steps[3]?.pct_del_anterior, 50, "100 de los 200 que llegaron al pago");
  assert.equal(steps[3]?.pct_del_total, 10, "y 100 de las 1000 sesiones");
});

test("el último paso son visitas que compraron, no pedidos", () => {
  // 130 pedidos con 100 visitas que compraron: los otros 30 entraron por fuera
  // de la web. Pintarlos aquí daría un 130 % del paso anterior.
  const steps = funnelSteps({
    has_sessions: true,
    sessions: 1000,
    cart_additions: 500,
    checkouts_reached: 200,
    purchases: 100,
    has_funnel_steps: true,
    orders_count: 130,
  });

  assert.equal(steps[3]?.valor, 100);
});

test("sin los pasos intermedios queda la vista corta", () => {
  // Nada de ceros inventados: sesiones y pedidos es lo único que se puede
  // afirmar cuando esas métricas no se pedían todavía.
  const steps = funnelSteps({
    has_sessions: true,
    sessions: 1000,
    cart_additions: 0,
    checkouts_reached: 0,
    purchases: 0,
    has_funnel_steps: false,
    orders_count: 100,
  });

  assert.deepEqual(
    steps.map((step) => step.paso),
    ["Sesiones", "Pedidos"],
  );
  assert.equal(steps[1]?.pct_del_anterior, 10, "la caída se mide contra sesiones");
});

test("un carrito a cero con dato sí se pinta: es una tienda rota, no un hueco", () => {
  const steps = funnelSteps({
    has_sessions: true,
    sessions: 1000,
    cart_additions: 0,
    checkouts_reached: 0,
    purchases: 0,
    has_funnel_steps: true,
    orders_count: 0,
  });

  assert.equal(steps[1]?.paso, "Añadió al carrito");
  assert.equal(steps[1]?.valor, 0);
  assert.equal(steps[1]?.pct_del_anterior, 0);
});

test("sin sesiones no hay embudo que enseñar", () => {
  assert.deepEqual(
    funnelSteps({
      has_sessions: false,
      sessions: 0,
      cart_additions: 0,
      checkouts_reached: 0,
      purchases: 0,
      has_funnel_steps: false,
      orders_count: 5,
    }),
    [],
  );
  assert.deepEqual(funnelSteps(null), []);
});

// F7: "dinero sobre la mesa". La cifra que un consultor va a decirle a un
// cliente en voz alta, así que cada escenario tiene que poder defenderse.

const funnel = {
  has_sessions: true,
  sessions: 10000,
  orders_count: 200,
  cart_additions: 900,
  checkouts_reached: 400,
  purchases: 190,
  has_funnel_steps: true,
};

test("sin objetivos no hay escenarios: no se inventan medias del sector", () => {
  assert.deepEqual(opportunities(financial, funnel, {}, 30), []);
});

test("margen: los puntos que faltan sobre la facturación actual", () => {
  // Margen 10 %, objetivo 15 % → 5 puntos sobre 1.000 € = 50 € en 30 días.
  const found = opportunities(financial, funnel, { net_margin_pct: 15 }, 30);

  assert.equal(found.length, 1);
  assert.equal(found[0]?.palanca, "Margen neto al objetivo");
  assert.ok(
    Math.abs(found[0]!.eur_mes - 50.73) < 0.01,
    `50 € del periodo llevados a un mes medio de 30,44 días, salió ${found[0]?.eur_mes}`,
  );
});

test("una métrica que ya cumple sale de la lista, no resta", () => {
  const found = opportunities(financial, funnel, { net_margin_pct: 5 }, 30);
  assert.deepEqual(found, [], "el margen ya está por encima del objetivo");
});

test("conversión: pedidos extra con el mismo tráfico, al margen de hoy", () => {
  // 200/10.000 = 2 %. Objetivo 3 % → 100 pedidos más × 20 € de contribución.
  const found = opportunities(financial, funnel, { conversion_rate: 3 }, 30);

  assert.equal(found[0]?.palanca, "Conversión al objetivo");
  assert.ok(
    Math.abs(found[0]!.eur_mes - 2029.3) < 1,
    `2.000 € del periodo a mes medio, salió ${found[0]?.eur_mes}`,
  );
  assert.match(found[0]!.regla, /100 pedidos más/);
});

test("CAC: lo que te ahorras es beneficio directo", () => {
  // CAC 6,67 €, objetivo 5 € → 1,67 € × 15 clientes nuevos.
  const found = opportunities(financial, funnel, { cac_blended: 5 }, 30);

  assert.equal(found[0]?.palanca, "CAC al objetivo");
  assert.ok(
    Math.abs(found[0]!.eur_mes - 25.42) < 0.1,
    `25,05 € del periodo a mes medio, salió ${found[0]?.eur_mes}`,
  );
});

test("sin sesiones no hay escenario de conversión", () => {
  const found = opportunities(
    financial,
    { ...funnel, has_sessions: false, sessions: 0 },
    { conversion_rate: 3 },
    30,
  );
  assert.deepEqual(found, []);
});

test("los escenarios van de mayor a menor y el total los suma", () => {
  const found = opportunities(
    financial,
    funnel,
    { net_margin_pct: 15, conversion_rate: 3, cac_blended: 5 },
    30,
  );

  assert.equal(found.length, 3);
  assert.ok(
    found[0]!.eur_mes >= found[1]!.eur_mes &&
      found[1]!.eur_mes >= found[2]!.eur_mes,
    "primero la palanca grande: es por donde se empieza",
  );
  assert.ok(
    Math.abs(opportunitiesTotal(found) - found.reduce((a, b) => a + b.eur_mes, 0)) <
      0.001,
  );
});

test("el periodo se normaliza a mes: 90 días no valen el triple", () => {
  const treintaDias = opportunities(financial, funnel, { net_margin_pct: 15 }, 30);
  const noventaDias = opportunities(financial, funnel, { net_margin_pct: 15 }, 90);

  assert.ok(
    noventaDias[0]!.eur_mes < treintaDias[0]!.eur_mes,
    "el mismo importe repartido en tres meses es menos al mes",
  );
});
