/**
 * La metodologia global de E-NORA (documentos con visibility "global") se subio
 * entera como consultant_only, y los agentes automaticos solo leen
 * client_visible (AI-07): resultado, ningun agente veia la metodologia. La
 * regla de AI-07 protege las notas privadas de cada organizacion, no la
 * metodologia de la plataforma, asi que aqui se separan:
 *  - se pide tambien consultant_only al buscar,
 *  - y se descarta todo fragmento consultant_only que no sea global.
 */

export function audienceWithMethodology(audience: readonly string[]): string[] {
  return audience.includes("consultant_only") ? [...audience] : [...audience, "consultant_only"];
}

export function keepAllowedKnowledgeRows<T extends { audience?: unknown; visibility?: unknown }>(
  rows: readonly T[],
  audience: readonly string[],
): T[] {
  return rows.filter(
    (row) => audience.includes(String(row.audience)) || row.visibility === "global" && row.audience === "consultant_only",
  );
}
