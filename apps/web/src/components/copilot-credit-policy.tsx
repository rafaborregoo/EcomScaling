"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  DataTable,
  ErrorBlock,
} from "@/components/ui";
import { useCachedQuery } from "@/lib/use-cached-query";

const number = (v: number) => v.toLocaleString("es-ES");
type Model = {
  id: string;
  label: string;
  input_credits_per_1k: number | null;
  output_credits_per_1k: number | null;
  example_credits: number | null;
  example_cost_usd: number | null;
};
type Policy = {
  monthly_credits: number;
  monthly_budget_usd: number;
  credits_per_usd: number;
  models: Model[];
};

/** Comparación comercial de A09 con las mismas tarifas que usa el runtime. */
export function CopilotCreditPolicy() {
  const { data, error, isLoading, reload } = useCachedQuery<{
    copilot_credit_policy: Policy;
  }>("/v1/admin/ai-cost-model");
  const policy = data?.copilot_credit_policy;
  const credits = (v: number | null) => (v === null ? "Sin tarifa" : number(v));
  return (
    <Card>
      <CardHeader>
        <CardTitle>A09 · Créditos del Copiloto</CardTitle>
        <CardDescription>
          El usuario elige el modelo. Los modelos más caros consumen el saldo
          más rápido.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <ErrorBlock
            title="No se pudo cargar la política de créditos."
            onRetry={reload}
          />
        ) : null}
        {isLoading ? (
          <p className="text-sm text-muted">Cargando equivalencias…</p>
        ) : null}
        {policy ? (
          <>
            <p className="text-sm">
              <strong>{number(policy.monthly_credits)} créditos/mes</strong> por
              defecto = {policy.monthly_budget_usd} USD de presupuesto API. Cada
              suscripción conserva su cuota configurada.
            </p>
            <p className="text-sm text-muted">
              Créditos de cada ejecución = coste API registrado ×{" "}
              {number(policy.credits_per_usd)}, redondeado hacia arriba. Incluye
              todas las llamadas del turno, entrada, salida, lectura y escritura
              de caché y herramientas facturadas por el proveedor. El consultor
              consume el saldo de su consultora; el cliente, el de su
              organización.
            </p>
            <DataTable<Model>
              rows={policy.models}
              ariaLabel="Consumo de créditos por modelo del Copiloto"
              columns={[
                { key: "label", label: "Modelo", render: (r) => r.label },
                {
                  key: "input",
                  label: "Créditos / 1.000 entrada",
                  render: (r) => credits(r.input_credits_per_1k),
                },
                {
                  key: "output",
                  label: "Créditos / 1.000 salida",
                  render: (r) => credits(r.output_credits_per_1k),
                },
                {
                  key: "example",
                  label: "Créditos del ejemplo",
                  render: (r) => credits(r.example_credits),
                },
                {
                  key: "cost",
                  label: "Coste API del ejemplo",
                  render: (r) =>
                    r.example_cost_usd === null
                      ? "Sin tarifa"
                      : `${r.example_cost_usd.toLocaleString("es-ES", { maximumFractionDigits: 4 })} USD`,
                },
              ]}
            />
            <p className="text-xs text-muted">
              Ejemplo idéntico: 10.000 tokens de entrada y 1.000 de salida, sin
              caché y con contexto corto. No es una media de preguntas ni una
              comparación de calidad. Los costes de cada ejecución se conservan;
              actualizar una tarifa no recalcula consumos anteriores.
            </p>
            <p className="text-xs text-muted">
              Al agotar el saldo se mantiene el modo reducido existente. Su
              gasto adicional sigue apareciendo en el consumo; este presupuesto
              no es un tope absoluto de factura.
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
