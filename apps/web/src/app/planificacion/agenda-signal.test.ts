/**
 * La agenda ordenaba solo por fecha, asi que una accion vencida hace dos
 * semanas salia arriba con la misma etiqueta ("Planificada") que una de
 * mañana. Ese fallo no rompe nada: simplemente el consultor no distingue lo
 * urgente y deja pasar la fecha.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { agendaSignal, sortAgenda } from "./agenda-signal";

const NOW = Date.parse("2026-09-06T12:00:00.000Z");
const at = (iso: string) => ({ starts_at: iso, status: "planned" });

test("una accion parada manda sobre su fecha", () => {
  // Bloqueada en el futuro sigue siendo el problema mas grave: nadie la va a
  // desbloquear sola, y cuando llegue la fecha ya sera tarde.
  const signal = agendaSignal(
    {
      starts_at: "2026-09-20T00:00:00.000Z",
      status: "in_progress",
      blocked_reason: "Falta aprobación",
    },
    NOW,
  );
  assert.equal(signal.state, "blocked");
  assert.equal(signal.tone, "danger");
});

test("el retraso se cuenta en dias de calendario, no de reloj", () => {
  // Ayer a las 23:00 esta vencida "1 dia", no "hace 13 horas".
  assert.equal(
    agendaSignal(at("2026-09-05T23:00:00.000Z"), NOW).label,
    "Vencida 1 día",
  );
  assert.equal(
    agendaSignal(at("2026-08-30T00:00:00.000Z"), NOW).label,
    "Vencida 7 días",
  );
});

test("hoy se dice 'Hoy', no 'En 0 dias'", () => {
  assert.equal(agendaSignal(at("2026-09-06T23:00:00.000Z"), NOW).label, "Hoy");
  assert.equal(agendaSignal(at("2026-09-06T00:00:00.000Z"), NOW).label, "Hoy");
});

test("el singular y el plural no se descuidan en lo que mas se lee", () => {
  assert.equal(agendaSignal(at("2026-09-07T10:00:00.000Z"), NOW).label, "En 1 día");
  assert.equal(agendaSignal(at("2026-09-09T10:00:00.000Z"), NOW).label, "En 3 días");
});

test("una fecha corrupta no finge urgencia", () => {
  const signal = agendaSignal({ starts_at: "mañana", status: "planned" }, NOW);
  assert.equal(signal.state, "later");
  assert.equal(signal.tone, "neutral");
});

test("el orden es por urgencia primero y fecha despues", () => {
  const sorted = sortAgenda(
    [
      { ...at("2026-09-08T00:00:00.000Z"), id: "en-2-dias" },
      { ...at("2026-09-01T00:00:00.000Z"), id: "vencida-5" },
      {
        starts_at: "2026-09-25T00:00:00.000Z",
        status: "in_progress",
        blocked_reason: "Sin creatividad",
        id: "parada",
      },
      { ...at("2026-09-06T09:00:00.000Z"), id: "hoy" },
      { ...at("2026-09-03T00:00:00.000Z"), id: "vencida-3" },
      { ...at("2026-09-02T00:00:00.000Z"), id: "hecha", status: "completed" },
    ],
    NOW,
  );

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["parada", "vencida-5", "vencida-3", "hoy", "en-2-dias"],
    "lo completado sale de la agenda; el resto va de lo que arde a lo tranquilo",
  );
});
