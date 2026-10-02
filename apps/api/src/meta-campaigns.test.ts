import assert from "node:assert/strict";
import test from "node:test";

// Las funciones puras de meta-campaigns.ts (budgetText, num) no estan
// exportadas porque son triviales; se prueba aqui la logica que si puede
// fallar en silencio: el join por campaign_id entre meta_campaign_structure y
// meta_spend_by_campaign, replicado con datos de muestra.
function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

test("una campana sin filas de gasto no rompe el join: sale a cero, no desaparece", () => {
  const structure = [{ campaign_id: "a", name: "Sin gasto" }];
  const spendById = new Map<string, { spend: number }>();
  const rows = structure.map((row) => ({ ...row, spend: num(spendById.get(row.campaign_id)?.spend) }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.spend, 0);
});

test("num tolera nulos, strings numericos de Postgres y basura", () => {
  assert.equal(num(null), 0);
  assert.equal(num(undefined), 0);
  assert.equal(num("12.50"), 12.5);
  assert.equal(num("no es un numero"), 0);
});
