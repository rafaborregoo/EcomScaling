import assert from "node:assert/strict";
import test from "node:test";
import { displayBoolean, displayLabel, displayValue } from "./display-labels.js";

test("traduce enums canónicos de conectores para la interfaz", () => {
  assert.equal(displayValue("pending_deletion"), "Pending Deletion");
  assert.equal(displayValue("reauthorization_required"), "requiere reautorización");
  assert.equal(displayValue("OUTCOME_SALES"), "ventas");
  assert.equal(displayValue("OUTCOME_TRAFFIC"), "tráfico");
  assert.equal(displayValue("publisher_platform"), "Publisher Platform");
  assert.equal(displayLabel("net_profit"), "Beneficio neto");
});

test("humaniza valores desconocidos sin exponer separadores técnicos", () => {
  assert.equal(displayValue("new_sync_state"), "New Sync State");
  assert.equal(displayLabel("custom_field_name"), "Custom Field Name");
});

test("presenta booleanos y ausencias de forma consistente", () => {
  assert.equal(displayBoolean(true), "Sí");
  assert.equal(displayBoolean(false), "No");
  assert.equal(displayBoolean(null), "Sin indicar");
  assert.equal(displayValue(null), "Sin indicar");
});
