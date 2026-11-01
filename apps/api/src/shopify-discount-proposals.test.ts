import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShopifyDiscountInput,
  isRemoteDiscountForProposal,
  shopifyDiscountDraftSchema,
} from "./shopify-discount-proposals.js";

const valid = {
  connection_id: "00000000-0000-4000-8000-000000000001",
  idempotency_key: "00000000-0000-4000-8000-000000000002",
  code: " bienvenida10 ",
  title: "Bienvenida 10 %",
  discount_type: "percentage",
  value: 10,
  starts_at: "2026-11-01T09:00:00.000Z",
  ends_at: "2026-11-28T23:59:00.000Z",
  usage_limit: 500,
};

test("normaliza el código y valida límites de porcentaje y fechas", () => {
  const draft = shopifyDiscountDraftSchema.parse(valid);
  assert.equal(draft.code, "BIENVENIDA10");
  assert.equal(draft.once_per_customer, true);
  assert.equal(shopifyDiscountDraftSchema.safeParse({ ...valid, value: 100.01 }).success, false);
  assert.equal(shopifyDiscountDraftSchema.safeParse({ ...valid, ends_at: valid.starts_at }).success, false);
  assert.equal(shopifyDiscountDraftSchema.safeParse({ ...valid, code: "BIENVENIDA 10" }).success, false);
});

test("genera descuentos porcentuales y fijos con marcador de idempotencia", () => {
  const draft = shopifyDiscountDraftSchema.parse(valid);
  const percentage = buildShopifyDiscountInput("proposal-1", draft);
  assert.deepEqual(percentage.customerGets.value, { percentage: 0.1 });
  assert.deepEqual(percentage.tags, ["enora-proposal:proposal-1"]);
  assert.equal(percentage.startsAt, valid.starts_at);
  assert.equal(percentage.endsAt, valid.ends_at);
  assert.equal(percentage.usageLimit, 500);

  const fixed = buildShopifyDiscountInput("proposal-2", { ...draft, discount_type: "fixed_amount", value: 7.5 });
  assert.deepEqual(fixed.customerGets.value, { discountAmount: { amount: "7.5", appliesOnEachItem: false } });
});

test("solo reconcilia un código remoto con marca, título y código del borrador", () => {
  const proposal = { id: "proposal-1", request: shopifyDiscountDraftSchema.parse(valid) };
  const remote = {
    id: "gid://shopify/DiscountCodeNode/10",
    codeDiscount: {
      __typename: "DiscountCodeBasic",
      title: proposal.request.title,
      tags: ["enora-proposal:proposal-1"],
      codes: { nodes: [{ code: "BIENVENIDA10" }] },
    },
  };
  assert.equal(isRemoteDiscountForProposal(remote, proposal), true);
  assert.equal(isRemoteDiscountForProposal({ ...remote, codeDiscount: { ...remote.codeDiscount, tags: [] } }, proposal), false);
  assert.equal(isRemoteDiscountForProposal({ ...remote, codeDiscount: { ...remote.codeDiscount, title: "Otro descuento" } }, proposal), false);
});
