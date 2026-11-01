import type { AiModelLabReport, AiModelLabResult } from "@e-nora/contracts";
import { calculateLabApiPrice } from "./lab-price";

/** Las pasadas están separadas horas: no asumir los hits de caché de la tanda CLI. */
export function a02ColdUsage(
  model: string,
  usage: AiModelLabResult["usage"],
): AiModelLabResult["usage"] {
  if (usage.cached === null || usage.cache_creation === null) return usage;
  return {
    ...usage,
    cached: 0,
    cache_creation: model.startsWith("claude-")
      ? usage.cache_creation + usage.cached
      : usage.cache_creation,
  };
}

export type MonitorOperation = {
  design_client_runs_per_day: number;
  saved_client_runs_per_day: number | null;
  cadences: Array<{ lookback_days: number; min_run_age_hours: number }>;
  panel_min_run_age_hours: number;
  ticks_per_day: number;
  org_daily_run_cap: number;
};

/** Demanda de planificación antes de cupos, fallos y esperas; no es telemetría. */
export function a02OperatingPlan(
  operation: MonitorOperation,
  stores: number,
  consultant: boolean,
) {
  if (!Number.isInteger(stores) || stores < 1)
    throw new Error("invalid_store_count");
  const disabled = operation.saved_client_runs_per_day === 0;
  const scale =
    operation.saved_client_runs_per_day &&
    operation.saved_client_runs_per_day > 0
      ? operation.design_client_runs_per_day /
        operation.saved_client_runs_per_day
      : 1;
  const rate = (days: number) => {
    const cadence = operation.cadences.find(
      (item) => item.lookback_days === days,
    );
    if (!cadence) throw new Error("missing_monitor_cadence");
    // shortcut: ticks regulares de dos pasadas/día; el cron real 06/15 puede retrasar el vencimiento.
    const hours = Math.max(
      24 / operation.ticks_per_day,
      Math.ceil(
        (cadence.min_run_age_hours * scale) / (24 / operation.ticks_per_day),
      ) *
        (24 / operation.ticks_per_day),
    );
    return disabled ? 0 : 24 / hours;
  };
  const monthlyViewRate = rate(30);
  const rows = [
    ...["overview", "shopify", "meta", "klaviyo"].map((view) => ({
      id: "client-30-" + view,
      audience: "Cliente",
      view,
      days: 30,
      scopes: stores + 1,
      runsPerDay: (stores + 1) * monthlyViewRate,
      note: "Una caché por tienda y otra del cliente completo",
    })),
    {
      id: "client-7",
      audience: "Cliente",
      view: "overview",
      days: 7,
      scopes: 1,
      runsPerDay: rate(7),
      note: "Solo cliente completo; precio proxy de overview de 30 días",
    },
    {
      id: "client-90",
      audience: "Cliente",
      view: "overview",
      days: 90,
      scopes: 1,
      runsPerDay: rate(90),
      note: "Solo cliente completo; precio proxy de overview de 30 días",
    },
    {
      id: "consultant",
      audience: "Consultor",
      view: "panel",
      days: 30,
      scopes: stores > 1 ? stores + 1 : 1,
      runsPerDay:
        disabled || !consultant
          ? 0
          : Math.min(
              operation.ticks_per_day,
              24 / operation.panel_min_run_age_hours,
            ) * (stores > 1 ? stores + 1 : 1),
      note: "Cliente completo; también cada tienda si hay más de una",
    },
  ];
  const client = rows
    .filter((row) => row.audience === "Cliente")
    .reduce((sum, row) => sum + row.runsPerDay, 0);
  const panel = rows
    .filter((row) => row.audience === "Consultor")
    .reduce((sum, row) => sum + row.runsPerDay, 0);
  return { rows, client, panel, total: client + panel };
}

export function a02OperatingCosts(
  report: AiModelLabReport,
  plan: ReturnType<typeof a02OperatingPlan>,
  clients: number,
  extraAttemptPct: number,
) {
  if (
    !Number.isInteger(clients) ||
    clients < 1 ||
    !Number.isFinite(extraAttemptPct) ||
    extraAttemptPct < 0
  )
    throw new Error("invalid_cost_scenario");
  return report.models.map((model) => {
    const prices = new Map(
      report.cases
        .filter((item) => item.monitor_benchmark)
        .map((item) => {
          const result = report.results.find(
            (row) =>
              row.case_id === item.id &&
              row.model_id === model.id &&
              row.status === "completed",
          );
          return [
            item.monitor_benchmark!.dashboard_scope,
            result
              ? calculateLabApiPrice(
                  model.id,
                  a02ColdUsage(model.id, result.usage),
                )
              : null,
          ] as const;
        }),
    );
    let clientLow = 0,
      clientHigh = 0,
      panelLow = 0,
      panelHigh = 0;
    for (const row of plan.rows) {
      if (row.runsPerDay === 0) continue;
      const price = prices.get(
        row.view as "overview" | "shopify" | "meta" | "klaviyo" | "panel",
      );
      if (!price)
        return { id: model.id, label: model.label, available: false as const };
      if (row.audience === "Cliente") {
        clientLow += price.low * row.runsPerDay;
        clientHigh += price.high * row.runsPerDay;
      } else {
        panelLow += price.low * row.runsPerDay;
        panelHigh += price.high * row.runsPerDay;
      }
    }
    const multiplier = clients * 30 * (1 + extraAttemptPct / 100);
    return {
      id: model.id,
      label: model.label,
      available: true as const,
      clientLow: clientLow * multiplier,
      clientHigh: clientHigh * multiplier,
      panelLow: panelLow * multiplier,
      panelHigh: panelHigh * multiplier,
      dailyLow: (clientLow + panelLow) * clients * (1 + extraAttemptPct / 100),
      dailyHigh:
        (clientHigh + panelHigh) * clients * (1 + extraAttemptPct / 100),
      monthlyLow: (clientLow + panelLow) * multiplier,
      monthlyHigh: (clientHigh + panelHigh) * multiplier,
    };
  });
}
