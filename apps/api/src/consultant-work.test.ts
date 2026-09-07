/**
 * "Mi trabajo" no guarda nada: todo lo que muestra son criterios de reparto
 * sobre datos que ya existen. Esos criterios son justo lo que se rompe en
 * silencio -- la pantalla sigue pintando tarjetas, solo que las equivocadas.
 *
 * Lo que se protege aqui:
 *  - una llamada agendada que ya paso y nadie cerro NO desaparece (seria la
 *    forma mas facil de perder trabajo pendiente),
 *  - "ultima llamada" es la mas reciente REALIZADA, no la ultima creada,
 *  - un cliente sin nada agendado sale en la lista de descubiertos, y el que
 *    nunca ha tenido llamada va antes que el que la tuvo hace tres meses.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConsultantWork,
  type WorkCallRow,
  type WorkTaskRow,
} from "./consultant.js";

const NOW = Date.parse("2026-09-05T10:00:00.000Z");
const DAY = 86_400_000;

const organizations = [
  { id: "org-a", display_name: "Tienda A" },
  { id: "org-b", display_name: "Tienda B" },
  { id: "org-c", display_name: "Tienda C" },
];

function call(overrides: Partial<WorkCallRow>): WorkCallRow {
  return {
    id: "call-x",
    title: "Revisión",
    call_type: "monthly_review",
    status: "scheduled",
    scheduled_at: null,
    held_at: null,
    organization_id: "org-a",
    internal_notes: [],
    gaps: [],
    ...overrides,
  };
}

function task(overrides: Partial<WorkTaskRow>): WorkTaskRow {
  return {
    id: "task-x",
    title: "Preparar análisis",
    status: "pending",
    priority: "medium",
    due_at: null,
    created_at: "2026-09-01T10:00:00.000Z",
    organization_id: "org-a",
    ...overrides,
  };
}

test("las proximas llamadas van en orden y solo dentro del horizonte", () => {
  const result = buildConsultantWork({
    organizations,
    calls: [
      call({
        id: "en-3-dias",
        scheduled_at: new Date(NOW + 3 * DAY).toISOString(),
      }),
      call({
        id: "manana",
        organization_id: "org-b",
        scheduled_at: new Date(NOW + DAY).toISOString(),
      }),
      call({
        id: "en-40-dias",
        organization_id: "org-c",
        scheduled_at: new Date(NOW + 40 * DAY).toISOString(),
      }),
    ],
    tasks: [],
    nowMs: NOW,
  });

  assert.deepEqual(
    result.upcoming_calls.map((row) => row.id),
    ["manana", "en-3-dias"],
    "ordenadas por fecha y sin la de dentro de 40 dias",
  );
});

test("una llamada agendada que ya paso sigue arriba, marcada", () => {
  const result = buildConsultantWork({
    organizations,
    calls: [
      call({
        id: "manana",
        organization_id: "org-b",
        scheduled_at: new Date(NOW + DAY).toISOString(),
      }),
      call({
        id: "era-el-martes",
        scheduled_at: new Date(NOW - 2 * DAY).toISOString(),
      }),
    ],
    tasks: [],
    nowMs: NOW,
  });

  assert.deepEqual(
    result.upcoming_calls.map((row) => row.id),
    ["era-el-martes", "manana"],
    "la vencida primero: es la que hay que cerrar",
  );
  assert.equal(result.upcoming_calls[0]?.is_overdue, true);
  assert.equal(result.upcoming_calls[1]?.is_overdue, false);
});

test("una llamada realizada nunca cuenta como proxima", () => {
  const result = buildConsultantWork({
    organizations,
    calls: [
      call({
        id: "ya-hecha",
        status: "held",
        scheduled_at: new Date(NOW + DAY).toISOString(),
        held_at: new Date(NOW - DAY).toISOString(),
      }),
    ],
    tasks: [],
    nowMs: NOW,
  });

  assert.equal(result.upcoming_calls.length, 0);
});

test("la preparacion trae los huecos de la ultima llamada REALIZADA", () => {
  const result = buildConsultantWork({
    organizations,
    calls: [
      call({
        id: "proxima",
        scheduled_at: new Date(NOW + DAY).toISOString(),
      }),
      call({
        id: "antigua",
        status: "held",
        held_at: new Date(NOW - 60 * DAY).toISOString(),
        gaps: [{ topic: "Stock", severity: "high" }],
      }),
      call({
        id: "reciente",
        status: "held",
        held_at: new Date(NOW - 20 * DAY).toISOString(),
        gaps: [{ topic: "Margen", severity: "medium" }],
      }),
    ],
    tasks: [],
    nowMs: NOW,
  });

  assert.equal(result.upcoming_calls[0]?.last_call?.id, "reciente");
  assert.deepEqual(result.upcoming_calls[0]?.last_call?.gaps, [
    { topic: "Margen", severity: "medium" },
  ]);
});

test("los clientes sin nada agendado salen ordenados por silencio", () => {
  const result = buildConsultantWork({
    organizations,
    calls: [
      call({
        id: "proxima-a",
        organization_id: "org-a",
        scheduled_at: new Date(NOW + DAY).toISOString(),
      }),
      call({
        id: "vieja-b",
        organization_id: "org-b",
        status: "held",
        held_at: new Date(NOW - 45 * DAY).toISOString(),
      }),
    ],
    tasks: [],
    nowMs: NOW,
  });

  assert.deepEqual(
    result.uncovered_clients.map((client) => client.id),
    ["org-c", "org-b"],
    "el que nunca ha tenido llamada va antes que el de hace 45 dias",
  );
  assert.equal(result.uncovered_clients[0]?.days_since_last_call, null);
  assert.equal(result.uncovered_clients[1]?.days_since_last_call, 45);
});

test("mis tareas: vencidas primero, luego por prioridad", () => {
  const result = buildConsultantWork({
    organizations,
    calls: [],
    tasks: [
      task({ id: "media", priority: "medium" }),
      task({ id: "urgente", priority: "urgent" }),
      task({
        id: "vencida-baja",
        priority: "low",
        due_at: new Date(NOW - DAY).toISOString(),
      }),
      task({ id: "cerrada", status: "completed", priority: "urgent" }),
    ],
    nowMs: NOW,
  });

  assert.deepEqual(
    result.my_tasks.map((row) => row.id),
    ["vencida-baja", "urgente", "media"],
    "una vencida de prioridad baja pesa mas que una urgente sin fecha",
  );
  assert.equal(result.my_tasks[0]?.is_overdue, true);
});

test("cada llamada dice cuantas tareas tuyas hay con ese cliente", () => {
  const result = buildConsultantWork({
    organizations,
    calls: [
      call({
        id: "proxima-a",
        organization_id: "org-a",
        scheduled_at: new Date(NOW + DAY).toISOString(),
      }),
    ],
    tasks: [
      task({ id: "t1", organization_id: "org-a" }),
      task({ id: "t2", organization_id: "org-a", status: "in_progress" }),
      task({ id: "t3", organization_id: "org-a", status: "completed" }),
      task({ id: "t4", organization_id: "org-b" }),
    ],
    nowMs: NOW,
  });

  assert.equal(
    result.upcoming_calls[0]?.my_open_tasks,
    2,
    "solo las abiertas de ese cliente",
  );
});
