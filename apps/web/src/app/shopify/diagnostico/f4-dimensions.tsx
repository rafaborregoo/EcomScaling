"use client";
import { useCachedQueries } from "@/lib/use-cached-query";
import { Badge, ErrorBlock, LoadingBlock, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
const dimensions = [
  ["P07", "Riesgo y reversibilidad", "/v1/consultant/risk", "risk_assessment"],
  [
    "P08",
    "Allocation económica",
    "/v1/consultant/allocation",
    "allocation_assessment",
  ],
  [
    "P09",
    "Strategic fit",
    "/v1/consultant/strategic-fit",
    "strategic_assessment",
  ],
  ["P10", "Ranking", "/v1/consultant/ranking", "ranking_status"],
  ["P11", "Portfolio", "/v1/consultant/portfolio", "portfolio_status"],
  [
    "P12",
    "Salida decisional",
    "/v1/consultant/decision-outputs",
    "decision_status",
  ],
] as const;
type Row = Record<string, unknown>;
export function F4DimensionsPanel() {
  const keys = dimensions.map(([, , url]) => url);
  const { data: batches, error } = useCachedQueries<{ assessments: Row[] }>(
    keys,
  );
  const values = batches
    ? Object.fromEntries(
        dimensions.map(([key], index) => [
          key,
          batches[index]?.assessments ?? [],
        ]),
      )
    : {};
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (Object.keys(values).length < dimensions.length)
    return <LoadingBlock label="Cargando dimensiones de decisión F4..." />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dimensiones finales</CardTitle>
        <CardDescription>Riesgo, allocation, fit, ranking, portfolio y salida decisional permanecen separados y auditables.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {dimensions.map(([key, title, , field]) => {
            const rows = values[key] ?? [];
            const item = rows[0];
            const value = item?.[field];
            return (
              <Card key={key} role="article"><CardContent>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted text-xs">{key}</span>
                  <Badge
                    tone={
                      value === "UNKNOWN" ||
                      value === "ABSTAIN" ||
                      value === "VALIDATION_REQUIRED"
                        ? "warn"
                        : "neutral"
                    }
                  >
                    {String(value ?? "sin datos")}
                  </Badge>
                </div>
                <p className="mt-2 text-sm font-medium">{title}</p>
                <p className="text-muted mt-1 text-xs">
                  {rows.length
                    ? `${rows.length} snapshot(s)`
                    : "Todavía no hay snapshots"}
                  . La salida no sustituye revisión humana.
                </p>
              </CardContent></Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
