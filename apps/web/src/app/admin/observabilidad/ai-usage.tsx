"use client";

import { useState } from "react";
import { useCachedQuery } from "@/lib/use-cached-query";
import { AsyncState, Badge, Button, Card, ErrorBlock, Table, type TableColumnDef } from "@/components/ui";

type Range = "all" | "90d" | "30d" | "7d";

type UsageRow = {
  agent_code: string;
  agent_name: string;
  run_count: number;
  succeeded_count: number;
  failed_count: number;
  rejected_count: number;
  running_count: number;
  zero_token_runs: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  total_cost_usd: number;
  runs_by_trigger: Record<string, number>;
  runs_by_model: Record<string, number>;
  first_run_at: string | null;
  last_run_at: string | null;
};

type UsagePayload = {
  range: Range;
  generated_at: string;
  agents: UsageRow[];
  totals: Omit<UsageRow, "agent_code" | "agent_name" | "runs_by_trigger" | "runs_by_model" | "first_run_at" | "last_run_at">;
  copilot: UsageRow | null;
};

const RANGES: Array<[Range, string]> = [["all", "Todo"], ["90d", "90 días"], ["30d", "30 días"], ["7d", "7 días"]];
const TRIGGER_ES: Record<string, string> = { manual: "manual", cron: "programado", chat: "chat", call: "llamada", alert: "alerta", webhook: "webhook" };

const n = (value: number) => value.toLocaleString("es-ES");
const usd = (value: number) => `$${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (value: string | null) => (value ? new Date(value).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const counts = (map: Record<string, number>, label: (key: string) => string = (key) => key) =>
  Object.entries(map).sort((a, b) => b[1] - a[1]).map(([key, count]) => `${label(key)} ${count}`).join(" · ") || "—";

/** Una cifra del resumen. */
function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function AiUsagePanel() {
  const [range, setRange] = useState<Range>("all");
  const { data, error, isLoading } = useCachedQuery<UsagePayload>(`/v1/admin/ai-usage?range=${range}`);
  const title = "Consumo de IA por agente";
  const kicker = "Control de coste";

  if (isLoading && !data) {
    return (
      <Card kicker={kicker} title={title}>
        <AsyncState status="loading" loadingLabel="Contando ejecuciones y tokens..." />
      </Card>
    );
  }
  if (error || !data) {
    return (
      <Card kicker={kicker} title={title}>
        <ErrorBlock>{error ?? "Sin datos."}</ErrorBlock>
      </Card>
    );
  }

  const rows = data.agents.map((row) => ({ ...row, id: row.agent_code }));
  const t = data.totals;
  const columns: TableColumnDef<(typeof rows)[number]>[] = [
    {
      key: "agent_name",
      label: "Agente",
      render: (row) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.agent_name}</span>
          <span className="font-mono text-xs text-muted">{row.agent_code}</span>
        </span>
      ),
    },
    { key: "run_count", label: "Ejecuciones", render: (row) => n(row.run_count) },
    {
      key: "succeeded_count",
      label: "Resultado",
      render: (row) => (
        <span className="text-xs tabular-nums">
          {n(row.succeeded_count)} ok · {n(row.failed_count + row.rejected_count)} fallidas
          {row.running_count ? ` · ${row.running_count} en curso` : ""}
          {row.zero_token_runs ? <Badge tone="warn">{n(row.zero_token_runs)} sin tokens</Badge> : null}
        </span>
      ),
    },
    { key: "input_tokens", label: "Tokens entrada", render: (row) => n(row.input_tokens) },
    { key: "output_tokens", label: "Tokens salida", render: (row) => n(row.output_tokens) },
    { key: "total", label: "Entrada + salida", render: (row) => <strong>{n(row.input_tokens + row.output_tokens)}</strong> },
    { key: "cache_read_tokens", label: "Caché leída", render: (row) => n(row.cache_read_tokens) },
    { key: "total_cost_usd", label: "Coste", render: (row) => usd(row.total_cost_usd) },
    { key: "runs_by_trigger", label: "Cómo se lanza", render: (row) => <span className="text-xs">{counts(row.runs_by_trigger, (key) => TRIGGER_ES[key] ?? key)}</span> },
    { key: "runs_by_model", label: "Modelos", render: (row) => <span className="text-xs">{counts(row.runs_by_model, (key) => key.replace(/^claude-/, ""))}</span> },
    { key: "last_run_at", label: "Última", render: (row) => day(row.last_run_at) },
  ];

  return (
    <Card
      kicker={kicker}
      title={title}
      description="Veces que corre cada agente y tokens de entrada y salida de todas sus ejecuciones. No incluye el copiloto, que tiene su saldo propio."
      actions={
        <span className="flex gap-1" role="group" aria-label="Periodo">
          {RANGES.map(([key, label]) => (
            <Button key={key} size="sm" variant={range === key ? "primary" : "secondary"} onClick={() => setRange(key)}>
              {label}
            </Button>
          ))}
        </span>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Figure label="Ejecuciones" value={n(t.run_count)} hint={`${n(t.failed_count + t.rejected_count)} fallidas`} />
        <Figure label="Tokens de entrada" value={n(t.input_tokens)} hint={`${n(t.cache_read_tokens)} leídos de caché`} />
        <Figure label="Tokens de salida" value={n(t.output_tokens)} />
        <Figure label="Entrada + salida" value={n(t.input_tokens + t.output_tokens)} />
        <Figure label="Coste estimado" value={usd(t.total_cost_usd)} />
      </div>
      {rows.length ? (
        <Table ariaLabel="Consumo de IA por agente" columns={columns} rows={rows} />
      ) : (
        <AsyncState status="empty" emptyTitle="Sin ejecuciones en este periodo" emptyHint="Prueba con «Todo»." />
      )}
      {data.copilot ? (
        <p className="mt-3 text-xs text-muted">
          Aparte, el copiloto (saldo propio) ha corrido {n(data.copilot.run_count)} veces con {n(data.copilot.input_tokens + data.copilot.output_tokens)} tokens
          de entrada y salida ({usd(data.copilot.total_cost_usd)}).
        </p>
      ) : null}
    </Card>
  );
}
