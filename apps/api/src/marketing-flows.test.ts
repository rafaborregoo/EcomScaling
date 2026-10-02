import assert from "node:assert/strict";
import { test } from "node:test";
import { flowDesignIssues, flowDesignSchema, klaviyoFlowBody, placedOrderFrom, type FlowDesign } from "./marketing-flows.js";

const DRAFT_A = "11111111-1111-4111-8111-111111111111";
const DRAFT_B = "22222222-2222-4222-8222-222222222222";

const email = (id: string, draft: string | null, subject = "Asunto") => ({
  id,
  type: "email" as const,
  name: id,
  draft_id: draft,
  subject,
  preheader: "",
  from_label: "Casa Brava",
  from_email: "hola@casabrava.es",
  reply_to: "",
  smart_sending: true,
  utm: true,
});

const cart: FlowDesign = {
  version: 1,
  trigger: { type: "metric", id: "UWP7cZ", min_value: 50, exclude_purchasers: true, reentry_days: 30 },
  steps: [
    { id: "d1", type: "delay", value: 4, unit: "hours", until: null, weekdays: [] },
    email("e1", DRAFT_A),
    {
      id: "s1",
      type: "split",
      condition: { kind: "metric", metric_id: "RSbq2E", operator: "greater-than", value: 0, timeframe: { kind: "flow-start" } },
      yes: [],
      no: [{ id: "d2", type: "delay", value: 1, unit: "days", until: "10:00", weekdays: ["monday"] }, email("e2", DRAFT_B)],
    },
  ],
};

test("el carrito abandonado sale con el formato de POST /flows/", () => {
  assert.ok(flowDesignSchema.safeParse(cart).success);
  const body = klaviyoFlowBody("Carrito", cart, { placedOrderMetricId: "RSbq2E", templateIds: new Map([[DRAFT_A, "TplA"], [DRAFT_B, "TplB"]]) });
  const def = body.data.attributes.definition as Record<string, any>;
  assert.equal(def.entry_action_id, "a1");
  assert.deepEqual(def.actions.map((a: any) => [a.temporary_id, a.type]), [
    ["a1", "time-delay"],
    ["a2", "send-email"],
    ["a3", "conditional-split"],
    ["a4", "time-delay"],
    ["a5", "send-email"],
  ]);
  assert.deepEqual(def.actions[0].links, { next: "a2" });
  assert.deepEqual(def.actions[2].links, { next_if_true: null, next_if_false: "a4" });
  assert.equal(def.actions[4].links.next, null);
  assert.equal(def.actions[1].data.message.template_id, "TplA");
  assert.equal(def.actions[1].data.status, "draft");
  assert.equal(def.actions[3].data.delay_until_time, "10:00:00");
  assert.deepEqual(def.actions[3].data.delay_until_weekdays, ["monday"]);
  assert.equal(def.triggers[0].trigger_filter.condition_groups[0].conditions[0].filter.value, 50);
  assert.equal(def.profile_filter.condition_groups[0].conditions[0].timeframe_filter.operator, "flow-start");
  assert.deepEqual(def.reentry_criteria, { duration: 30, unit: "day" });
});

test("no deja crear un flow con emails sin pieza o sin asunto", () => {
  const design: FlowDesign = { ...cart, steps: [email("e1", null, "")] };
  const issues = flowDesignIssues(design, { placedOrderMetricId: "RSbq2E" });
  assert.equal(issues.filter((issue) => issue.step_id === "e1").length, 2);
  assert.equal(flowDesignIssues(cart, { placedOrderMetricId: "RSbq2E" }).length, 0);
  // Sin «Placed Order» en la cuenta no se puede sacar a quien compra.
  assert.equal(flowDesignIssues(cart, { placedOrderMetricId: null })[0]?.step_id, "trigger");
});

test("el esquema rechaza pasos desconocidos y horas mal escritas", () => {
  assert.equal(flowDesignSchema.safeParse({ ...cart, steps: [{ id: "x", type: "sms" }] }).success, false);
  assert.equal(flowDesignSchema.safeParse({ ...cart, steps: [{ id: "d", type: "delay", value: 1, unit: "days", until: "25:00", weekdays: [] }] }).success, false);
});

test("«Placed Order» prefiere la de Shopify si hay varias", () => {
  assert.equal(placedOrderFrom([{ id: "api", name: "Placed Order", integration: "API" }, { id: "shop", name: "Placed Order", integration: "Shopify" }]), "shop");
  assert.equal(placedOrderFrom([{ id: "x", name: "Opened Email", integration: "Klaviyo" }]), null);
});
