/**
 * El panel financiero de /admin/finanzas sale de aqui. Lo que se prueba son
 * las dos cosas que lo hacen creible: que los importes de Stripe (que llegan
 * en centimos) se conviertan bien, y que NO se invente una cifra cuando falta
 * un dato -- un neto estimado es peor que un hueco, porque parece una cifra.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStripeInvoicesUrl,
  normalizeStripeInvoice,
  summarizePayments,
} from "./billing.js";

test("consulta facturas por epoch y expande el precio del modelo actual", () => {
  const url = new URL(
    buildStripeInvoicesUrl(
      "2026-09-01T00:00:00.000Z",
      "2026-09-16T00:00:00.000Z",
      "in_cursor",
    ),
  );

  // Stripe filtra por epoch en segundos; mandarle ISO no falla, simplemente
  // devuelve todo.
  assert.equal(url.searchParams.get("created[gte]"), "1788220800");
  assert.equal(url.searchParams.get("created[lte]"), "1789516800");
  assert.equal(url.searchParams.get("starting_after"), "in_cursor");
  assert.equal(url.searchParams.get("limit"), "100");
  assert.deepEqual(url.searchParams.getAll("expand[]"), [
    "data.lines.data.pricing.price_details.price",
  ]);
});

test("normaliza el modelo actual de facturas e Invoice Payments", () => {
  const payment = normalizeStripeInvoice(
    {
      id: "in_modern",
      status: "paid",
      total: 3000,
      amount_paid: 2500,
      currency: "eur",
      created: 1_757_500_000,
      parent: {
        subscription_details: { subscription: "sub_modern" },
      },
      lines: {
        data: [
          {
            description: "Plan Growth mensual",
            pricing: {
              price_details: {
                price: {
                  id: "price_modern",
                  nickname: "Growth",
                  metadata: { ecomscaling_plan_code: "growth" },
                  product: { name: "E-NORA" },
                },
              },
            },
          },
        ],
      },
    },
    { feeAmountMinor: 175, refundedAmountMinor: 500 },
  );

  assert.equal(payment.gross_amount, 25);
  assert.equal(payment.fee_amount, 1.75);
  assert.equal(payment.refunded_amount, 5);
  assert.equal(payment.net_amount, 18.25);
  assert.equal(payment.plan_id, "price_modern");
  assert.equal(payment.plan_name, "Growth");
  assert.equal(payment.plan_code, "growth");
  assert.equal(payment.subscription_id, "sub_modern");
});

test("normaliza una factura de Stripe pasando los centimos a euros", () => {
  const payment = normalizeStripeInvoice({
    id: "in_1",
    status: "paid",
    total: 2999,
    currency: "eur",
    created: 1_757_500_000,
    status_transitions: { paid_at: 1_757_505_000 },
    billing_reason: "subscription_cycle",
    customer_name: "Ada Lovelace",
    customer_email: "ADA@EXAMPLE.COM",
    subscription: "sub_1",
    charge: {
      amount_refunded: 500,
      balance_transaction: { fee: 200 },
    },
    lines: {
      data: [
        {
          price: {
            id: "price_1",
            nickname: "Growth",
            metadata: { ecomscaling_plan_code: "growth" },
            product: { name: "E-NORA" },
          },
        },
      ],
    },
  });

  assert.deepEqual(payment, {
    id: "in_1",
    status: "paid",
    substatus: "succeeded",
    currency: "EUR",
    gross_amount: 29.99,
    amount_after_fees: 27.99,
    fee_amount: 2,
    refunded_amount: 5,
    net_amount: 22.99,
    paid_at: "2025-09-10T11:50:00.000Z",
    created_at: "2025-09-10T10:26:40.000Z",
    billing_reason: "subscription_cycle",
    plan_id: "price_1",
    plan_name: "Growth",
    plan_code: "growth",
    product_name: "E-NORA",
    customer_name: "Ada Lovelace",
    customer_email: "ada@example.com",
    subscription_id: "sub_1",
  });
});

test("sin la transaccion de saldo no se inventa una comision", () => {
  // Pasa de verdad: una factura de 0 EUR o una que aun no tiene cargo. Un
  // fee_amount = 0 diria "Stripe no cobro nada", que es una afirmacion; null
  // dice "no se sabe", que es la verdad.
  const payment = normalizeStripeInvoice({
    id: "in_2",
    status: "paid",
    total: 1000,
    currency: "eur",
    created: 1_757_500_000,
  });

  assert.equal(payment.gross_amount, 10);
  assert.equal(payment.fee_amount, null);
  assert.equal(payment.amount_after_fees, null);
  assert.equal(payment.net_amount, null);
  assert.equal(payment.refunded_amount, 0);
});

test("los estados de Stripe se traducen a cobrado / fallido / pendiente", () => {
  const estado = (status: string) =>
    normalizeStripeInvoice({ id: "in_x", status, total: 100, currency: "eur" })
      .substatus;

  assert.equal(estado("paid"), "succeeded");
  assert.equal(estado("uncollectible"), "uncollectible");
  assert.equal(estado("void"), "void");
  assert.equal(estado("open"), "open");
  assert.equal(
    normalizeStripeInvoice({
      id: "in_retrying",
      status: "open",
      attempt_count: 1,
      total: 100,
      currency: "eur",
    }).substatus,
    "failed",
  );
});

test("resume ingresos, reembolsos, neto y huecos diarios", () => {
  const now = new Date("2026-09-16T12:00:00.000Z");
  const payments = [
    normalizeStripeInvoice({
      id: "in_success",
      status: "paid",
      total: 3000,
      currency: "eur",
      status_transitions: {
        paid_at: Math.floor(Date.parse("2026-09-15T12:00:00Z") / 1000),
      },
      charge: { amount_refunded: 0, balance_transaction: { fee: 200 } },
      lines: {
        data: [{ price: { id: "price_1", nickname: "Growth", metadata: {} } }],
      },
    }),
    normalizeStripeInvoice({
      id: "in_failed",
      status: "uncollectible",
      total: 3000,
      currency: "eur",
      created: Math.floor(Date.parse("2026-09-14T12:00:00Z") / 1000),
    }),
  ];

  const summary = summarizePayments(payments, { days: 7, now });

  assert.equal(summary.currency, "EUR");
  assert.deepEqual(summary.totals, {
    gross_amount: 30,
    fee_amount: 2,
    refunded_amount: 0,
    net_amount: 28,
    successful_payments: 1,
    failed_payments: 1,
    pending_payments: 0,
  });
  assert.equal(summary.timeline.length, 8);
  assert.equal(summary.by_plan[0]?.name, "Growth");
});

test("no mezcla monedas en el desglose", () => {
  const payments = [
    normalizeStripeInvoice({
      id: "in_eur",
      status: "paid",
      total: 1000,
      currency: "eur",
      status_transitions: {
        paid_at: Math.floor(Date.parse("2026-09-10T12:00:00Z") / 1000),
      },
      charge: { balance_transaction: { fee: 100 } },
    }),
    normalizeStripeInvoice({
      id: "in_usd",
      status: "paid",
      total: 1000,
      currency: "usd",
      status_transitions: {
        paid_at: Math.floor(Date.parse("2026-09-11T12:00:00Z") / 1000),
      },
      charge: { balance_transaction: { fee: 200 } },
    }),
  ];

  const summary = summarizePayments(payments, {
    days: 30,
    now: new Date("2026-09-16T12:00:00.000Z"),
  });

  assert.equal(summary.currency, null);
  assert.deepEqual(
    summary.by_currency.map((row: { currency: string }) => row.currency),
    ["EUR", "USD"],
  );
  assert.equal(summary.totals.gross_amount, null);
  assert.deepEqual(summary.timeline, []);
  assert.deepEqual(summary.by_plan, []);
});
