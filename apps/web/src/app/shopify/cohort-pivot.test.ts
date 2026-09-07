import assert from "node:assert/strict";
import test from "node:test";
import { pivotCohorts, retentionRate } from "./cohort-pivot";

const junio = {
  cohort_month: "2026-06-01",
  cohort_customers: 167,
};
const mayo = {
  cohort_month: "2026-05-01",
  cohort_customers: 49,
};

test("una fila por cohorte, no una por mes", () => {
  const { rows } = pivotCohorts(
    [
      { ...junio, month_offset: 0, customers: 167 },
      { ...junio, month_offset: 1, customers: 3 },
      { ...mayo, month_offset: 0, customers: 49 },
    ],
    6,
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.month, "2026-06-01");
  assert.equal(rows[0]?.byOffset.get(1), 3);
});

test("la cohorte mas reciente va primero", () => {
  const { rows } = pivotCohorts(
    [
      { ...mayo, month_offset: 0, customers: 49 },
      { ...junio, month_offset: 0, customers: 167 },
    ],
    6,
  );

  assert.deepEqual(
    rows.map((row) => row.month),
    ["2026-06-01", "2026-05-01"],
  );
});

test("el mes 0 no genera columna: es la propia cohorte comprando", () => {
  const { columns } = pivotCohorts(
    [{ ...junio, month_offset: 0, customers: 167 }],
    6,
  );

  assert.equal(columns, 0);
});

test("las columnas llegan hasta el mes mas lejano con retorno", () => {
  const { columns } = pivotCohorts(
    [
      { ...junio, month_offset: 0, customers: 167 },
      { ...junio, month_offset: 3, customers: 1 },
    ],
    6,
  );

  assert.equal(columns, 3);
});

test("los meses por encima del tope se descartan", () => {
  const { columns, rows } = pivotCohorts(
    [
      { ...junio, month_offset: 0, customers: 167 },
      { ...junio, month_offset: 9, customers: 2 },
    ],
    6,
  );

  assert.equal(columns, 0);
  assert.equal(rows[0]?.byOffset.has(9), false);
});

test("la retencion se divide entre el tamaño de la cohorte", () => {
  const { rows } = pivotCohorts(
    [
      { ...mayo, month_offset: 0, customers: 49 },
      { ...mayo, month_offset: 1, customers: 7 },
    ],
    6,
  );

  assert.equal(retentionRate(rows[0]!, 1), 7 / 49);
});

test("un mes sin retorno no es cero, es sin dato", () => {
  const { rows } = pivotCohorts(
    [{ ...mayo, month_offset: 0, customers: 49 }],
    6,
  );

  assert.equal(retentionRate(rows[0]!, 2), null);
});

test("una cohorte vacia no divide entre cero", () => {
  const { rows } = pivotCohorts(
    [
      {
        cohort_month: "2026-04-01",
        cohort_customers: 0,
        month_offset: 1,
        customers: 3,
      },
    ],
    6,
  );

  assert.equal(retentionRate(rows[0]!, 1), null);
});
