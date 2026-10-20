import assert from "node:assert/strict";
import test from "node:test";
import { findDelegatedAnalysisSteps } from "./delegated-analysis.js";

test("marca los pasos de análisis y deja pasar las acciones humanas", () => {
  // Tarea real de A04 (Black Friday, oct-2026): los pasos 2-4 eran cálculo.
  const description = [
    "1) En Shopify > Productos, seleccionar variantes disponibles de chaqueta, sudaderas y complementos a partir de la verificación inicial.",
    "2) Comparar venta individual, pack pertinente y regalo de coste controlado usando precio, coste real, preparación, comisiones y envío por pedido.",
    "3) Probar un umbral de pack o regalo en torno a 65 € como hipótesis frente al ticket medio de 53,53 €.",
    "4) Calcular la contribución de cada alternativa después del incentivo y excluir cualquier opción que no sea positiva.",
    "5) En Shopify > Descuentos, preparar las condiciones de la alternativa elegida sin activarla.",
  ].join(" ");
  const flagged = findDelegatedAnalysisSteps(description);
  assert.equal(flagged.length, 3);
  assert.match(flagged[0]!, /^Comparar/);
  assert.match(flagged[1]!, /^Probar/);
  assert.match(flagged[2]!, /^Calcular/);

  assert.deepEqual(findDelegatedAnalysisSteps("1) Revisar el asunto del email 2) Revisar las métricas de apertura"), [
    "Revisar las métricas de apertura",
  ]);
  assert.deepEqual(findDelegatedAnalysisSteps("Llamar al proveedor y pedir plazo de entrega."), []);
  assert.deepEqual(findDelegatedAnalysisSteps(null), []);
});
