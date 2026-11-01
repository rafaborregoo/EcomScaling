"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  AsyncState,
  Badge,
  Button,
  ErrorBlock,
  DataTable,
  toast,
  type DataTableColumn,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardKicker,
  CardTitle,
} from "@/components/ui";

type ModelPrice = {
  model: string;
  provider: string;
  input_per_mtok: number;
  output_per_mtok: number;
  cache_read_per_mtok: number | null;
  source: "litellm" | "code_default" | "manual";
  checked_at: string;
  updated_at: string;
};

type ModelPricesPayload = {
  prices: ModelPrice[];
  in_use: { openai: string | null; anthropic: string | null };
  unpriced_runs: number;
};

type SyncSummary = {
  changed: { model: string; from: string | null; to: string }[];
  missing: string[];
  repriced_runs: number;
};

const SOURCE_ES: Record<ModelPrice["source"], string> = {
  litellm: "LiteLLM",
  code_default: "Respaldo del código",
  manual: "Manual",
};

const usd = (value: number | null) =>
  value == null ? "—" : `$${Number(value).toLocaleString("es-ES", { maximumFractionDigits: 4 })}`;

const day = (value: string) =>
  new Date(value).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });

const alias = (model: string | null) => model?.replace(/-(\d{8}|\d{4}-\d{2}-\d{2})$/, "") ?? null;

export function ModelPricesPanel() {
  const { data, error, isLoading, reload } = useCachedQuery<ModelPricesPayload>(
    "/v1/admin/ai-model-prices",
  );
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true);
    try {
      const response = await apiFetch("/v1/admin/ai-model-prices/sync", { method: "POST" });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const summary = (await response.json()) as SyncSummary;
      toast.success(
        summary.changed.length
          ? `${summary.changed.length} tarifa(s) cambiada(s)`
          : "Tarifa al día: no ha cambiado nada",
        {
          description: [
            ...summary.changed.map((c) => `${c.model}: ${c.from ?? "nuevo"} → ${c.to}`),
            summary.repriced_runs ? `${summary.repriced_runs} ejecuciones con coste recalculado` : "",
            summary.missing.length ? `Sin tarifa: ${summary.missing.join(", ")}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
        },
      );
      reload();
    } catch {
      toast.danger("No se pudo actualizar la tarifa por un error de red.");
    } finally {
      setSyncing(false);
    }
  }

  const title = "Tarifa de modelos";
  const kicker = "Control de coste";
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardKicker>{kicker}</CardKicker>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncState status="loading" loadingLabel="Cargando tarifa..." />
        </CardContent>
      </Card>
    );
  }
  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardKicker>{kicker}</CardKicker>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBlock>{error ?? "Sin datos."}</ErrorBlock>
        </CardContent>
      </Card>
    );
  }

  const inUse = new Set([alias(data.in_use.openai), alias(data.in_use.anthropic)]);
  const rows = data.prices.map((p) => ({ ...p, id: p.model }));
  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    {
      key: "model",
      label: "Modelo",
      render: (row) => (
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs">{row.model}</span>
          {inUse.has(row.model) ? <Badge tone="success">En uso</Badge> : null}
        </span>
      ),
    },
    { key: "input_per_mtok", label: "Entrada / MTok", render: (row) => usd(row.input_per_mtok) },
    { key: "output_per_mtok", label: "Salida / MTok", render: (row) => usd(row.output_per_mtok) },
    { key: "cache_read_per_mtok", label: "Caché / MTok", render: (row) => usd(row.cache_read_per_mtok) },
    {
      key: "source",
      label: "Fuente",
      render: (row) => (
        <Badge tone={row.source === "litellm" ? "neutral" : "warn"}>{SOURCE_ES[row.source]}</Badge>
      ),
    },
    { key: "updated_at", label: "Último cambio", render: (row) => day(row.updated_at) },
  ];

  const lastCheck = data.prices.reduce<string | null>(
    (max, p) => (max == null || p.checked_at > max ? p.checked_at : max),
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardKicker>{kicker}</CardKicker>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{`USD por millón de tokens. Se actualiza cada noche desde LiteLLM${lastCheck ? `; última comprobación ${day(lastCheck)}` : ""}.`}</CardDescription>
        <CardAction><Button variant="secondary" size="sm" disabled={syncing} onClick={sync}>
          {syncing ? "Actualizando…" : "Actualizar ahora"}
        </Button></CardAction>
      </CardHeader>
      <CardContent>
        {data.unpriced_runs > 0 ? (
          <ErrorBlock>
            {data.unpriced_runs} ejecuciones sin coste: su modelo no tiene tarifa todavía.
          </ErrorBlock>
        ) : null}
        {rows.length ? (
          <DataTable ariaLabel="Tarifa de modelos" columns={columns} rows={rows} />
        ) : (
          <AsyncState status="empty" emptyTitle="Todavía no hay tarifa importada" emptyHint="Pulsa «Actualizar ahora»." />
        )}
      </CardContent>
    </Card>
  );
}
