import assert from "node:assert/strict";
import test from "node:test";
import {
  callTaskAudience,
  callTaskStatusLabel,
  type CallTaskData,
} from "./call-task-view-model";

test("una tarea aprobada con status pending se presenta como trabajo por hacer", () => {
  assert.equal(callTaskStatusLabel("pending"), "Por hacer");
});

test("separa las tareas visibles del cliente de las internas del consultor", () => {
  const clientTask: CallTaskData = {
    is_visible_to_client: true,
    metadata: { owner: "cliente" },
  };
  const consultantTask: CallTaskData = {
    is_visible_to_client: false,
    metadata: { owner: "consultor" },
  };

  assert.equal(callTaskAudience(clientTask), "cliente");
  assert.equal(callTaskAudience(consultantTask), "consultor");
});

test("el owner guardado conserva la clasificación de tareas antiguas", () => {
  assert.equal(
    callTaskAudience({ metadata: { owner: "consultor" } }),
    "consultor",
  );
  assert.equal(callTaskAudience({ metadata: null }), "cliente");
});
