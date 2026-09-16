import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVerifactuHash,
  buildVerifactuQrUrl,
  stripeInvoiceCustomer,
  stripeInvoiceLine,
  stripeRefundGrossAmount,
} from "./invoicing.js";

test("la factura fiscal lee cliente, NIF y linea del modelo actual de Stripe", () => {
  const rawInvoice = {
    customer_name: "Ada Lovelace SL",
    customer_email: "FACTURAS@EXAMPLE.COM",
    customer_address: { line1: "Calle Mayor 1", country: "ES" },
    parent: {
      subscription_details: {
        metadata: { customer_tax_id: "b12345678" },
      },
    },
    total: 2500,
    lines: {
      data: [
        {
          description: "Plan Growth mensual",
          pricing: {
            price_details: {
              price: { id: "price_growth", nickname: "Growth" },
            },
          },
        },
      ],
    },
  };

  assert.deepEqual(stripeInvoiceCustomer(rawInvoice), {
    name: "Ada Lovelace SL",
    email: "facturas@example.com",
    taxId: "B12345678",
    address: { line1: "Calle Mayor 1", country: "ES" },
  });
  assert.deepEqual(stripeInvoiceLine(rawInvoice, 25, 20.66, 4.34, 21), {
    description: "Growth",
    quantity: 1,
    unit_price: 25,
    vat_rate: 21,
    base_amount: 20.66,
    tax_amount: 4.34,
    total_amount: 25,
  });
});

test("el reembolso usa el ultimo Refund y convierte centimos a euros", () => {
  assert.equal(
    stripeRefundGrossAmount({
      amount: 9999,
      amount_refunded: 1500,
      refunds: {
        data: [
          { id: "re_old", amount: 500, created: 100 },
          { id: "re_new", amount: 1000, created: 200 },
        ],
      },
    }),
    10,
  );
});

test("buildVerifactuHash follows the AEAT field order and returns uppercase SHA-256", () => {
  const hash = buildVerifactuHash({
    issuerTaxId: "12345678A",
    invoiceCode: "F2026-00001",
    issueDate: "16-09-2026",
    invoiceType: "F1",
    taxAmount: 2.1,
    total: 12.1,
    previousHash: null,
    generatedAt: "2026-09-16T12:00:00+02:00",
  });

  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9A-F]{64}$/);
  assert.equal(
    hash,
    "2B1BCDB28C018BF010DDEF45087F2ECFCB45EC5D3E39149F410BCFD7A5F745E9",
  );
});

test("buildVerifactuQrUrl uses the AEAT test host and invoice date format", () => {
  const url = buildVerifactuQrUrl({
    issuerTaxId: "12345678A",
    invoiceCode: "F2026-00001",
    issueDate: "2026-09-16",
    total: 12.1,
    environment: "test",
  });

  const parsed = new URL(url);
  assert.equal(parsed.origin, "https://prewww2.aeat.es");
  assert.equal(parsed.pathname, "/wlpl/TIKE-CONT/ValidarQR");
  assert.equal(parsed.searchParams.get("nif"), "12345678A");
  assert.equal(parsed.searchParams.get("numserie"), "F2026-00001");
  assert.equal(parsed.searchParams.get("fecha"), "16-09-2026");
  assert.equal(parsed.searchParams.get("importe"), "12.10");
});
