/**
 * Lectura del pegado de costes: dos columnas, SKU y coste unitario.
 *
 * El camino real es copiar dos columnas de Excel o Google Sheets y pegarlas,
 * que llega separado por TABULADORES y, en español, con la coma como separador
 * decimal ("3,40"). Tambien se acepta CSV con `;` y con `,`.
 *
 * La ambigüedad se resuelve por orden y sin adivinar: primero tabulador,
 * despues `;`, y solo si no hay ninguno de los dos, `,`. Con la coma de
 * separador, una linea como "ACEITE,3,40" no se puede leer sin inventar (¿coste
 * 3 y sobra "40", o coste 3,40?), asi que se rechaza y se dice por que. Con
 * tabulador o `;` no hay duda y "3,40" se lee como 3.40.
 *
 * Nada de esto escribe: el resultado se previsualiza y es la API la que decide
 * que lineas se aplican.
 */

export type ParsedCostLine = {
  line: number;
  raw: string;
  sku: string;
  unitCost: number | null;
  problem: "sin_separador" | "coma_ambigua" | "coste_no_numerico" | null;
};

function detectDelimiter(text: string): "\t" | ";" | "," | null {
  if (text.includes("\t")) return "\t";
  if (text.includes(";")) return ";";
  if (text.includes(",")) return ",";
  return null;
}

function parseAmount(raw: string, allowDecimalComma: boolean): number | null {
  const cleaned = raw.trim().replace(/[€\s]/g, "");

  if (cleaned.length === 0) return null;

  const normalized = allowDecimalComma ? cleaned.replace(",", ".") : cleaned;

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function looksLikeHeader(sku: string, costField: string): boolean {
  const normalized = costField.trim().toLowerCase();
  return (
    /^[a-záéíóúñ ]+$/i.test(normalized) &&
    ["coste", "cost", "precio", "coste unitario", "unit cost"].some((word) =>
      normalized.includes(word),
    ) &&
    sku.trim().length > 0
  );
}

export function parseCostPaste(text: string): ParsedCostLine[] {
  const lines = text.split(/\r?\n/);
  const delimiter = detectDelimiter(text);
  const parsed: ParsedCostLine[] = [];

  lines.forEach((raw, index) => {
    if (raw.trim().length === 0) return;

    const entry: ParsedCostLine = {
      line: index + 1,
      raw,
      sku: "",
      unitCost: null,
      problem: null,
    };

    if (!delimiter) {
      parsed.push({ ...entry, problem: "sin_separador" });
      return;
    }

    const fields = raw.split(delimiter).map((field) => field.trim());

    // Cabecera pegada sin querer ("SKU  Coste"): se ignora, no se marca como
    // error, porque no lo es.
    if (index === 0 && fields.length >= 2 && looksLikeHeader(fields[0]!, fields[1]!)) {
      return;
    }

    if (delimiter === "," && fields.length !== 2) {
      parsed.push({ ...entry, sku: fields[0] ?? "", problem: "coma_ambigua" });
      return;
    }

    const sku = fields[0] ?? "";
    const costField = fields[1] ?? "";
    const unitCost = parseAmount(costField, delimiter !== ",");

    parsed.push({
      ...entry,
      sku,
      unitCost,
      problem: unitCost === null ? "coste_no_numerico" : null,
    });
  });

  return parsed;
}

export const COST_PASTE_PROBLEM_LABELS: Record<
  NonNullable<ParsedCostLine["problem"]>,
  string
> = {
  sin_separador: "No se ve separador entre SKU y coste (usa tabulador, ; o ,)",
  coma_ambigua:
    "Con comas no se distingue el separador del decimal: usa tabulador o punto y coma",
  coste_no_numerico: "El coste no es un número",
};

export const COST_IMPORT_OUTCOME_LABELS: Record<string, string> = {
  ok: "Se aplica",
  sku_not_found: "SKU no existe en el inventario",
  sku_ambiguous: "SKU repetido en varias tiendas: no se toca",
  invalid_cost: "Coste inválido",
  missing_sku: "Sin SKU",
  duplicate_in_input: "SKU repetido en el pegado",
};
