/**
 * La funcion SQL devuelve una fila por (cohorte, mes), que es como se agrupa
 * en la base pero no como se lee: la tabla necesita una fila por cohorte y una
 * columna por mes transcurrido.
 *
 * `cohortCustomers` viene repetido en cada fila desde SQL para no tener que
 * volver a preguntarlo, y es el denominador de la retencion. Si llegara a cero
 * no se divide: una cohorte vacia no tiene retencion, tiene nada.
 */
export type CohortInput = {
  cohort_month: string;
  cohort_customers: number;
  month_offset: number;
  customers: number;
};

export type CohortRow = {
  id: string;
  month: string;
  cohortCustomers: number;
  byOffset: Map<number, number>;
};

export function pivotCohorts(rows: CohortInput[], maxOffset: number) {
  const byMonth = new Map<string, CohortRow>();
  let lastOffset = 0;

  for (const row of rows) {
    // El mes 0 es la propia cohorte comprando por primera vez: entra en la
    // fila para fijar el tamaño, pero no genera columna de retencion.
    if (row.month_offset > maxOffset) continue;

    const existing = byMonth.get(row.cohort_month) ?? {
      id: row.cohort_month,
      month: row.cohort_month,
      cohortCustomers: row.cohort_customers,
      byOffset: new Map<number, number>(),
    };
    existing.byOffset.set(row.month_offset, row.customers);
    byMonth.set(row.cohort_month, existing);

    if (row.month_offset > 0) {
      lastOffset = Math.max(lastOffset, row.month_offset);
    }
  }

  return {
    // Mas reciente arriba: la cohorte que todavia se puede rescatar.
    rows: [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month)),
    columns: lastOffset,
  };
}

export function retentionRate(row: CohortRow, offset: number): number | null {
  const customers = row.byOffset.get(offset);
  if (!customers || row.cohortCustomers <= 0) return null;
  return customers / row.cohortCustomers;
}
