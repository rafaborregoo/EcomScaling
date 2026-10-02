import assert from "node:assert/strict";
import test from "node:test";
import {
  clientNextStep,
  splitCriterion,
  type StepMilestone,
  type StepPhase,
  type StepTask,
} from "./next-step";

const HOY = "2026-09-07";

const task = (id: string, status = "pending"): StepTask => ({
  id,
  title: `Tarea ${id}`,
  status,
  due_at: null,
});

const milestone = (
  name: string,
  position: number,
  status: string,
  targetDate: string | null = null,
  tasks: StepTask[] = [],
): StepMilestone => ({
  id: name,
  name,
  position,
  status,
  target_date: targetDate,
  milestone_task_links: tasks.map((item) => ({ tasks: item })),
});

const phase = (
  name: string,
  status: string,
  milestones: StepMilestone[] = [],
): StepPhase => ({
  id: name,
  name,
  status,
  strategic_plan_milestones: milestones,
});

test("un plan en borrador no se presenta como si estuviera en marcha", () => {
  // La trampa: el borrador pinta el arbol entero, con fases e hitos con fecha.
  const step = clientNextStep(
    "draft",
    [phase("Cimientos", "active", [milestone("Margen", 1, "in_progress")])],
    HOY,
  );

  assert.equal(step.tone, "warn");
  assert.match(step.headline, /no ha arrancado/);
});

test("plan activo sin ninguna fase activa: el camino esta parado", () => {
  const step = clientNextStep(
    "active",
    [phase("Cimientos", "pending"), phase("Escala", "pending")],
    HOY,
  );

  assert.equal(step.tone, "warn");
  assert.match(step.headline, /Ninguna fase/);
  assert.match(step.detail, /2 fases preparadas/);
});

test("todas las fases cerradas es un final, no un error", () => {
  const step = clientNextStep(
    "active",
    [phase("Cimientos", "completed"), phase("Escala", "completed")],
    HOY,
  );

  assert.equal(step.tone, "success");
  assert.match(step.headline, /camino entero/);
});

test("fase activa con todos los hitos cerrados: falta arrancar la siguiente", () => {
  // Terminada de hecho, activa de derecho: sin decirlo el cliente no sabe que
  // esta esperando a que alguien pase de fase.
  const step = clientNextStep(
    "active",
    [
      phase("Cimientos", "active", [
        milestone("Margen", 1, "completed"),
        milestone("Stock", 2, "skipped"),
      ]),
    ],
    HOY,
  );

  assert.equal(step.tone, "success");
  assert.match(step.headline, /terminado la fase Cimientos/);
  assert.deepEqual(step.tasks, []);
});

test("el hito en curso manda sobre el primero pendiente", () => {
  const step = clientNextStep(
    "active",
    [
      phase("Cimientos", "active", [
        milestone("Margen", 1, "pending"),
        milestone("Stock", 2, "in_progress", null, [task("t1"), task("t2")]),
      ]),
    ],
    HOY,
  );

  assert.equal(step.headline, "Estás en Stock");
  assert.equal(step.tasks.length, 2);
});

test("sin hito en curso toca el primero pendiente por posicion", () => {
  const step = clientNextStep(
    "active",
    [
      phase("Cimientos", "active", [
        milestone("Stock", 2, "pending"),
        milestone("Margen", 1, "pending"),
      ]),
    ],
    HOY,
  );

  assert.equal(step.headline, "Lo siguiente es Margen");
});

test("un hito con la fecha pasada avisa de que va tarde", () => {
  const step = clientNextStep(
    "active",
    [
      phase("Cimientos", "active", [
        milestone("Margen", 1, "in_progress", "2026-08-01", [task("t1")]),
      ]),
    ],
    HOY,
  );

  assert.equal(step.tone, "warn");
  assert.match(step.headline, /Vas tarde en Margen/);
});

test("la fecha de hoy todavia no es ir tarde", () => {
  // El limite exacto: vencer hoy es estar a tiempo, no llegar tarde.
  const step = clientNextStep(
    "active",
    [phase("Cimientos", "active", [milestone("Margen", 1, "in_progress", HOY)])],
    HOY,
  );

  assert.equal(step.tone, "brand");
});

test("solo cuentan las tareas abiertas del hito", () => {
  const step = clientNextStep(
    "active",
    [
      phase("Cimientos", "active", [
        milestone("Margen", 1, "in_progress", null, [
          task("t1"),
          task("t2", "completed"),
          task("t3", "in_progress"),
        ]),
      ]),
    ],
    HOY,
  );

  assert.equal(step.tasks.length, 2);
  assert.match(step.detail, /2 tareas abiertas/);
});

test("un hito sin tareas lo dice, en vez de quedarse en blanco", () => {
  const step = clientNextStep(
    "active",
    [phase("Cimientos", "active", [milestone("Margen", 1, "pending")])],
    HOY,
  );

  assert.match(step.detail, /ninguna tarea anotada/i);
});

test("un plan activo sin fases no revienta", () => {
  const step = clientNextStep("active", [], HOY);
  assert.equal(step.tone, "warn");
  assert.match(step.headline, /no tiene fases/);
});

test("splitCriterion separa el criterio de éxito que A19 pliega en la descripción", () => {
  assert.deepEqual(splitCriterion("Subir el ticket.\n\nCriterio de exito: ticket medio >= 58 € un mes completo"), {
    text: "Subir el ticket.",
    criterion: "ticket medio >= 58 € un mes completo",
  });
  assert.deepEqual(splitCriterion("Sin criterio"), { text: "Sin criterio", criterion: null });
  assert.deepEqual(splitCriterion(null), { text: "", criterion: null });
});
