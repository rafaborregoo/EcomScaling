/**
 * El triaje decide a que cliente mira el consultor primero. Si ordena mal o se
 * come una fila, el fallo no se ve: la pantalla sigue pareciendo correcta y el
 * cliente que estaba parado simplemente no sale arriba.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clientsNeedingWork,
  triageClients,
  type PlanningItem,
} from "./portfolio-triage";

const NOW = Date.parse("2026-09-06T12:00:00.000Z");
const day = (offset: number) =>
  new Date(NOW + offset * 86_400_000).toISOString();

function item(overrides: Partial<PlanningItem> & { id: string }): PlanningItem {
  return {
    title: overrides.id,
    channel: "Email",
    starts_at: day(3),
    ends_at: null,
    status: "planned",
    organization_id: "org-a",
    organization_name: "Tienda A",
    blocked_reason: null,
    marketing_draft_id: "draft-1",
    ...overrides,
  };
}

const orgs = [
  { id: "org-a", display_name: "Tienda A" },
  { id: "org-b", display_name: "Tienda B" },
];

test("los clientes se ordenan por gravedad, no por nombre", () => {
  const rows = triageClients(
    [
      item({ id: "a1", organization_id: "org-a" }),
      item({
        id: "b1",
        organization_id: "org-b",
        starts_at: day(-2),
        status: "in_progress",
        blocked_reason: "Falta aprobación del cliente",
      }),
    ],
    orgs,
    NOW,
  );

  assert.deepEqual(
    rows.map((row) => [row.organizationName, row.reason]),
    [
      ["Tienda B", "1 acción parada"],
      ["Tienda A", "Al día"],
    ],
  );
});

test("un cliente sin ninguna accion aparece, no desaparece", () => {
  // Es el caso que mas importa y el que una lista construida desde los items
  // se salta: sin filas no hay cliente, y el que no tiene nada planificado es
  // justo el que necesita atencion.
  const rows = triageClients([item({ id: "a1" })], orgs, NOW);
  const b = rows.find((row) => row.organizationId === "org-b");
  assert.equal(b?.reason, "Sin nada planificado");
  assert.equal(b?.upcomingCount, 0);
});

test("parada gana a vencida: es un motivo, no una lista de sintomas", () => {
  const rows = triageClients(
    [
      item({ id: "vencida", starts_at: day(-5) }),
      item({
        id: "parada",
        starts_at: day(-1),
        status: "in_progress",
        blocked_reason: "Sin presupuesto",
      }),
    ],
    orgs,
    NOW,
  );
  const a = rows.find((row) => row.organizationId === "org-a");
  assert.equal(a?.reason, "1 acción parada");
  // La vencida sigue contada aunque no sea el titular.
  assert.equal(a?.overdue.length, 1);
  assert.equal(a?.blocked.length, 1);
});

test("una accion completada o cancelada no cuenta como vencida", () => {
  const rows = triageClients(
    [
      item({ id: "hecha", starts_at: day(-9), status: "completed" }),
      item({ id: "anulada", starts_at: day(-9), status: "cancelled" }),
      item({ id: "futura" }),
    ],
    orgs,
    NOW,
  );
  assert.equal(
    rows.find((row) => row.organizationId === "org-a")?.reason,
    "Al día",
  );
});

test("solo los canales que producen pieza cuentan como 'sin pieza'", () => {
  // Una accion operativa ("revisar stock") no lleva pieza nunca: marcarla
  // seria un aviso permanente que nadie puede resolver.
  const rows = triageClients(
    [
      item({ id: "operativa", channel: "Operativa", marketing_draft_id: null }),
      item({ id: "email", channel: "Email", marketing_draft_id: "d" }),
    ],
    orgs,
    NOW,
  );
  assert.equal(
    rows.find((row) => row.organizationId === "org-a")?.reason,
    "Al día",
  );

  const sinPieza = triageClients(
    [item({ id: "email", channel: "Email", marketing_draft_id: null })],
    orgs,
    NOW,
  );
  assert.equal(
    sinPieza.find((row) => row.organizationId === "org-a")?.reason,
    "1 sin pieza escrita",
  );
});

test("la proxima accion es la mas cercana en el futuro, no la primera de la lista", () => {
  const rows = triageClients(
    [
      item({ id: "lejos", starts_at: day(20) }),
      item({ id: "cerca", starts_at: day(2) }),
      item({ id: "pasada", starts_at: day(-30), status: "completed" }),
    ],
    orgs,
    NOW,
  );
  assert.equal(rows.find((row) => row.organizationId === "org-a")?.next?.id, "cerca");
});

test("el titular cuenta clientes que piden algo, no acciones", () => {
  const rows = triageClients(
    [
      item({ id: "a1", starts_at: day(-1) }),
      item({ id: "a2", starts_at: day(-2) }),
      item({ id: "a3", starts_at: day(-3) }),
    ],
    orgs,
    NOW,
  );
  // Tienda A con 3 vencidas + Tienda B sin nada = 2 clientes, no 3 acciones.
  assert.equal(clientsNeedingWork(rows), 2);
});

test("acciones de una organizacion que ya no esta asignada no inventan filas", () => {
  const rows = triageClients(
    [item({ id: "huerfana", organization_id: "org-fuera" })],
    orgs,
    NOW,
  );
  assert.equal(rows.length, 2);
  assert.ok(!rows.some((row) => row.organizationId === "org-fuera"));
});
