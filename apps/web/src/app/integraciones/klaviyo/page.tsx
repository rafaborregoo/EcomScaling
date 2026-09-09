"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { displayValue } from "@/lib/display-labels";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  Select,
} from "@/components/ui";
import {
  BackToHub,
  ConnectionFacts,
  LastErrorBanner,
  ProviderStatusCard,
  Steps,
  readErr,
  useIntegrations,
  type KlaviyoMetricsResponse,
  type KlaviyoReportsResponse,
} from "../shared";

function useKlaviyoConfig(
  organizationId: string | null,
  connectionId: string | null,
) {
  const [metrics, setMetrics] = useState<KlaviyoMetricsResponse | null>(null);
  const [reports, setReports] = useState<KlaviyoReportsResponse | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId || !connectionId) {
      setMetrics(null);
      setReports(null);
      return;
    }
    setLoading(true);
    setMetricsError(null);
    setReportsError(null);
    try {
      const [metricsResponse, reportsResponse] = await Promise.all([
        apiFetch(`/v1/organizations/${organizationId}/klaviyo/metrics`),
        apiFetch(
          `/v1/organizations/${organizationId}/klaviyo/reporting?connectionId=${encodeURIComponent(connectionId)}`,
        ),
      ]);
      if (metricsResponse.ok) {
        setMetrics((await metricsResponse.json()) as KlaviyoMetricsResponse);
      } else {
        setMetricsError(await readErr(metricsResponse));
      }
      if (reportsResponse.ok) {
        setReports((await reportsResponse.json()) as KlaviyoReportsResponse);
      } else {
        setReportsError(await readErr(reportsResponse));
      }
    } catch {
      setMetricsError("No se pudo cargar la configuración de Klaviyo. Reintenta.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, connectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    metrics,
    setMetrics,
    reports,
    metricsError,
    reportsError,
    loading,
    reload: load,
  };
}

function KlaviyoIntegrationPage({
  bootstrap,
}: {
  bootstrap: BootstrapResponse;
}) {
  const { organization, provider, isLoading, error, actions, pending, actionError } =
    useIntegrations(bootstrap);
  const klaviyo = provider("klaviyo");
  const connectionId = klaviyo?.connection?.id ?? null;
  const { metrics, setMetrics, reports, metricsError, reportsError, loading } =
    useKlaviyoConfig(organization?.id ?? null, connectionId);
  const [apiKey, setApiKey] = useState("");
  const [savingMetric, setSavingMetric] = useState(false);
  const [metricSaveError, setMetricSaveError] = useState<string | null>(null);
  // El Select guarda al cambiar y no habia ninguna confirmacion: ni visual ni
  // anunciada. Quien lo usa con teclado no sabia si se habia guardado.
  const [metricStatus, setMetricStatus] = useState("");

  if (isLoading) {
    return <AsyncState status="loading" loadingLabel="Cargando Klaviyo..." />;
  }
  if (error) {
    return (
      <div className="portal-page space-y-4">
        <BackToHub />
        <ErrorBlock>{error}</ErrorBlock>
      </div>
    );
  }
  if (!klaviyo) {
    return (
      <div className="portal-page space-y-4">
        <BackToHub />
        <AsyncState
          status="empty"
          emptyTitle="Klaviyo no está disponible"
          emptyHint="Este conector no aparece en la configuración de esta organización."
        />
      </div>
    );
  }

  const configured = klaviyo.configuration.status === "configured";

  async function saveMetric(metricId: string) {
    if (!organization || !metricId) return;
    setSavingMetric(true);
    setMetricSaveError(null);
    setMetricStatus("Guardando métrica de conversión...");
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/klaviyo/conversion-metric`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metricId, source: "klaviyo" }),
        },
      );
      if (!response.ok) {
        const message = await readErr(response);
        setMetricSaveError(message);
        setMetricStatus(`No se pudo guardar la métrica. ${message}`);
        return;
      }
      setMetricStatus("Métrica de conversión guardada.");
      setMetrics((current) =>
        current
          ? {
              ...current,
              conversion_metric_id: metricId,
              metrics: current.metrics.map((metric) => ({
                ...metric,
                selected: metric.external_metric_id === metricId,
              })),
            }
          : current,
      );
    } catch {
      setMetricSaveError("No se pudo guardar la métrica. Reintenta.");
      setMetricStatus("No se pudo guardar la métrica. Reintenta.");
    } finally {
      setSavingMetric(false);
    }
  }

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <BackToHub />

      <ProviderStatusCard provider={klaviyo}>
        <p className="mt-3 text-sm leading-6 text-muted">
          Importa campañas, flujos, listas y métricas de email/SMS. Puedes
          conectar por OAuth o pegando una API key privada.
        </p>
      </ProviderStatusCard>

      <Card title="Conectar Klaviyo">
        {configured ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">
              Opción recomendada: autoriza con tu cuenta de Klaviyo.
            </p>
            <Button
              type="button"
              onClick={() => void actions.connectKlaviyo()}
              disabled={pending === "klaviyo"}
            >
              {pending === "klaviyo"
                ? "Conectando..."
                : klaviyo.connection
                  ? "Reautorizar Klaviyo (OAuth)"
                  : "Conectar Klaviyo (OAuth)"}
            </Button>
          </div>
        ) : (
          <Banner tone="warn">
            OAuth de Klaviyo no está configurado en el servidor. Puedes conectar
            con una API key privada mientras tanto.
          </Banner>
        )}

        <div className="mt-4">
        <Field label="Conectar con API key privada">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="API key privada de Klaviyo"
              type="password"
              autoComplete="off"
              placeholder="pk_..."
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <Button
              type="button"
              onClick={() => void actions.connectKlaviyoApiKey(apiKey)}
              disabled={pending === "klaviyo-key" || !apiKey.trim()}
            >
              {pending === "klaviyo-key"
                ? "Conectando..."
                : klaviyo.connection
                  ? "Actualizar key"
                  : "Conectar"}
            </Button>
          </div>
        </Field>
        </div>
        <Steps
          items={[
            <>
              En Klaviyo entra en{" "}
              <span className="font-medium">Settings → API keys</span>.
            </>,
            <>
              Crea una <span className="font-medium">Private API Key</span> con
              permiso de lectura (Read) para Campaigns, Flows, Metrics, Lists y
              Segments.
            </>,
            <>Pégala arriba y pulsa Conectar.</>,
          ]}
        />
        {actionError ? (
          <Banner className="mt-3" tone="danger">
            {actionError}
          </Banner>
        ) : null}
      </Card>

      {klaviyo.connection ? (
        <Card
          title="Métrica primaria de conversión"
          description="La métrica que Klaviyo usará para atribuir ingresos y conversiones en los informes."
        >
          {loading ? (
            <LoadingBlock label="Cargando métricas..." />
          ) : metricsError ? (
            <Banner tone="danger">{metricsError}</Banner>
          ) : !metrics || metrics.metrics.length === 0 ? (
            <EmptyState
              title="Aún no hay métricas sincronizadas"
              hint="Ejecuta una sincronización de Klaviyo para poder elegir la métrica de conversión."
            />
          ) : (
            <>
              <Select
                aria-label="Métrica primaria de conversión"
                value={metrics.conversion_metric_id ?? ""}
                onChange={(value) => void saveMetric(value)}
                disabled={savingMetric}
                options={metrics.metrics.map((metric) => ({
                  value: metric.external_metric_id,
                  label: `${metric.name}${metric.metric_type ? ` · ${metric.metric_type}` : ""}`,
                }))}
              />
              <p role="status" aria-live="polite" className="mt-2 text-xs text-muted">
                {metricStatus}
              </p>
              {metricSaveError ? (
                <Banner className="mt-3" tone="danger">
                  {metricSaveError}
                </Banner>
              ) : null}
            </>
          )}
        </Card>
      ) : null}

      {klaviyo.connection ? (
        <Card
          title="Reporting"
          description="Solo se muestran ejecuciones y valores recibidos de Klaviyo; la ausencia de filas no significa cero."
        >
          {loading ? (
            <LoadingBlock label="Cargando reporting..." />
          ) : reportsError ? (
            <Banner tone="danger">{reportsError}</Banner>
          ) : !reports || reports.runs.length === 0 ? (
            <EmptyState
              title="Aún no hay ejecuciones de reporting"
              hint="Aparecerá cuando Klaviyo esté conectado, tenga métrica de conversión y el reconciliador complete una consulta."
            />
          ) : (
            <div className="space-y-3">
              {reports.runs.slice(0, 5).map((run) => {
                const values = reports.values.filter(
                  (value) => value.report_run_id === run.id,
                );
                return (
                  <div
                    key={run.id}
                    className="rounded-md border border-separator px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {run.entity_type} ·{" "}
                        {run.period_start ?? "periodo pendiente"}
                        {run.period_end ? ` → ${run.period_end}` : ""}
                      </span>
                      <Badge>{displayValue(run.status)}</Badge>
                    </div>
                    {run.error_message ? (
                      <p className="mt-1 text-sm text-danger">
                        {run.error_message}
                      </p>
                    ) : null}
                    {values.length > 0 ? (
                      <div className="mt-2 space-y-1 text-sm text-muted">
                        {values.slice(0, 5).map((value) => (
                          <div
                            key={value.id}
                            className="flex justify-between gap-3"
                          >
                            <span>
                              {value.entity_name ??
                                value.external_entity_id ??
                                "Entidad externa"}
                            </span>
                            <span>
                              {value.revenue != null
                                ? `${Number(value.revenue).toLocaleString("es-ES")} ${value.currency_code ?? ""}`
                                : value.conversions != null
                                  ? `${Number(value.conversions).toLocaleString("es-ES")} conversiones`
                                  : "Valor recibido"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ) : null}

      <LastErrorBanner
        provider={klaviyo}
        retrying={pending === "retry-klaviyo"}
        onRetry={
          klaviyo.connection
            ? () => void actions.retrySync("klaviyo", klaviyo.connection!.id)
            : undefined
        }
      />

      <Card title="Estado de la conexión">
        <ConnectionFacts provider={klaviyo} />
      </Card>
    </div>
  );
}

export default function KlaviyoPage() {
  return (
    <PortalShell title="Integración · Klaviyo">
      {(bootstrap) => <KlaviyoIntegrationPage bootstrap={bootstrap} />}
    </PortalShell>
  );
}
