"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch, apiUrl } from "@/lib/bootstrap";

type MetricValue = number | null;
type HealthPayload = {
  generated_at: string;
  window_hours: number;
  host: {
    status: "ok" | "unknown";
    checked_at: string;
    reason?: string;
    cpu_percent: MetricValue;
    cpu_cores: number | null;
    load_1m: MetricValue;
    memory_total_bytes: MetricValue;
    memory_available_bytes: MetricValue;
    memory_used_percent: MetricValue;
    swap_total_bytes: MetricValue;
    swap_used_bytes: MetricValue;
    disk_total_bytes: MetricValue;
    disk_available_bytes: MetricValue;
    disk_used_percent: MetricValue;
    boot_time: string | null;
    uptime_seconds: MetricValue;
    boot_changes_observed_since_api_start: number;
  };
  containers: {
    status: "ok" | "unknown";
    checked_at: string;
    reason?: string;
    containers: Array<{
      id: string;
      name: string;
      service: string;
      image: string | null;
      state: string;
      status: string;
      health: string | null;
      restart_count: number | null;
      cpu_percent: number | null;
      memory_working_set_bytes: number | null;
      memory_limit_bytes: number | null;
      memory_used_percent: number | null;
      oom_events: number | null;
    }>;
  };
  database_recovery: {
    checked_at: string;
    database: { status: "ok" | "error" | "unknown"; latency_ms: number | null };
    connections: { active: number | null; max: number | null; status: "available" | "not_configured" | "error" };
    backups: {
      status: "available" | "error" | "not_configured";
      latest_backup_at: string | null;
      pitr_enabled: boolean | null;
      latest_physical_backup_at: string | null;
      reason?: string;
    };
    last_restore_verified_at: string | null;
  };
  external_probe: {
    status: "ok" | "waiting" | "error" | "not_configured";
    latest: {
      ok: boolean;
      checked_at: string;
      latency_ms: number | null;
      dns_ok: boolean;
      tls_days_remaining: number | null;
      http_status: number | null;
    } | null;
    history: Array<{ checked_at: string; ok: boolean; latency_ms: number | null }>;
  };
  application: {
    slo: {
      status: string;
      requestCount: number;
      errorCount: number;
      errorRate: number;
      timeouts: number;
      p95LatencyMs: number | null;
      inFlightRequests: number;
      peakConcurrentRequests: number;
    };
    recent_slo: {
      status: string;
      requestCount: number;
      errorCount: number;
      errorRate: number;
      timeouts: number;
      p95LatencyMs: number | null;
      inFlightRequests: number;
      peakConcurrentRequests: number;
      windowMs: number;
      latency_by_route: Array<{
        route: string;
        requestCount: number;
        p50LatencyMs: number | null;
        p95LatencyMs: number | null;
        p99LatencyMs: number | null;
        errorCount: number;
      }>;
      requests_per_minute: Array<{ at: string; count: number }>;
    };
    readiness: { url: string };
    worker: {
      status: string;
      heartbeat_at: string | null;
      heartbeat_age_seconds: number | null;
      active_users_60s: number | null;
      active_users_hourly_peaks?: Array<{ bucket: string; peak: number }>;
      active_users_daily_peaks?: Array<{ bucket: string; peak: number }>;
      queues: Array<{
        name: string;
        waiting?: number;
        prioritized?: number;
        active?: number;
        failed?: number;
        delayed?: number;
        "waiting-children"?: number;
        oldest_pending_age_seconds?: number;
        global_concurrency?: number | null;
        global_rate_limit?: { max: number; duration: number } | null;
      }>;
      reason?: string | null;
    };
  };
  customers: {
    sync_run_count: number;
    sync_query_complete: boolean;
    agent_run_count: number;
    agent_query_complete: boolean;
    affected_organizations: Array<{
      organization_id: string;
      organization_name: string;
      sync_runs: number;
      sync_failures: number;
      agent_runs: number;
      agent_failures: number;
      avg_agent_latency_ms: number | null;
      p95_agent_latency_ms: number | null;
      last_issue_at: string | null;
      recent_issues: Array<{ service: string; summary: string; at: string }>;
    }>;
  };
  security: {
    status: string;
    audit_events_24h: number;
    api_authentication_failures_5m: number;
    api_authorization_denials_5m: number;
    recent_admin_actions: Array<{
      action: string;
      entity_type: string | null;
      at: string;
    }>;
    coverage_gaps: string[];
  };
  feedback: {
    available: boolean;
    open_count: number;
    reports: Array<{
      id: string;
      organization_name: string;
      category: string;
      satisfaction: number | null;
      message: string;
      created_at: string;
    }>;
  };
  alerts: Array<{
    severity: "warning" | "critical";
    key: string;
    message: string;
  }>;
  data_quality: {
    sync_query_error: string | null;
    agent_query_error: string | null;
    organization_query_error: string | null;
    audit_query_error: string | null;
    audit_count_query_error: string | null;
    feedback_query_error: string | null;
    metrics_are_process_local: boolean;
  };
};

type ExternalProbe = {
  status: "ok" | "error" | "checking";
  latencyMs: number | null;
  checkedAt: string | null;
  checks: { supabase: string; redis: string } | null;
};

function percent(value: number | null | undefined) {
  return value == null ? "Sin datos" : `${value.toFixed(1)} %`;
}

function bytes(value: number | null | undefined) {
  if (value == null) return "Sin datos";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let current = value;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function time(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("es-ES") : "Sin datos";
}

function duration(seconds: number | null) {
  if (seconds == null) return "Sin datos";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return `${days} d ${hours} h ${minutes} min`;
}

function Panel({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-separator bg-surface p-5">
      <div className="mb-4">
        <h2 className="font-semibold">{title}</h2>
        {detail ? <p className="mt-1 text-sm text-muted">{detail}</p> : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "normal",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "normal" | "warning" | "critical";
}) {
  const toneClass =
    tone === "critical"
      ? "text-danger"
      : tone === "warning"
        ? "text-warning"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-separator p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </div>
  );
}

function pressureTone(
  value: number | null,
  warning: number,
  critical: number,
): "normal" | "warning" | "critical" {
  if (value == null) return "normal";
  return value >= critical
    ? "critical"
    : value >= warning
      ? "warning"
      : "normal";
}

function InfrastructurePanel() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [probe, setProbe] = useState<ExternalProbe>({
    status: "checking",
    latencyMs: null,
    checkedAt: null,
    checks: null,
  });
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current || document.visibilityState !== "visible") return;
    inFlight.current = true;
    try {
      const response = await apiFetch("/v1/admin/platform-health", {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(`No se pudo cargar el estado (${response.status}).`);
      const payload = (await response.json()) as HealthPayload;
      setData(payload);
      setError(null);
      setLastRefresh(new Date().toISOString());

      const started = performance.now();
      try {
        const probeResponse = await fetch(`${apiUrl}/health/ready`, {
          cache: "no-store",
          signal: AbortSignal.timeout(4_000),
        });
        const readiness = (await probeResponse.json()) as {
          checks?: { supabase?: string; redis?: string };
        };
        setProbe({
          status: probeResponse.ok ? "ok" : "error",
          latencyMs: performance.now() - started,
          checkedAt: new Date().toISOString(),
          checks: {
            supabase: readiness.checks?.supabase ?? "unknown",
            redis: readiness.checks?.redis ?? "unknown",
          },
        });
      } catch {
        setProbe({
          status: "error",
          latencyMs: null,
          checkedAt: new Date().toISOString(),
          checks: null,
        });
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Error al consultar la plataforma.",
      );
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const updateFeedback = async (
    feedbackId: string,
    status: "triaged" | "resolved",
  ) => {
    const response = await apiFetch(
      `/v1/admin/platform-feedback/${encodeURIComponent(feedbackId)}/status`,
      {
        method: "PATCH",
        cache: "no-store",
        body: JSON.stringify({ status }),
      },
    );
    if (!response.ok) throw new Error("No se pudo actualizar el informe.");
    await refresh();
  };

  if (loading && !data)
    return (
      <p className="rounded-lg border border-separator p-5">
        Cargando señales de salud…
      </p>
    );
  if (!data)
    return (
      <p role="alert" className="rounded-lg border border-danger p-5">
        {error ?? "No hay datos de salud disponibles."}
      </p>
    );

  const host = data.host;
  const slo = data.application.recent_slo;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            Actualización automática cada 10 segundos mientras esta pestaña está
            visible.
          </p>
          <p className="mt-1 text-xs text-muted">
            Última lectura: {time(lastRefresh)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-md border border-separator px-3 py-2 text-sm"
        >
          Actualizar ahora
        </button>
      </header>

      {error ? (
        <p
          role="status"
          className="rounded-md border border-warning p-3 text-sm"
        >
          La última consulta falló; se conservan los datos de{" "}
          {time(data.generated_at)}. {error}
        </p>
      ) : null}
      {probe.status === "error" ? (
        <p role="alert" className="rounded-md border border-danger p-3 text-sm">
          La sonda desde este navegador no pudo llegar a API /health/ready a
          través de la URL pública. Comprueba DNS, TLS, Caddy y el API.
        </p>
      ) : null}
      {data.alerts.length ? (
        <section aria-label="Alertas activas" className="space-y-2">
          {data.alerts.map((alert) => (
            <div
              key={alert.key}
              className={`rounded-md border p-3 text-sm ${alert.severity === "critical" ? "border-danger text-danger" : "border-warning text-warning"}`}
            >
              <strong>
                {alert.severity === "critical" ? "Crítica" : "Aviso"}:
              </strong>{" "}
              {alert.message}
            </div>
          ))}
        </section>
      ) : null}

      <Panel
        title="Servidor y contenedores"
        detail={
          host.status === "ok"
            ? `Métricas Node Exporter · muestra ${time(host.checked_at)}`
            : `Host no conectado: ${host.reason ?? "sin datos recientes"}`
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="CPU"
            value={
              host.cpu_percent == null ? "Midiendo…" : percent(host.cpu_percent)
            }
            detail={`${host.cpu_cores ?? "?"} núcleos · carga 1m ${host.load_1m?.toFixed(2) ?? "n/d"}`}
            tone={pressureTone(host.cpu_percent, 80, 90)}
          />
          <MetricCard
            label="Memoria usada"
            value={percent(host.memory_used_percent)}
            detail={`${bytes(host.memory_available_bytes)} disponibles de ${bytes(host.memory_total_bytes)}`}
            tone={pressureTone(host.memory_used_percent, 80, 90)}
          />
          <MetricCard
            label="Swap usada"
            value={bytes(host.swap_used_bytes)}
            detail={`de ${bytes(host.swap_total_bytes)}`}
            tone={
              host.swap_used_bytes &&
              host.swap_total_bytes &&
              host.swap_used_bytes / host.swap_total_bytes > 0.8
                ? "warning"
                : "normal"
            }
          />
          <MetricCard
            label="Disco raíz"
            value={percent(host.disk_used_percent)}
            detail={`${bytes(host.disk_available_bytes)} libres de ${bytes(host.disk_total_bytes)}`}
            tone={pressureTone(host.disk_used_percent, 75, 85)}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <span>Uptime: {duration(host.uptime_seconds)}</span>
          <span>Último arranque: {time(host.boot_time)}</span>
          <span>
            Reinicios observados desde arranque API:{" "}
            {host.boot_changes_observed_since_api_start}
          </span>
          <span>Contenedores: {data.containers.status}</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="text-xs text-muted"><tr><th className="py-2">Servicio</th><th>Estado</th><th>CPU</th><th>RAM</th><th>Reinicios</th><th>OOM</th></tr></thead>
            <tbody>
              {data.containers.containers.map((container) => (
                <tr key={container.id} className="border-t border-separator">
                  <td className="py-2 font-medium">{container.service}</td>
                  <td>{container.health ?? container.state}</td>
                  <td>{percent(container.cpu_percent)}</td>
                  <td>{bytes(container.memory_working_set_bytes)}{container.memory_used_percent == null ? "" : ` · ${percent(container.memory_used_percent)}`}</td>
                  <td>{container.restart_count ?? "n/d"}</td>
                  <td>{container.oom_events ?? "n/d"}</td>
                </tr>
              ))}
              {!data.containers.containers.length ? <tr><td colSpan={6} className="py-3 text-muted">{data.containers.reason ?? "Sin métricas de contenedores."}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Base de datos y recuperación" detail={`Comprobación ${time(data.database_recovery.checked_at)} · latencia PostgREST y copias Supabase`}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Supabase DB" value={data.database_recovery.database.status} detail={data.database_recovery.database.latency_ms == null ? "Sin medida" : `${data.database_recovery.database.latency_ms} ms`} tone={data.database_recovery.database.status === "ok" ? "normal" : "critical"} />
          <MetricCard label="Conexiones activas" value={data.database_recovery.connections.active == null ? "Sin datos" : String(data.database_recovery.connections.active)} detail={data.database_recovery.connections.max == null ? data.database_recovery.connections.status : `de ${data.database_recovery.connections.max} máximas`} tone={data.database_recovery.connections.active != null && data.database_recovery.connections.max != null && data.database_recovery.connections.active / data.database_recovery.connections.max >= 0.8 ? "warning" : "normal"} />
          <MetricCard label="Último backup" value={time(data.database_recovery.backups.latest_backup_at)} detail={data.database_recovery.backups.status === "not_configured" ? "Configura token Management API" : data.database_recovery.backups.status} tone={data.database_recovery.backups.status === "available" ? "normal" : "warning"} />
          <MetricCard label="PITR" value={data.database_recovery.backups.pitr_enabled == null ? "Sin datos" : data.database_recovery.backups.pitr_enabled ? "Activo" : "Inactivo"} detail={data.database_recovery.backups.latest_physical_backup_at ? `Backup físico ${time(data.database_recovery.backups.latest_physical_backup_at)}` : "Point in time recovery"} tone={data.database_recovery.backups.pitr_enabled === false ? "warning" : "normal"} />
          <MetricCard label="Última restauración probada" value={time(data.database_recovery.last_restore_verified_at)} detail="Fecha configurada tras verificar una restauración" tone={data.database_recovery.last_restore_verified_at ? "normal" : "warning"} />
        </div>
        {data.database_recovery.backups.reason ? <p role="status" className="mt-3 text-sm text-warning">Backups: {data.database_recovery.backups.reason}</p> : null}
      </Panel>

      <Panel title="Disponibilidad externa" detail="Sonda programada desde GitHub Actions, fuera del VPS.">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Última comprobación" value={data.external_probe.latest ? (data.external_probe.latest.ok ? "Disponible" : "Caída") : "Sin sonda"} detail={time(data.external_probe.latest?.checked_at)} tone={data.external_probe.latest?.ok ? "normal" : "critical"} />
          <MetricCard label="Latencia externa" value={data.external_probe.latest?.latency_ms == null ? "Sin datos" : `${data.external_probe.latest.latency_ms} ms`} detail={`HTTP ${data.external_probe.latest?.http_status ?? "n/d"}`} />
          <MetricCard label="DNS / certificado TLS" value={data.external_probe.latest ? `${data.external_probe.latest.dns_ok ? "DNS OK" : "DNS error"} · ${data.external_probe.latest.tls_days_remaining == null || data.external_probe.latest.tls_days_remaining < 0 ? "TLS n/d" : `${data.external_probe.latest.tls_days_remaining} d`}` : "Sin datos"} detail={`${data.external_probe.history.filter((check) => check.ok).length}/${data.external_probe.history.length} comprobaciones correctas en 24 h`} tone={data.external_probe.latest?.dns_ok && (data.external_probe.latest.tls_days_remaining == null || data.external_probe.latest.tls_days_remaining > 14) ? "normal" : "warning"} />
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Experiencia de la aplicación"
          detail="Ventana móvil de 5 minutos; las métricas se reinician si se reinicia el proceso API."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="SLO API"
              value={slo.status.replaceAll("_", " ")}
              detail={`${slo.requestCount} peticiones medidas`}
              tone={
                slo.status === "critical"
                  ? "critical"
                  : slo.status === "degraded"
                    ? "warning"
                    : "normal"
              }
            />
            <MetricCard
              label="Latencia p95"
              value={
                slo.p95LatencyMs == null
                  ? "Sin tráfico"
                  : `${Math.round(slo.p95LatencyMs)} ms`
              }
              detail={`${slo.errorCount} respuestas 5xx · ${slo.timeouts} timeouts · ${(slo.errorRate * 100).toFixed(2)} %`}
              tone={
                slo.status === "critical"
                  ? "critical"
                  : slo.status === "degraded"
                    ? "warning"
                    : "normal"
              }
            />
            <MetricCard
              label="Peticiones simultáneas"
              value={String(slo.inFlightRequests)}
              detail={`Pico observado en 5 min: ${slo.peakConcurrentRequests}`}
              tone={slo.inFlightRequests >= 40 ? "warning" : "normal"}
            />
            <MetricCard
              label="Sonda desde este navegador"
              value={
                probe.status === "ok"
                  ? `${Math.round(probe.latencyMs ?? 0)} ms`
                  : probe.status === "checking"
                    ? "Comprobando…"
                    : "No disponible"
              }
              detail={`Health check remoto · ${time(probe.checkedAt)}`}
              tone={probe.status === "error" ? "warning" : "normal"}
            />
            <MetricCard
              label="Worker"
              value={data.application.worker.status}
              detail={
                data.application.worker.heartbeat_age_seconds == null
                  ? (data.application.worker.reason ?? "Sin heartbeat")
                  : `Heartbeat hace ${Math.round(data.application.worker.heartbeat_age_seconds)} s · ${time(data.application.worker.heartbeat_at)}`
              }
              tone={
                data.application.worker.status === "ok"
                  ? "normal"
                  : data.application.worker.status === "stale" ||
                      data.application.worker.status === "error"
                    ? "critical"
                    : "warning"
              }
            />
            <MetricCard
              label="Usuarios activos"
              value={
                data.application.worker.active_users_60s == null
                  ? "Sin datos"
                  : String(data.application.worker.active_users_60s)
              }
              detail="Usuarios autenticados con pestaña visible en los últimos 60 s"
              tone={
                data.application.worker.active_users_60s == null
                  ? "warning"
                  : "normal"
              }
            />
            <MetricCard
              label="Máximo activo esta hora"
              value={String(data.application.worker.active_users_hourly_peaks?.at(-1)?.peak ?? "Sin datos")}
              detail="Pico de pestañas autenticadas de la hora actual"
            />
            <MetricCard
              label="Máximo activo hoy"
              value={String(data.application.worker.active_users_daily_peaks?.at(-1)?.peak ?? "Sin datos")}
              detail="Pico de pestañas autenticadas de hoy"
            />
          </div>
          <div className="mt-4 overflow-x-auto">
            <h3 className="mb-2 text-sm font-semibold">Latencia por ruta (p50 / p95 / p99) · 5 min</h3>
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="text-muted"><tr><th className="py-2">Ruta</th><th>Peticiones</th><th>p50</th><th>p95</th><th>p99</th><th>5xx</th></tr></thead>
              <tbody>{slo.latency_by_route.map((route) => (
                <tr key={route.route} className="border-t border-separator">
                  <td className="py-2 font-mono">{route.route}</td><td>{route.requestCount}</td>
                  <td>{route.p50LatencyMs == null ? "n/d" : `${Math.round(route.p50LatencyMs)} ms`}</td>
                  <td>{route.p95LatencyMs == null ? "n/d" : `${Math.round(route.p95LatencyMs)} ms`}</td>
                  <td>{route.p99LatencyMs == null ? "n/d" : `${Math.round(route.p99LatencyMs)} ms`}</td><td>{route.errorCount}</td>
                </tr>
              ))}</tbody>
            </table>
            <p className="mt-2 text-xs text-muted">Peticiones por minuto (últimos 5): {slo.requests_per_minute.map((minute) => minute.count).join(" · ")}</p>
          </div>
          <p className="mt-3 text-xs text-muted">
            La concurrencia API mide peticiones HTTP en curso. Usuarios activos
            cuenta identidades autenticadas con heartbeat reciente en Redis;
            las pestañas ocultas dejan de contar tras 60 s.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.application.worker.queues.map((queue) => (
              <div
                key={queue.name}
                className="rounded-lg border border-separator p-3 text-sm"
              >
                <p className="font-medium">{queue.name}</p>
                {queue.name === "ecomscaling-shopify-sync" ? (
                  <p className="mt-1 text-muted">
                    Priorizados {queue.prioritized ?? 0} · trabajo pendiente más antiguo: {duration(queue.oldest_pending_age_seconds ?? null)} ·
                    concurrencia global: {queue.global_concurrency ?? "sin configurar"} ·
                    frecuencia global: {queue.global_rate_limit
                      ? `${queue.global_rate_limit.max} trabajo(s) / ${queue.global_rate_limit.duration / 1_000} s`
                      : "sin configurar"}
                  </p>
                ) : null}
                <p className="mt-1 text-muted">
                  En espera {queue.waiting ?? 0} · activos {queue.active ?? 0} ·
                  fallidos {queue.failed ?? 0} · retrasados {queue.delayed ?? 0}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Shopify procesa una sincronización cada vez y separa los inicios al menos 5 segundos. La cola pendiente no tiene tope; vigila su antigüedad antes de aumentar capacidad.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="Supabase"
              value={probe.checks?.supabase ?? "Sin datos"}
              detail="Comprobación desde API /health/ready"
              tone={
                probe.checks?.supabase === "ok"
                  ? "normal"
                  : probe.checks?.supabase === "error"
                    ? "critical"
                    : "warning"
              }
            />
            <MetricCard
              label="Redis"
              value={probe.checks?.redis ?? "Sin datos"}
              detail="Comprobación desde API /health/ready"
              tone={
                probe.checks?.redis === "ok"
                  ? "normal"
                  : probe.checks?.redis === "error"
                    ? "critical"
                    : "warning"
              }
            />
          </div>
          <p className="mt-4 text-sm text-muted">
            La sonda llega desde el navegador a través de Caddy. Los
            contenedores se evalúan por servicio, sin exponer el socket de
            Docker.
          </p>
        </Panel>

        <Panel
          title="Clientes afectados"
          detail={`Fallos de sincronización y agentes en las últimas ${data.window_hours} h.`}
        >
          {!data.customers.affected_organizations.length ? (
            <p className="text-sm text-muted">
              No aparecen organizaciones afectadas en la ventana consultada.
            </p>
          ) : (
            <div className="space-y-3">
              {data.customers.affected_organizations.map((org) => (
                <details
                  key={org.organization_id}
                  className="rounded-lg border border-separator p-3"
                >
                  <summary className="cursor-pointer font-medium">
                    {org.organization_name}
                    <span className="ml-2 text-sm text-muted">
                      {org.sync_failures} sync · {org.agent_failures} IA
                    </span>
                  </summary>
                  <p className="mt-2 text-xs text-muted">
                    Último incidente: {time(org.last_issue_at)} · latencia IA
                    media{" "}
                    {org.avg_agent_latency_ms == null
                      ? "n/d"
                      : `${Math.round(org.avg_agent_latency_ms)} ms`}{" "}
                    · p95{" "}
                    {org.p95_agent_latency_ms == null
                      ? "n/d"
                      : `${Math.round(org.p95_agent_latency_ms)} ms`}
                  </p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {org.recent_issues.map((issue, index) => (
                      <li key={`${issue.at}-${index}`}>
                        <span className="font-medium">{issue.service}</span>:{" "}
                        {issue.summary}
                        <span className="ml-2 text-xs text-muted">
                          {time(issue.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted">
            Leídas {data.customers.sync_run_count} sincronizaciones y{" "}
            {data.customers.agent_run_count} ejecuciones. La consulta indica si
            alcanzó el límite de filas.
          </p>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title={`Feedback de clientes (${data.feedback.open_count})`}
          detail="Informes enviados desde el dashboard de cliente."
        >
          {!data.feedback.available ? (
            <p role="status" className="text-sm text-warning">
              La tabla de feedback aún no está disponible; aplica la migración
              incluida.
            </p>
          ) : null}
          {data.feedback.available && !data.feedback.reports.length ? (
            <p className="text-sm text-muted">No hay informes pendientes.</p>
          ) : null}
          <ul className="space-y-3">
            {data.feedback.reports.map((report) => (
              <li
                key={report.id}
                className="rounded-lg border border-separator p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {report.organization_name} · {report.category}
                  </p>
                  <span className="text-xs text-muted">
                    {time(report.created_at)}
                    {report.satisfaction
                      ? ` · valoración ${report.satisfaction}/5`
                      : ""}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">
                  {report.message}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void updateFeedback(report.id, "triaged").catch((cause) =>
                        setError(
                          cause instanceof Error ? cause.message : "Error",
                        ),
                      )
                    }
                    className="rounded-md border border-separator px-3 py-1.5 text-xs"
                  >
                    En revisión
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void updateFeedback(report.id, "resolved").catch(
                        (cause) =>
                          setError(
                            cause instanceof Error ? cause.message : "Error",
                          ),
                      )
                    }
                    className="rounded-md border border-separator px-3 py-1.5 text-xs"
                  >
                    Resolver
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title={`Seguridad y auditoría (${data.security.audit_events_24h} eventos)`}
          detail="Acciones administrativas registradas en las últimas 24 horas."
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="API 401 · autenticación rechazada"
              value={String(data.security.api_authentication_failures_5m)}
              detail="Últimos 5 min"
              tone={
                data.security.api_authentication_failures_5m >= 20
                  ? "warning"
                  : "normal"
              }
            />
            <MetricCard
              label="API 403 · acceso denegado"
              value={String(data.security.api_authorization_denials_5m)}
              detail="Últimos 5 min"
              tone={
                data.security.api_authorization_denials_5m >= 20
                  ? "warning"
                  : "normal"
              }
            />
          </div>
          <ul className="max-h-64 space-y-2 overflow-auto text-sm">
            {data.security.recent_admin_actions.map((event, index) => (
              <li
                key={`${event.at}-${index}`}
                className="flex flex-wrap justify-between gap-2 border-b border-separator pb-2"
              >
                <span>
                  {event.action}
                  {event.entity_type ? ` · ${event.entity_type}` : ""}
                </span>
                <time className="text-xs text-muted">{time(event.at)}</time>
              </li>
            ))}
            {!data.security.recent_admin_actions.length ? (
              <li className="text-muted">No hay acciones en esta ventana.</li>
            ) : null}
          </ul>
          <h3 className="mt-4 text-sm font-semibold">
            Señales aún pendientes de conexión
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {data.security.coverage_gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </Panel>
      </div>

      {data.data_quality.metrics_are_process_local ? (
        <p className="text-xs text-muted">
          La ventana HTTP de 5 minutos es local al proceso y se reinicia al
          desplegar; los informes de clientes y sus estados se guardan en
          Supabase.
        </p>
      ) : null}
      {data.data_quality.sync_query_error ||
      data.data_quality.agent_query_error ||
      data.data_quality.audit_query_error ||
      data.data_quality.audit_count_query_error ||
      data.data_quality.organization_query_error ? (
        <p role="status" className="text-xs text-warning">
          Una o más consultas están incompletas. Revisa el estado de Supabase y
          el esquema aplicado.
        </p>
      ) : null}
    </div>
  );
}

export default function AdminInfrastructurePage() {
  return (
    <PlatformAdminShell title="Salud y seguridad">
      {() => <InfrastructurePanel />}
    </PlatformAdminShell>
  );
}
