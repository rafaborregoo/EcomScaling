import assert from "node:assert/strict";
import { test } from "node:test";
import {
  revenueByCurrency,
  roasPosition,
  sortPortfolio,
  type MatrixRow,
  type PortfolioStore,
} from "./consultant-portfolio-model";

test("el ROAS no se declara saludable sin equilibrio válido y distingue la igualdad", () => {
  assert.equal(roasPosition(8, null), null);
  assert.equal(roasPosition(8, 0), null);
  assert.equal(roasPosition(null, 2), null);
  assert.equal(roasPosition(0, 2), "below");
  assert.equal(roasPosition(2, 2), "at");
  assert.equal(roasPosition(3, 2), "above");
});

function store(
  id: string,
  currency_code: string | null,
  net_sales: number | null,
  orders_count = 1,
): PortfolioStore {
  return {
    store_id: id,
    organization_id: "client",
    organization_name: "Cliente",
    shop_name: id,
    currency_code,
    net_sales,
    orders_count,
    aov: net_sales,
  };
}
function row(
  id: string,
  value: number | null,
  currency: string | null,
  rank: number,
): MatrixRow {
  return {
    id,
    name: id,
    tier: "al_dia",
    rank,
    sales: value,
    salesCurrencyCode: currency,
    orders: rank,
    roas: null,
    breakEven: null,
    cac: value,
    cacCurrencyCode: currency,
    cacDelta: null,
    dep: null,
    sent: null,
    lastSend: null,
    emailRev: value,
    emailRevCurrencyCode: currency,
    alerts: 0,
  };
}

test("las devoluciones se incluyen sin sumar euros y dólares", () => {
  assert.deepEqual(
    revenueByCurrency([
      store("one", "EUR", 100),
      store("return", "EUR", -30, 0),
      store("two", "USD", -20, 0),
    ]),
    [
      ["EUR", { sales: 70, orders: 1 }],
      ["USD", { sales: -20, orders: 0 }],
    ],
  );
});
test("las tiendas con pedidos y ventas cero siguen presentes en su moneda", () => {
  assert.deepEqual(
    revenueByCurrency([
      store("zero", "EUR", 0, 3),
      store("inactive", "USD", 0, 0),
    ]),
    [["EUR", { sales: 0, orders: 3 }]],
  );
});
test("una moneda desconocida o una venta ausente no se convierten en cero", () => {
  assert.deepEqual(
    revenueByCurrency([
      store("unknown", null, 50),
      store("missing", "EUR", null),
    ]),
    [],
  );
});
test("el orden monetario agrupa por moneda y compara solo unidades compatibles", () => {
  const rows = [
    row("usd", 1000, "USD", 0),
    row("eur-low", 2, "EUR", 1),
    row("eur-high", 12, "EUR", 2),
    row("missing", null, "EUR", 3),
  ];
  for (const key of ["sales", "cac", "emailRev"] as const) {
    assert.deepEqual(
      sortPortfolio(rows, { key, dir: -1 }).map((item) => item.id),
      ["eur-high", "eur-low", "usd", "missing"],
    );
    assert.deepEqual(
      sortPortfolio(rows, { key, dir: 1 }).map((item) => item.id),
      ["eur-low", "eur-high", "usd", "missing"],
    );
  }
  assert.deepEqual(
    rows.map((item) => item.id),
    ["usd", "eur-low", "eur-high", "missing"],
  );
});
test("los importes sin moneda conservan su prioridad y no se comparan entre sí", () => {
  const rows = [
    row("unknown-low", 1, null, 0),
    row("known", 1, "EUR", 1),
    row("unknown-high", 10000, null, 2),
  ];
  assert.deepEqual(
    sortPortfolio(rows, { key: "sales", dir: -1 }).map((item) => item.id),
    ["known", "unknown-low", "unknown-high"],
  );
});
test("sin orden explícito se conserva la prioridad de la mesa", () => {
  const rows = [row("prioritario", 1, "EUR", 0), row("otro", 100, "EUR", 1)];
  assert.deepEqual(sortPortfolio(rows, null), rows);
});
