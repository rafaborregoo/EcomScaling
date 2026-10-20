import assert from "node:assert/strict";
import test from "node:test";
import { listTitles, mergeLines, notify } from "./notify.js";
import { madridDayBounds } from "./notification-daily.js";
import { notificationCategory } from "./notification-settings.js";

test("listTitles enumera con comillas y resume el resto", () => {
  assert.equal(listTitles([]), "");
  assert.equal(listTitles(["A"]), "«A»");
  assert.equal(listTitles(["A", "B"]), "«A» y «B»");
  assert.equal(listTitles(["A", "B", "C", "D", "E"]), "«A», «B», «C» y 2 más");
});

test("mergeLines junta sin repetir", () => {
  assert.equal(mergeLines("Ya no puedes x.\nAhora puedes y.", "Ahora puedes y.\nYa no puedes z."), "Ya no puedes x.\nAhora puedes y.\nYa no puedes z.");
  assert.equal(mergeLines(null, null), null);
});

test("el inicio del día es la medianoche de Madrid", () => {
  const { start, end } = madridDayBounds(new Date("2026-10-19T10:30:00Z"));
  assert.equal(start.toISOString(), "2026-10-18T22:00:00.000Z");
  assert.equal(end.getTime() - start.getTime(), 86_400_000 - 1);
});

test("los tipos nuevos no caen en «Otros»", () => {
  for (const type of ["task_comment", "task_completed", "daily_today", "ai_pending", "camino_objective"]) {
    assert.equal(notificationCategory(type), "task_assigned", type);
  }
  assert.equal(notificationCategory("client_decided_ai_output"), "client");
});

/** Doble mínimo de supabase: guarda lo que se inserta y actualiza. */
function fakeDb(existing: Array<{ id: string; user_id: string; title: string; message: string | null }>) {
  const inserted: unknown[] = [];
  const updated: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const db = {
    from() {
      const chain: Record<string, unknown> = {};
      let patch: Record<string, unknown> | null = null;
      chain.select = () => chain;
      chain.eq = (column: string, value: string) => {
        if (patch && column === "id") {
          updated.push({ id: value, patch });
          return Promise.resolve({ error: null });
        }
        return chain;
      };
      chain.in = () => Promise.resolve({ data: existing });
      chain.update = (value: Record<string, unknown>) => {
        patch = value;
        return chain;
      };
      chain.insert = (rows: unknown[]) => {
        inserted.push(...rows);
        return Promise.resolve({ error: null });
      };
      return chain;
    },
  };
  return { db: db as never, inserted, updated };
}

test("notify agrupa en el aviso sin leer y crea solo para quien no lo tiene", async () => {
  const { db, inserted, updated } = fakeDb([
    { id: "n1", user_id: "a", title: "viejo", message: "Ya no puedes invitar personas a su cuenta." },
  ]);
  const count = await notify(db, {
    type: "client_settings",
    organizationId: "org",
    recipients: ["a", "b", "actor"],
    actorUserId: "actor",
    data: { store: "Huerta", changes: [{ key: "marketing_publish", label: "programar y enviar campañas en Klaviyo", granted: true }] },
  });
  assert.equal(count, 2);
  assert.equal(updated.length, 1);
  assert.equal(updated[0]!.patch.title, "Huerta ha cambiado tus permisos");
  assert.equal(
    updated[0]!.patch.message,
    "Ya no puedes invitar personas a su cuenta.\nAhora puedes programar y enviar campañas en Klaviyo.",
  );
  const rows = inserted as Array<{ user_id: string; title: string; action_url: string }>;
  assert.deepEqual(rows.map((row) => row.user_id), ["b"]);
  assert.equal(rows[0]!.title, "Huerta te ha dado permiso para programar y enviar campañas en Klaviyo");
  assert.equal(rows[0]!.action_url, "/configuracion?organizationId=org&section=consultor&focus=perm-marketing_publish");
});
