import assert from "node:assert/strict";
import test from "node:test";
import { fetchAllByOrganization, scoreAttention } from "./consultant-attention.js";

const NOW = Date.parse("2026-10-09T12:00:00Z");

test("scoreAttention pondera severidad, antiguedad y tareas vencidas por organizacion", () => {
  const scores = scoreAttention(
    ["a", "b"],
    [
      { organization_id: "a", severity: "critical", first_detected_at: "2026-10-04T12:00:00Z" },
      { organization_id: "a", severity: "low", first_detected_at: null },
    ],
    [
      { organization_id: "a", due_at: "2026-10-01T00:00:00Z" },
      { organization_id: "a", due_at: "2026-10-20T00:00:00Z" },
    ],
    NOW,
  );
  // 10 + 1 de severidad, 5 dias de la alerta mas antigua, 1 tarea vencida x3.
  assert.equal(scores.get("a")?.score, 10 + 1 + 5 + 3);
  assert.equal(scores.get("a")?.open_alerts, 2);
  assert.equal(scores.get("a")?.critical_alerts, 1);
  assert.equal(scores.get("a")?.overdue_tasks, 1);
  assert.equal(scores.get("a")?.open_tasks, 2);
  assert.equal(scores.get("b")?.score, 0);
});

test("scoreAttention limita la antiguedad a 14 dias", () => {
  const scores = scoreAttention(
    ["a"],
    [{ organization_id: "a", severity: "info", first_detected_at: "2026-01-01T00:00:00Z" }],
    [],
    NOW,
  );
  assert.equal(scores.get("a")?.score, 14);
});

test("fetchAllByOrganization pagina dentro de cada lote de ids y junta todo", async () => {
  let calls = 0;
  const result = await fetchAllByOrganization<number>(
    ["a", "b", "c"],
    async (chunk, from) => {
      calls += 1;
      // El lote ["a","b"] tiene 3 filas en dos paginas de 2; el de ["c"], 1.
      if (chunk.length === 2) return { data: from === 0 ? [1, 2] : [3], error: null };
      return { data: [9], error: null };
    },
    { chunkSize: 2, pageSize: 2 },
  );
  assert.deepEqual(result, { data: [1, 2, 3, 9], error: null });
  assert.equal(calls, 3);
});

test("fetchAllByOrganization devuelve el error en vez de esconderlo", async () => {
  const result = await fetchAllByOrganization<number>(["a"], async () => ({ data: null, error: { message: "boom" } }));
  assert.equal(result.error, "boom");
});
