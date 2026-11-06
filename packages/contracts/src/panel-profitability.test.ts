import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateClients,
  aggregateTotals,
  buildClientHeadline,
  buildPortfolioHeadline,
  buildStoreHeadline,
  buildStoreRow,
  dataFlags,
  panelMoney,
  panelPct,
  sortStores,
  type ProfitStoreRow,
} from "./panel-profitability.js";

const complete = {
  orders_count: 330,
  net_revenue_ex_tax: 17400,
  net_profit: 1670,
  net_margin_pct: 9.6,
  cogs: 7250,
  items_without_cost: 0,
  fixed_expenses_count: 5,
  has_settings: true,
  aov_ex_tax: 52.7,
  cogs_per_order: 22,
  shipping_per_order: 8.5,
  payment_fee_per_order: 1.8,
  fixed_per_order: 4.1,
  cac_per_order: 11.2,
  contribution_per_order: 11,
  breakeven_cac_per_order: 22.2,
  ads_spend: 3705,
  new_customers: 190,
  cac_blended: 19.5,
};

test("una fuente financiera no verificable bloquea palancas y no infla cliente ni cartera", () => {
  const raw = store("unverified", "org", complete);
  const flagged = buildStoreRow({
    store: { id: raw.store_id, organization_id: raw.organization_id, organization_name: "org", connection_id: null, shop_name: "Tienda", domain: null, currency_code: "EUR" },
    financial: complete, previous: null, financialComparability: { can_use_financial_model: false },
    funnel: { days_with_sessions: 30, sessions: 21400 }, targets: { net_margin_pct: 20 }, periodDays: 30,
  });
  assert.equal(flagged.tier, "datos");
  assert.ok(flagged.flags.some((flag) => flag.key === "financial_unverified" && flag.blocking));
  assert.equal(flagged.lever_total, 0);
  assert.equal(aggregateClients([flagged])[0]?.net_profit, null);
  const totals = aggregateTotals([flagged]);
  assert.equal(totals.stores_counted, 0);
  assert.equal(totals.stores_excluded, 1);
  assert.equal(totals.currency_code, null);
  assert.equal(totals.net_profit, 0);
  const verified = store("verified", "other", complete);
  assert.equal(aggregateTotals([verified, flagged]).net_profit, verified.net_profit);
});

function store(
  id: string,
  org: string,
  financial: Record<string, unknown>,
  targets: Record<string, number> = { net_margin_pct: 15, cac_blended: 17 },
  currency = "EUR",
  previous: Record<string, unknown> | null = null,
): ProfitStoreRow {
  return buildStoreRow({
    store: {
      id,
      organization_id: org,
      organization_name: org,
      connection_id: `c-${id}`,
      shop_name: id,
      domain: `${id}.es`,
      currency_code: currency,
    },
    financial,
    financialComparability: { can_use_financial_model: true },
    previous,
    funnel: { days_with_sessions: 30, sessions: 21400 },
    targets,
    periodDays: 30,
  });
}

test("formato: miles con punto, decimales con coma y signo menos tipografico", () => {
  assert.equal(panelMoney(2150), "2.150 €");
  assert.equal(panelMoney(-2150), "−2.150 €");
  assert.equal(panelMoney(5.1, "EUR", 2), "5,10 €");
  assert.equal(panelMoney(4020, "GBP"), "4.020 £");
  assert.equal(panelPct(9.64), "9,6 %");
  assert.equal(panelMoney(-0.2, "EUR", 0), "0 €");
});

test("fiabilidad: sin coste de producto el beneficio no es firme", () => {
  const flags = dataFlags(
    { orders_count: 40, cogs: 0, items_without_cost: 0, fixed_expenses_count: 0, has_settings: false },
    { has_sessions: false },
  );
  assert.deepEqual(
    flags.map((flag) => [flag.key, flag.blocking]),
    [
      ["no_cogs", true],
      ["no_fixed", true],
      ["no_settings", true],
      ["no_sessions", false],
    ],
  );
});

test("fiabilidad: sin pedidos no se comenta nada mas", () => {
  const flags = dataFlags(
    { orders_count: 0, cogs: 0, items_without_cost: 0, fixed_expenses_count: 0, has_settings: false },
    null,
  );
  assert.deepEqual(flags.map((flag) => flag.key), ["no_orders"]);
});

test("tramos: pierde, datos, bajo y ok salen del beneficio y del objetivo", () => {
  assert.equal(store("a", "A", { ...complete, net_profit: -500, net_margin_pct: -2.9 }).tier, "pierde");
  assert.equal(store("b", "B", { ...complete, cogs: 0 }).tier, "datos");
  assert.equal(store("c", "C", complete).tier, "bajo");
  assert.equal(store("d", "D", { ...complete, net_profit: 4000 }).tier, "ok");
  // Sin objetivo de margen no hay contra que medir: gana dinero, es "ok".
  assert.equal(store("e", "E", complete, {}).tier, "ok");
});

test("palancas: solo con beneficio creible y por debajo del objetivo", () => {
  const row = store("pt", "Huerta", complete);
  // 5,4 puntos de margen sobre 17.400 en 30 dias, escalado a mes medio.
  const margin = row.levers.find((lever) => lever.clave === "margen");
  assert.ok(margin);
  assert.ok(Math.abs(margin.eur_mes - 953.5) < 1);
  assert.ok(row.levers.some((lever) => lever.clave === "cac"));
  // Tienda sin datos: sin palancas, no se inventa dinero.
  assert.deepEqual(store("x", "X", { ...complete, cogs: 0 }).levers, []);
  // Las reglas se leen en español: coma decimal, no "5.40".
  assert.match(margin.regla, /^5,4 puntos/);
});

test("CAC: con pocos clientes nuevos no hay CAC ni palanca, hay falta de muestra", () => {
  // 3.705 € entre 1 cliente nuevo no es un CAC de 3.705 €.
  const row = store("pt", "Huerta", { ...complete, new_customers: 1, cac_blended: 3705 });
  assert.equal(row.cac, null);
  assert.ok(!row.levers.some((lever) => lever.clave === "cac"));
  assert.equal(aggregateClients([row])[0]?.cac, null);
});

test("cliente: el tramo sale del agregado, no de la peor tienda", () => {
  const es = store("es", "Huerta", { ...complete, net_profit: 8200, net_revenue_ex_tax: 46800, orders_count: 780 });
  const pt = store("pt", "Huerta", complete);
  const [client] = aggregateClients([es, pt]);
  assert.equal(pt.tier, "bajo");
  assert.equal(client?.tier, "ok");
  assert.equal(client?.revenue, 64200);
  assert.equal(client?.net_profit, 9870);
  assert.equal(client?.store_count, 2);
});

test("cliente: una tienda sin datos arrastra a todo el cliente a 'datos'", () => {
  const ok = store("ok", "Bodega", { ...complete, net_profit: 4000 });
  const blind = store("blind", "Bodega", { ...complete, cogs: 0 });
  assert.equal(aggregateClients([ok, blind])[0]?.tier, "datos");
});

test("cliente con monedas distintas no suma importes", () => {
  const eur = store("eur", "Mixto", complete);
  const gbp = store("gbp", "Mixto", complete, undefined, "GBP");
  const [client] = aggregateClients([eur, gbp]);
  assert.equal(client?.revenue, null);
  assert.equal(client?.tier, "datos");
  assert.ok(client?.flags.some((flag) => flag.key === "mixed_currency"));
});

test("totales: suman la moneda mayoritaria y dejan fuera el resto", () => {
  const rows = [
    store("a", "A", { ...complete, net_profit: 4000 }),
    store("b", "B", { ...complete, net_profit: -300 }),
    store("c", "C", complete, undefined, "GBP"),
  ];
  const totals = aggregateTotals(rows);
  assert.equal(totals.currency_code, "EUR");
  assert.equal(totals.stores_counted, 2);
  assert.equal(totals.stores_excluded, 1);
  assert.equal(totals.net_profit, 3700);
  assert.equal(totals.counts.pierde, 1);
  assert.equal(totals.counts.stores, 3);
});

test("orden: pierde primero, por menor beneficio; ok al final", () => {
  const sorted = sortStores([
    store("ok", "O", { ...complete, net_profit: 4000 }),
    store("p2", "P", { ...complete, net_profit: -100 }),
    store("p1", "P", { ...complete, net_profit: -900 }),
    store("d", "D", { ...complete, cogs: 0 }),
  ]);
  assert.deepEqual(sorted.map((row) => row.store_id), ["p1", "p2", "d", "ok"]);
});

test("titular de cartera: dice lo que pasa, en voz del consultor", () => {
  const rows = [
    store("a", "A", { ...complete, net_profit: -900 }, undefined, "EUR", { net_revenue_ex_tax: 15000, net_profit: 500 }),
    store("b", "B", { ...complete, cogs: 0 }, undefined, "EUR", { net_revenue_ex_tax: 15000, net_profit: 500 }),
  ];
  const headline = buildPortfolioHeadline(aggregateTotals(rows), 30);
  assert.equal(headline.title, "1 tienda pierde dinero y 1 no tiene datos para saber si lo gana.");
  assert.match(headline.detail, /^La cartera factura 34\.800 € sin IVA/);
  assert.match(headline.detail, /Vende un 16,0 % más que el periodo anterior/);
});

test("titular de cartera: si todo va bien, lo dice", () => {
  const rows = [store("a", "A", { ...complete, net_profit: 4000 })];
  assert.equal(buildPortfolioHeadline(aggregateTotals(rows), 30).title, "Tu cartera cumple sus objetivos de margen.");
});

test("titular de cliente: nombra la tienda que paga de mas por cliente nuevo", () => {
  const es = store("huertanorte.es", "Huerta Norte", {
    ...complete,
    net_profit: 8200,
    net_revenue_ex_tax: 46800,
    orders_count: 780,
    cac_blended: 12,
  });
  const pt = store("huertanorte.pt", "Huerta Norte", complete);
  const stores = [es, pt];
  const client = aggregateClients(stores)[0]!;
  const headline = buildClientHeadline(client, stores, 30);
  assert.equal(
    headline.title,
    "Huerta Norte gana 9.870 €, pero huertanorte.pt paga 19,5 € por cada cliente nuevo y su objetivo es 17,0 €.",
  );
  assert.match(headline.detail, /huertanorte\.pt es la que menos deja por pedido/);
});

test("titular de cliente sin datos: no da un beneficio como firme", () => {
  const blind = store("blind", "Bodega", { ...complete, cogs: 0, fixed_expenses_count: 0 });
  const client = aggregateClients([blind])[0]!;
  assert.equal(
    buildClientHeadline(client, [blind], 30).title,
    "El beneficio de Bodega es una estimación: falta el coste de producto y no hay gastos fijos.",
  );
});

test("titular de tienda: cuanto deja cada pedido y a donde se va el ticket", () => {
  const row = store("pt", "Huerta", complete);
  const headline = buildStoreHeadline(row, 30);
  assert.equal(
    headline.title,
    "Cada pedido deja 5,06 €: producto y envío se llevan el 58 % del ticket y la publicidad otro 21 %.",
  );
  assert.match(headline.detail, /un 9,6 % de margen frente al 15 % que fijaste/);
});

test("titular de tienda que pierde: no dice 'deja'", () => {
  const row = store("p", "P", { ...complete, net_profit: -660, net_margin_pct: -3.8 });
  assert.match(buildStoreHeadline(row, 30).title, /^Cada pedido pierde 2,00 €/);
});

test("titular de tienda sin pedidos", () => {
  const row = store("v", "V", { ...complete, orders_count: 0, net_revenue_ex_tax: 0, net_profit: 0 });
  assert.match(buildStoreHeadline(row, 90).title, /^Sin pedidos en 90 días/);
});

test("gastos fijos: se reparten por facturacion y las tiendas suman el beneficio real del cliente", () => {
  // `shopify_financial_summary` carga los 1.000 € de fijos enteros a cada tienda.
  const a = { ...complete, net_revenue_ex_tax: 60000, net_profit: 9000, fixed_costs: 1000, fixed_per_order: 2 };
  const b = { ...complete, net_revenue_ex_tax: 40000, net_profit: 5000, fixed_costs: 1000, fixed_per_order: 3 };
  const mk = (id: string, financial: Record<string, unknown>, fixedShare: number) =>
    buildStoreRow({
      store: { id, organization_id: "O", organization_name: "O", connection_id: id, shop_name: id, domain: null, currency_code: "EUR" },
      financial,
      financialComparability: { can_use_financial_model: true },
      previous: null,
      funnel: null,
      targets: {},
      periodDays: 30,
      fixedShare,
    });
  const rowA = mk("a", a, 0.6);
  const rowB = mk("b", b, 0.4);
  // Beneficio real del cliente = (9.000 + 5.000) + 1.000 de fijos que se contaron dos veces.
  assert.equal(rowA.net_profit + rowB.net_profit, 14000 + 1000);
  assert.equal(rowA.net_profit, 9400);
  assert.equal(rowB.net_profit, 5600);
  assert.ok(Math.abs(rowA.per_order.fixed - 1.2) < 1e-9);
});

test("conversión por tienda: pedidos entre sesiones, y nada sin informe de sesiones", () => {
  const row = store("conv", "o", { orders_count: 214, net_revenue_ex_tax: 10000 }, { conversion_rate: 1.5 });
  assert.equal(row.sessions, 21400);
  assert.equal(row.conversion_pct, 1);
  assert.equal(row.conversion_target, 1.5);
  const blind = buildStoreRow({
    store: { id: "x", organization_id: "o", organization_name: "o", connection_id: null, shop_name: "x", domain: null, currency_code: "EUR" },
    financial: { orders_count: 214 },
    financialComparability: null,
    previous: null,
    funnel: { days_with_sessions: 0, sessions: 0 },
    targets: {},
    periodDays: 30,
  });
  assert.equal(blind.sessions, null);
  assert.equal(blind.conversion_pct, null);
});
