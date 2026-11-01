"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { displayValue } from "@/lib/display-labels";
import {
  ScrollArea,
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
  RadioGroup,
  RadioGroupItem,
  AsyncState,
  Badge,
  Banner,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import {
  BackToHub,
  ConnectionFacts,
  ConnectionPicker,
  InfoModalButton,
  LastErrorBanner,
  ProviderStatusCard,
  readErr,
  storesByConnection,
  useIntegrations,
  useProviderConnection,
  useStoreScope,
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
      setMetricsError(
        "No se pudo cargar la configuración de Klaviyo. Reintenta.",
      );
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
  const {
    organization,
    provider,
    isLoading,
    error,
    actions,
    pending,
    actionError,
  } = useIntegrations(bootstrap);
  const klaviyo = provider("klaviyo");
  // En Klaviyo la cuenta es 1:1 con la conexion (unique (connection_id)), asi
  // que la tienda del encabezado identifica exactamente una conexion.
  const { connectionId: activeConnectionId } = useActiveConnection();
  const { scope } = useStoreScope(organization?.id ?? null);
  const storeByConnection = storesByConnection(
    scope?.klaviyo_accounts ?? [],
    scope?.stores ?? [],
  );
  const activeStore =
    scope?.stores.find((store) => store.connection_id === activeConnectionId) ??
    null;
  const preferredConnectionId =
    [...storeByConnection.entries()].find(
      ([, store]) => store.id === activeStore?.id,
    )?.[0] ?? null;

  const { connection, connections, setChosenId } = useProviderConnection(
    klaviyo,
    preferredConnectionId,
  );
  const connectionId = connection?.id ?? null;
  const { metrics, setMetrics, reports, metricsError, reportsError, loading } =
    useKlaviyoConfig(organization?.id ?? null, connectionId);
  const [savingMetric, setSavingMetric] = useState(false);
  const [metricSaveError, setMetricSaveError] = useState<string | null>(null);
  // El Select guarda al cambiar y no habia ninguna confirmacion: ni visual ni
  // anunciada. Quien lo usa con teclado no sabia si se habia guardado.
  const [metricStatus, setMetricStatus] = useState("");
  const [isMetricPickerOpen, setIsMetricPickerOpen] = useState(false);

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
  // Esta página configura y sincroniza la cuenta elegida. El resumen global
  // del proveedor puede pertenecer a otra conexión de la organización.
  const selectedProvider = {
    ...klaviyo,
    connection,
    latest_sync: connection?.latest_sync ?? null,
    health: connection?.health ?? klaviyo.health,
    activation: connection?.activation ?? klaviyo.activation,
  };

  async function saveMetric(metricId: string): Promise<boolean> {
    if (!organization || !metricId) return false;
    setSavingMetric(true);
    setMetricSaveError(null);
    setMetricStatus("Guardando métrica de conversión...");
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/klaviyo/conversion-metric`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metricId, source: "klaviyo", connectionId }),
        },
      );
      if (!response.ok) {
        const message = await readErr(response);
        setMetricSaveError(message);
        setMetricStatus(`No se pudo guardar la métrica. ${message}`);
        return false;
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
      return true;
    } catch {
      setMetricSaveError("No se pudo guardar la métrica. Reintenta.");
      setMetricStatus("No se pudo guardar la métrica. Reintenta.");
      return false;
    } finally {
      setSavingMetric(false);
    }
  }

  return (
    <div className="portal-page space-y-6">
      <BackToHub />

      <ProviderStatusCard provider={selectedProvider}>
        <p className="mt-3 text-sm leading-6 text-muted">
          Importa campañas, flujos, listas y métricas de email/SMS, y publica en
          tu cuenta las plantillas aprobadas en Marketing.
        </p>
      </ProviderStatusCard>

      <ConnectionPicker
        connections={connections}
        connection={connection}
        onChange={setChosenId}
        storeByConnection={storeByConnection}
        activeStore={activeStore}
      />

      {/* La conexion guarda lo que la credencial puede hacer de verdad
          (sondeado al conectar). Si no esta el permiso de escritura de
          plantillas, se dice aqui y no cuando falle el envio. */}
      {connection &&
      connection.scopes.length > 0 &&
      !connection.scopes.includes("templates:write") ? (
        <Banner tone="warn" title="Esta conexión lee, pero no puede publicar plantillas">
          Para enviar a Klaviyo las piezas aprobadas en Marketing, vuelve a
          conectarla aceptando todos los permisos.
        </Banner>
      ) : null}

      {connection &&
      connection.scopes.length > 0 &&
      !connection.scopes.includes("events:read") ? (
        <Banner tone="danger" title="Falta el permiso para leer eventos">
          Sin él la sincronización seguirá fallando. Vuelve a conectar Klaviyo
          y acepta el permiso de eventos.
        </Banner>
      ) : null}

      {connection &&
      connection.scopes.length > 0 &&
      !connection.scopes.includes("flows:write") ? (
        <Banner tone="warn" title="Esta conexión no puede crear flows">
          Para crearlos desde E-NORA, vuelve a conectar Klaviyo y acepta el
          permiso de flows.
        </Banner>
      ) : null}

      <Card className="border border-channel-email">
        <CardHeader>
          <CardTitle>{connection
            ? "Renueva el acceso a Klaviyo"
            : "Conecta tu cuenta de Klaviyo"}</CardTitle>
          <CardDescription>Usaremos acceso seguro para leer el rendimiento de email y SMS. La publicación de plantillas solo se activa cuando la apruebas desde Marketing.</CardDescription>
        </CardHeader>
        <CardContent>
          {configured ? (
            <div className="space-y-2">
              <p className="text-sm text-muted">
                Autoriza con tu cuenta de Klaviyo. Si conectaste antes de que
                existiera el envío de plantillas, vuelve a autorizar: el permiso
                de plantillas no estaba en aquel consentimiento.
              </p>
              <Button
                type="button"
                onClick={() => void actions.connectKlaviyo()}
                disabled={pending === "klaviyo"}
              >
                {pending === "klaviyo"
                  ? "Conectando..."
                  : connection
                    ? "Reautorizar Klaviyo (OAuth)"
                    : "Conectar Klaviyo (OAuth)"}
              </Button>
            </div>
          ) : (
            <Banner tone="warn" title="Conectar Klaviyo aún no está disponible">
              Falta configurarlo en el servidor. En cuanto esté, podrás
              conectarlo desde aquí.
            </Banner>
          )}
          {actionError ? (
            <Banner className="mt-3" tone="danger">
              {actionError}
            </Banner>
          ) : null}
        </CardContent>
      </Card>

      {connection ? (
        <Card>
          <CardHeader>
            <CardTitle>Métrica de conversión</CardTitle>
            <CardDescription>Esta métrica sirve para atribuir ingresos y conversiones en los informes de Klaviyo.</CardDescription>
          </CardHeader>
          <CardContent>
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
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsMetricPickerOpen(true)}
                    disabled={savingMetric}
                  >
                    {savingMetric
                      ? "Guardando…"
                      : metrics.metrics.find((metric) => metric.selected)?.name ?? "Elegir métrica"}
                  </Button>
                  <MetricPickerDialog
                    isOpen={isMetricPickerOpen}
                    onOpenChange={setIsMetricPickerOpen}
                    metrics={metrics.metrics}
                    saving={savingMetric}
                    onSave={saveMetric}
                  />
                  <p
                    role="status"
                    aria-live="polite"
                    className="mt-2 text-xs text-muted"
                  >
                    {metricStatus}
                  </p>
                  {metricSaveError ? (
                    <Banner className="mt-3" tone="danger">
                      {metricSaveError}
                    </Banner>
                  ) : null}
                </>
              )}
          </CardContent>
        </Card>
      ) : null}

      {connection ? (
        <InfoModalButton title="Últimas lecturas de Klaviyo" label="Ver lecturas recientes">
          <p>Mostramos datos que Klaviyo ya ha devuelto. Si no hay filas, todavía no significa que el resultado sea cero.</p>
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
                    <Card size="sm" key={run.id}><CardContent>
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
                    </CardContent></Card>
                  );
                })}
              </div>
            )}
        </InfoModalButton>
      ) : null}

      <LastErrorBanner
        provider={selectedProvider}
        retrying={pending === "retry-klaviyo"}
        onRetry={
          connection
            ? () => void actions.retrySync("klaviyo", connection!.id)
            : undefined
        }
      />

      <InfoModalButton title="Detalles técnicos de Klaviyo" label="Detalles técnicos">
          <ConnectionFacts provider={selectedProvider} />
      </InfoModalButton>
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

type PickerMetric = {
  id: string;
  name: string;
  metric_type?: string | null;
  selected: boolean;
  external_metric_id: string;
};

/** Elegir la métrica que cuenta como venta: selección + confirmación, no un clic que guarda. */
function MetricPickerDialog({
  isOpen,
  onOpenChange,
  metrics,
  saving,
  onSave,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  metrics: PickerMetric[];
  saving: boolean;
  onSave: (externalMetricId: string) => Promise<boolean>;
}) {
  const current = metrics.find((metric) => metric.selected)?.external_metric_id ?? "";
  const [picked, setPicked] = useState(current);
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) setPicked(current);
  }
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange} busy={saving}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Qué cuenta como una venta?</DialogTitle>
        </DialogHeader>
        <Banner tone="warn">Esta métrica define qué se cuenta como venta en los informes de Klaviyo.</Banner>
        <ScrollArea className="max-h-72"><FieldSet className="gap-2">
          <FieldLegend className="sr-only">Métrica de conversión</FieldLegend>
          <RadioGroup value={picked} onValueChange={setPicked} className="gap-2">
            {metrics.map((metric) => (
              <FieldLabel key={metric.id}>
                <Field orientation="horizontal">
                  <RadioGroupItem value={metric.external_metric_id} />
                  <span className="min-w-0 flex-1 truncate">{metric.name}</span>
                  {metric.metric_type ? <span className="text-xs text-muted">{metric.metric_type}</span> : null}
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
        </FieldSet></ScrollArea>
        <DialogFooter>
          <DialogClose>Cancelar</DialogClose>
          <Button disabled={saving || !picked || picked === current} onClick={() => {
          void onSave(picked).then((saved) => {
            if (saved) onOpenChange(false);
          });
        }}>{saving ? "Guardando…" : "Usar esta métrica"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
