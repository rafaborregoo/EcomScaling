/**
 * El fallback de la auditoría.
 *
 * El mapa de verbos se queda corto en cuanto alguien añada una acción nueva y
 * no toque este fichero -- que es lo normal. Si el fallback fallara, la fila
 * saldría en blanco: un registro de auditoría que existe, se lista y no dice
 * qué pasó es peor que no tenerlo, porque parece completo.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { auditSummary, errorTone, AUDIT_AREAS } from "./audit-entry";

test("una acción conocida se lee en castellano", () => {
  assert.deepEqual(auditSummary("knowledge.create_constraint"), {
    area: "Conocimiento",
    verb: "creó una regla del copiloto",
  });
});

test("una acción SIN mapear nunca sale en blanco", () => {
  // Es el caso que va a pasar de verdad: alguien añade recordAuditLog con un
  // código nuevo y no se acuerda de este mapa.
  const summary = auditSummary("consultant.create_own_store");
  assert.equal(summary.area, "Clientes");
  assert.equal(summary.verb, "create own store");
  assert.notEqual(summary.verb, "", "una fila sin texto parece un registro vacío");
});

test("un área desconocida tampoco deja la etiqueta vacía", () => {
  const summary = auditSummary("facturacion.cobrar_plan");
  assert.equal(summary.area, "facturacion");
  assert.equal(summary.verb, "cobrar plan");
});

test("un código malformado no rompe la fila", () => {
  // Sin punto, o vacío: viene de la base de datos, no de un literal del código.
  const sinPunto = auditSummary("algosuelto");
  assert.equal(sinPunto.area, "algosuelto");
  assert.equal(sinPunto.verb, "");

  const vacio = auditSummary("");
  assert.equal(typeof vacio.area, "string");
  assert.equal(typeof vacio.verb, "string");
});

test("un sync caído pesa más que un agente con error", () => {
  // Un sync roto deja al cliente sin datos; un agente con error afecta a una
  // respuesta. Si los dos se pintan igual, el panel deja de priorizar.
  assert.equal(errorTone("sync"), "danger");
  assert.equal(errorTone("agent"), "warn");
});

test("el filtro de áreas empieza por 'todas' y usa prefijos reales", () => {
  assert.equal(AUDIT_AREAS[0]?.value, "", "sin filtro por defecto");
  // El backend filtra con `like 'valor%'`: un valor que no sea el prefijo real
  // de ningún código dejaría el filtro sin resultados y pareceria "no pasó nada".
  for (const area of AUDIT_AREAS.slice(1)) {
    assert.match(area.value, /^[a-z_]+$/, `"${area.value}" no es un prefijo válido`);
  }
});
