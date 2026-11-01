"use client";


import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Banner, Button, Field, Textarea, Card, CardContent } from "@/components/ui";
import {
  COST_IMPORT_OUTCOME_LABELS,
  COST_PASTE_PROBLEM_LABELS,
  parseCostPaste,
} from "./product-cost-paste";

type ImportResultRow = {
  line: number;
  sku: string;
  unit_cost: number | null;
  outcome: string;
};

type ImportResponse = {
  dry_run: boolean;
  applied: number;
  summary: {
    total: number;
    applicable: number;
    sku_not_found: number;
    sku_ambiguous: number;
    invalid_cost: number;
    missing_sku: number;
    duplicate_in_input: number;
  };
  results: ImportResultRow[];
};

const EYEBROW = "text-[11px] font-medium uppercase tracking-wide text-muted";

/**
 * Carga masiva de costes por SKU.
 *
 * Nunca escribe a la primera: el boton pide la previsualizacion (`dryRun`) y
 * solo despues aparece el de aplicar, con el numero exacto de lineas que se van
 * a escribir. El COGS manda en el beneficio de todo el panel, asi que pegar 300
 * lineas y que se apliquen sin verlas seria la forma mas rapida de meter un
 * margen falso y no enterarse.
 */
export function ProductCostImport({
  organizationId,
  onImported,
}: {
  organizationId: string;
  onImported: () => void;
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState<number | null>(null);

  // Lo que se puede saber sin llamar a nadie: formato del pegado. Lo que solo
  // sabe el servidor (si el SKU existe) llega con la previsualizacion.
  const parsed = useMemo(() => parseCostPaste(text), [text]);
  const localProblems = parsed.filter((row) => row.problem !== null);
  const sendable = parsed.filter((row) => row.problem === null);

  async function callImport(dryRun: boolean) {
    setError(null);
    setIsBusy(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/shopify/product-costs/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dryRun,
            rows: sendable.map((row) => ({
              sku: row.sku,
              unitCost: row.unitCost,
            })),
          }),
        },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      const body = (await response.json()) as ImportResponse;

      if (dryRun) {
        setPreview(body);
        setAppliedCount(null);
      } else {
        setAppliedCount(body.applied);
        setPreview(null);
        setText("");
        onImported();
      }
    } catch {
      setError(
        "No se pudo contactar con el servidor. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  const problemRows = (preview?.results ?? []).filter(
    (row) => row.outcome !== "ok",
  );

  return (
    <div className="mt-6 space-y-3 border-t border-separator pt-4">
      <p className={EYEBROW}>Cargar muchos costes de una vez</p>
      <Field label="Pega dos columnas: SKU y coste">
        <Textarea
          className="mt-2 font-mono text-xs"
          rows={6}
          placeholder={"ACEITE-500\t3,40\nACEITE-1L\t6,10"}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setPreview(null);
            setAppliedCount(null);
          }}
        />
      </Field>
      <p className="text-xs text-muted">
        Copia las dos columnas desde Excel o Google Sheets y pégalas aquí.
        También vale un CSV con punto y coma.
      </p>

      {localProblems.length > 0 ? (
        <Banner tone="warn" className="text-sm">
          <p className="font-medium">
            {localProblems.length}{" "}
            {localProblems.length === 1 ? "línea" : "líneas"} sin formato válido.
            No se enviarán.
          </p>
          <ul className="mt-1 space-y-1 text-xs text-muted">
            {localProblems.slice(0, 5).map((row) => (
              <li key={row.line}>
                Línea {row.line}: {COST_PASTE_PROBLEM_LABELS[row.problem!]}
              </li>
            ))}
            {localProblems.length > 5 ? (
              <li>y {localProblems.length - 5} más.</li>
            ) : null}
          </ul>
        </Banner>
      ) : null}

      {error ? (
        <Banner tone="danger" className="text-sm">
          {error}
        </Banner>
      ) : null}

      {appliedCount !== null ? (
        <Banner tone="success" className="text-sm">
          {appliedCount === 0
            ? "No se escribió ningún coste."
            : `${appliedCount} ${appliedCount === 1 ? "coste guardado" : "costes guardados"}.`}
        </Banner>
      ) : null}

      {preview ? (
        <Card size="sm"><CardContent>
          <p className="text-sm font-medium">
            Se aplicarán {preview.summary.applicable} de {preview.summary.total}{" "}
            líneas.
          </p>
          {problemRows.length > 0 ? (
            <>
              <p className="mt-2 text-xs text-muted">
                Las demás se quedan como están:
              </p>
              <ul className="mt-1 space-y-1 text-xs text-muted">
                {problemRows.slice(0, 8).map((row) => (
                  <li key={row.line}>
                    <span className="font-mono">{row.sku || "(sin SKU)"}</span>{" "}
                    <Badge tone="neutral">
                      {COST_IMPORT_OUTCOME_LABELS[row.outcome] ?? row.outcome}
                    </Badge>
                  </li>
                ))}
                {problemRows.length > 8 ? (
                  <li>y {problemRows.length - 8} más.</li>
                ) : null}
              </ul>
            </>
          ) : null}
        </CardContent></Card>
      ) : null}

      <div role="group" aria-label="Acciones de importacion de costes" className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={preview ? "ghost" : "default"}
          disabled={isBusy || sendable.length === 0}
          onClick={() => void callImport(true)}
        >
          {isBusy && !preview ? "Comprobando..." : "Previsualizar"}
        </Button>
        {preview && preview.summary.applicable > 0 ? (
          <Button
            type="button"
            disabled={isBusy}
            onClick={() => void callImport(false)}
          >
            {isBusy
              ? "Guardando..."
              : `Aplicar ${preview.summary.applicable} costes`}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
