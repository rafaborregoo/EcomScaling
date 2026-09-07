/**
 * El hilo es la unica pantalla donde una campaña dice si tiene pieza. Un
 * filtro mal puesto aqui no da error: la campaña simplemente no sale, y no se
 * distingue de una que no existe. El consultor da por hecho que no hay nada
 * que sacar y la fecha pasa vacia.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { visibleCampaignRows } from "./campaign-thread-rows";
import type { CampaignItem } from "@/hooks/use-campaign-items";

const NOW = Date.parse("2026-09-06T12:00:00.000Z");
const day = (offset: number) =>
  new Date(NOW + offset * 86_400_000).toISOString();

function item(overrides: Partial<CampaignItem> & { id: string }): CampaignItem {
  return {
    calendar_id: "cal-1",
    title: overrides.id,
    description: null,
    channel: "Email",
    status: "planned",
    starts_at: day(1),
    ends_at: null,
    marketing_draft_id: null,
    meta_campaign_id: null,
    klaviyo_campaign_id: null,
    ...overrides,
  };
}

test("una campaña recien terminada sigue a la vista; una vieja no", () => {
  const rows = visibleCampaignRows(
    [
      item({ id: "acabo-hace-3-dias", starts_at: day(-10), ends_at: day(-3) }),
      item({ id: "acabo-hace-30-dias", starts_at: day(-40), ends_at: day(-30) }),
      item({ id: "en-curso", starts_at: day(-2), ends_at: day(5) }),
      item({ id: "por-venir", starts_at: day(20), ends_at: day(27) }),
    ],
    NOW,
  );

  assert.deepEqual(
    rows.map((row) => row.id),
    ["acabo-hace-3-dias", "en-curso", "por-venir"],
    "se ordenan por fecha de inicio y la de hace un mes ya no aporta",
  );
});

test("una campaña de un solo dia se mide por su fecha de inicio", () => {
  // Sin `ends_at`, comparar contra null daria NaN y la fila desapareceria
  // siempre: el caso mas comun (una campaña puntual) seria el invisible.
  const rows = visibleCampaignRows(
    [
      item({ id: "hoy", starts_at: day(0), ends_at: null }),
      item({ id: "ayer", starts_at: day(-1), ends_at: null }),
      item({ id: "hace-un-mes", starts_at: day(-30), ends_at: null }),
    ],
    NOW,
  );

  assert.deepEqual(
    rows.map((row) => row.id),
    ["ayer", "hoy"],
  );
});

test("las canceladas no ocupan sitio", () => {
  const rows = visibleCampaignRows(
    [
      item({ id: "cancelada", status: "cancelled", ends_at: day(5) }),
      item({ id: "viva", ends_at: day(5) }),
    ],
    NOW,
  );

  assert.deepEqual(
    rows.map((row) => row.id),
    ["viva"],
  );
});

test("una fecha corrupta no arrastra a toda la lista", () => {
  const rows = visibleCampaignRows(
    [
      item({ id: "rota", starts_at: "no-es-una-fecha", ends_at: null }),
      item({ id: "buena", starts_at: day(2), ends_at: day(4) }),
    ],
    NOW,
  );

  assert.deepEqual(rows.map((row) => row.id), ["buena"]);
});

test("la lista se corta antes de convertirse en un scroll infinito", () => {
  const rows = visibleCampaignRows(
    Array.from({ length: 30 }, (_, index) =>
      item({ id: `c${index}`, starts_at: day(index + 1) }),
    ),
    NOW,
  );

  assert.equal(rows.length, 12);
  assert.equal(rows[0]?.id, "c0", "se quedan las mas proximas, no las ultimas");
});
