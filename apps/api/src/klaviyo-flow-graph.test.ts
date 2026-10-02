import assert from "node:assert/strict";
import test from "node:test";
import { buildKlaviyoFlowGraph, delayLabel, readKlaviyoFlowGraph } from "./klaviyo-flow-graph.js";

test("flow graph keeps ids, links, branches and readable labels", () => {
  const graph = buildKlaviyoFlowGraph(
    {
      data: {
        attributes: {
          definition: {
            entry_action_id: "a1",
            triggers: [{ type: "metric", id: "M-checkout" }],
            actions: [
              { id: "a1", type: "time-delay", links: { next: "a2" }, data: { unit: "hours", value: 1 } },
              {
                id: "a2",
                type: "send-email",
                links: { next: "a3" },
                data: { message: { name: "Te dejaste algo", subject_line: "¿Lo olvidaste?", template_id: "T1" } },
              },
              {
                id: "a3",
                type: "conditional-split",
                links: { next_if_true: "a4", next_if_false: "a5" },
                data: {
                  profile_filter: {
                    condition_groups: [{ conditions: [{ type: "profile-metric", metric_id: "M-order", measurement: "count" }] }],
                  },
                },
              },
              { id: "a4", type: "end-flow" },
              { id: "a5", type: "time-delay", links: { next: null }, data: { unit: "days", value: 2, delay_until_time: "10:00:00" } },
            ],
          },
        },
      },
    },
    { metrics: new Map([["M-checkout", "Started Checkout"], ["M-order", "Placed Order"]]) },
  );
  assert.ok(graph);
  assert.equal(graph.entry, "a1");
  assert.equal(graph.triggers[0]!.label, "Cuando alguien hace «Started Checkout»");
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  assert.equal(byId.get("a1")!.label, "Espera 1 hora");
  assert.equal(byId.get("a2")!.kind, "email");
  assert.equal(byId.get("a2")!.subject, "¿Lo olvidaste?");
  assert.equal(byId.get("a3")!.label, "¿Ha hecho «Placed Order»?");
  assert.equal(byId.get("a3")!.yes, "a4");
  assert.equal(byId.get("a3")!.no, "a5");
  assert.equal(byId.get("a5")!.label, "Espera 2 días, hasta las 10:00");
  assert.deepEqual(readKlaviyoFlowGraph(graph), graph);
});

test("flow graph tolerates missing definition and legacy yes/no links", () => {
  assert.equal(buildKlaviyoFlowGraph({ data: { attributes: {} } }), null);
  const graph = buildKlaviyoFlowGraph({
    definition: { actions: [{ id: "s", type: "conditional_split", links: { yes: "x", no: "y" }, data: {} }] },
  });
  assert.equal(graph!.entry, "s");
  assert.equal(graph!.nodes[0]!.yes, "x");
  assert.equal(graph!.nodes[0]!.label, "División condicional");
  assert.equal(delayLabel({}), "Espera");
  assert.equal(readKlaviyoFlowGraph({ version: 2, nodes: [] }), null);
});
