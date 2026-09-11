import assert from "node:assert/strict";
import test from "node:test";
import {
  composeTask,
  insightBadgeCount,
  type MetricInsight,
} from "./metric-insights-task";

const roas: MetricInsight[] = [
  {
    id: "a",
    title: "ROAS bajo break-even",
    severity: "high",
    evidence: "1,84x contra 2,30x",
    steps: ["Pausar conjuntos < 1,5x"],
    needsTask: true,
  },
  {
    id: "b",
    title: "Costes desactualizados",
    severity: "medium",
    evidence: "Sin tocar desde mayo",
    steps: ["Revisar coste por producto"],
    needsTask: true,
  },
  {
    id: "c",
    title: "Ventana de atribución de 7 días",
    severity: "info",
    evidence: "Atribuido por Meta",
    steps: ["Contrastar con ingresos netos"],
  },
];

test("el contador de la card ignora lo informativo", () => {
  assert.equal(insightBadgeCount(roas), 2);
  assert.equal(insightBadgeCount([roas[2]]), 0);
  assert.equal(insightBadgeCount([]), 0);
});

test("una sola notificacion conserva su titulo", () => {
  const task = composeTask("ROAS", [roas[0]]);
  assert.equal(task.title, "ROAS bajo break-even");
  assert.match(task.description, /Contexto \(ROAS\):/);
  assert.match(task.description, /1\. Pausar conjuntos < 1,5x/);
});

test("varias notificaciones se funden en UNA tarea con el contexto de todas", () => {
  const task = composeTask("ROAS", [roas[0], roas[1]]);
  assert.equal(task.title, "ROAS: 2 puntos a revisar");
  // Lo que se pide: la tarea de una lleva tambien el contexto de la otra.
  assert.match(task.description, /ROAS bajo break-even: 1,84x contra 2,30x/);
  assert.match(task.description, /Costes desactualizados: Sin tocar desde mayo/);
  // Y los pasos se numeran seguidos, no dos listas que empiezan en 1.
  assert.match(task.description, /1\. Pausar conjuntos < 1,5x/);
  assert.match(task.description, /2\. Revisar coste por producto/);
});
