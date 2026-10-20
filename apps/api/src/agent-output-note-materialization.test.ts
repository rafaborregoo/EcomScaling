import assert from "node:assert/strict";
import test from "node:test";
import { materializeApprovedAgentOutputNote } from "./agent-output-note-materialization.js";

test("una nota aprobada se crea y un reintento recupera el mismo registro", async () => {
  const notes = new Map<string, { id: string; body: string }>();
  let nextId = 0;
  const store = {
    async upsert(row: { output_id: string; agent_proposal_index: number; body: string }) {
      const key = `${row.output_id}:${row.agent_proposal_index}`;
      if (notes.has(key)) return { id: null, error: null };
      const note = { id: `note-${++nextId}`, body: row.body };
      notes.set(key, note);
      return { id: note.id, error: null };
    },
    async find(outputId: string, proposalIndex: number) {
      return { id: notes.get(`${outputId}:${proposalIndex}`)?.id ?? null, error: null };
    },
  };
  const input = {
    outputId: "output-1",
    organizationId: "org-1",
    authorUserId: "user-1",
    proposalIndex: 2,
    title: "  Revisar evidencia  ",
    description: " Añadir dato de margen ",
  };

  const first = await materializeApprovedAgentOutputNote(store, input);
  const retry = await materializeApprovedAgentOutputNote(store, input);

  assert.deepEqual(first, { ok: true, id: "note-1" });
  assert.deepEqual(retry, first);
  assert.equal(notes.size, 1);
  assert.equal(notes.get("output-1:2")?.body, "Revisar evidencia — Añadir dato de margen");
});

test("una propuesta note sin texto útil falla sin intentar escribir", async () => {
  let writes = 0;
  const result = await materializeApprovedAgentOutputNote({
    async upsert() { writes += 1; return { id: "unused", error: null }; },
    async find() { return { id: null, error: null }; },
  }, {
    outputId: "output-1",
    organizationId: "org-1",
    authorUserId: "user-1",
    proposalIndex: 0,
    title: "   ",
  });

  assert.deepEqual(result, { ok: false, reason: "note_body_required" });
  assert.equal(writes, 0);
});

test("un error de persistencia nunca presenta una nota como creada", async () => {
  const result = await materializeApprovedAgentOutputNote({
    async upsert() { return { id: null, error: new Error("write failed") }; },
    async find() { return { id: "must-not-read", error: null }; },
  }, {
    outputId: "output-1",
    organizationId: "org-1",
    authorUserId: "user-1",
    proposalIndex: 0,
    description: "Guardar esta nota",
  });

  assert.deepEqual(result, { ok: false, reason: "note_materialization_failed" });
});
