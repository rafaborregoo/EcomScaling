import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FLOW_TEMPLATES,
  conditionQuestion,
  containsList,
  insertStep,
  locate,
  newStep,
  removeStep,
  reviewFlow,
  tailList,
  type FlowAccount,
  type FlowStep,
} from "./flow-design";

const account: FlowAccount = {
  metrics: [
    { id: "SC", name: "Started Checkout", integration: "Shopify" },
    { id: "PO", name: "Placed Order", integration: "Shopify" },
    { id: "PO-api", name: "Placed Order", integration: "API" },
  ],
  lists: [{ id: "L1", name: "Newsletter" }],
  segments: [],
  fromEmail: "hola@casabrava.es",
  fromLabel: "Casa Brava",
};

test("una división termina la rama: lo que venía detrás pasa a su rama «Sí»", () => {
  const a = newStep("email", account);
  const b = newStep("delay", account);
  const steps: FlowStep[] = [a, b];
  const split = newStep("split", account);
  insertStep(steps, "root", 1, split);
  assert.deepEqual(steps.map((step) => step.id), [a.id, split.id]);
  assert.equal(split.type === "split" && split.yes[0]?.id, b.id);
  // Lo que se suelta detrás de la división cae en su rama «Sí».
  const c = newStep("email", account);
  insertStep(steps, "root", 2, c);
  assert.equal(locate(steps, c.id)?.listId, `${split.id}:yes`);
  // «Añadir al final» va a la rama «No» de la última división.
  assert.deepEqual(tailList(steps), { listId: `${split.id}:no`, index: 0 });
});

test("borrar una división deja su rama «Sí» en su sitio", () => {
  const a = newStep("email", account);
  const split = newStep("split", account);
  const steps: FlowStep[] = [a, split];
  const inner = newStep("delay", account);
  insertStep(steps, `${split.id}:yes`, 0, inner);
  assert.equal(containsList(split, `${split.id}:yes`), true);
  removeStep(steps, split.id);
  assert.deepEqual(steps.map((step) => step.id), [a.id, inner.id]);
});

test("la pregunta de la división se lee en castellano y usa la métrica de Shopify", () => {
  const split = newStep("split", account);
  assert.equal(split.type === "split" && split.condition.kind === "metric" && split.condition.metric_id, "PO");
  assert.equal(split.type === "split" && conditionQuestion(split.condition, account), "¿Ha hecho «Hizo un pedido» desde que entró en el flow?");
  assert.equal(
    conditionQuestion({ kind: "metric", metric_id: "SC", operator: "equals", value: 0, timeframe: { kind: "in-the-last", quantity: 30, unit: "day" } }, account),
    "¿No ha hecho «Empezó el pago» en los últimos 30 días?",
  );
});

test("la plantilla de carrito exige piezas y avisa de las no aprobadas", () => {
  const { design } = FLOW_TEMPLATES.find((template) => template.key === "cart")!.build(account);
  assert.equal(design.trigger.id, "SC");
  const bad = reviewFlow(design, account, new Map()).filter((check) => check.state === "bad").map((check) => check.title);
  assert.deepEqual(bad, ["Cada email tiene su contenido"]);
});
