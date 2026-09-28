"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { KlaviyoInsightsSections } from "./insights-sections";
import { KlaviyoEmailPanel } from "@/components/klaviyo-email-panel";
import { AiDiagnosticSection } from "@/components/ai-diagnostic-section";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Heading,
  Link,
  List,
  LoadingBlock,
  Select,
  type Tone,
} from "@/components/ui";

const periodOptions: Array<{ days: number | "all"; label: string }> = [
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "1 año" },
  { days: "all", label: "Todo" },
];

function KlaviyoView({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const [periodDays, setPeriodDays] = useState<number | "all">(90);
  const [connected, setConnected] = useState<boolean | null>(null);

  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  const checkConnection = useCallback(
    async (isCurrent: () => boolean) => {
      if (!organizationId) return;

      try {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/integrations`,
        );
        if (!isCurrent()) return;

        if (!response.ok) {
          setConnected(null);
          return;
        }

        const payload = (await response.json()) as {
          providers?: Array<{
            id: string;
            connection?: { id?: string } | null;
          }>;
        };
        setConnected(
          Boolean(
            (payload.providers ?? []).find(
              (provider) => provider.id === "klaviyo",
            )?.connection,
          ),
        );
      } catch {
        if (!isCurrent()) return;
        setConnected(null);
      }
    },
    [organizationId],
  );

  useEffect(() => {
    let current = true;
    void checkConnection(() => current);
    return () => {
      current = false;
    };
  }, [checkConnection]);

  if (!organizationId) {
    return (
      <Card>
        <EmptyState title="Elige un cliente para ver su email marketing." />
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Heading level={2}>Klaviyo</Heading>
            <p className="text-sm text-muted">
              Qué emails salen, qué dicen y qué se puede medir de ellos.
            </p>
          </div>
          <Select
            className="w-full sm:w-40"
            aria-label="Periodo"
            value={String(periodDays)}
            onChange={(value) =>
              setPeriodDays(value === "all" ? "all" : Number(value))
            }
            options={periodOptions.map((option) => ({
              value: String(option.days),
              label: option.label,
            }))}
          />
        </div>
      </Card>

      {connected === false ? (
        <Banner tone="warn" className="text-sm">
          Este cliente no tiene Klaviyo conectado. Se conecta desde{" "}
          <Link href="/integraciones">Integraciones</Link>.
        </Banner>
      ) : null}

      {/* Informe de rendimiento completo. El Dashboard solo muestra sus cuatro
          señales decisivas; campañas, flujos, asuntos y entregabilidad viven
          aquí, en la zona de Analítica. */}
      <KlaviyoEmailPanel
        organizationId={organizationId}
        variant={isConsultant ? "consultant" : "client"}
      />

      <KlaviyoInsightsSections
        organizationId={organizationId}
        connectionId={connectionId}
        periodDays={periodDays}
      />

      {/* Dos agentes y en este orden, por la misma razón que las secciones de
          arriba: primero qué DICEN los emails (que es lo que se puede leer hoy
          aunque no haya envíos), después cómo VAN (que necesita rendimiento). */}
      <AiDiagnosticSection
        organizationId={organizationId}
        title="Contenido de los emails"
        getPath="/ai/contenido-email"
        runPath="/ai/contenido-email-run"
        loadingLabel="Leyendo los asuntos y los cuerpos…"
        tasksLabelSingular="tarea"
        days={30}
        showInternals={isConsultant}
        renderPreview
        // Sin `rendimiento` a proposito: este agente no recibe cifras de
        // rendimiento y su propio prompt le prohibe juzgar con ellas. Darle el
        // area le abriria la puerta a mandar al lector a una tabla que no ha
        // mirado.
        areas={{
          emails: { label: "Ver los emails", href: "#klaviyo-emails" },
          medicion: { label: "Ver medición", href: "#klaviyo-medicion" },
        }}
      />
      <AiDiagnosticSection
        organizationId={organizationId}
        title="Análisis de email"
        getPath="/ai/email-analyst"
        runPath="/ai/email-analyst-run"
        loadingLabel="Revisando el email marketing de esta tienda…"
        tasksLabelSingular="tarea"
        days={30}
        showInternals={isConsultant}
        areas={{
          rendimiento: {
            label: "Ver el rendimiento",
            href: "#klaviyo-rendimiento",
          },
          emails: { label: "Ver los emails", href: "#klaviyo-emails" },
          medicion: { label: "Ver medición", href: "#klaviyo-medicion" },
        }}
      />
      <AiDiagnosticSection
        organizationId={organizationId}
        title="Arquitectura de flujos"
        getPath="/ai/klaviyo-flow-architect"
        runPath="/ai/klaviyo-flow-architect-run"
        loadingLabel="Revisando los flujos y oportunidades de automatización…"
        tasksLabelSingular="tarea"
        days={90}
        showInternals={isConsultant}
      />
    </div>
  );
}

type TriagedKlaviyoAccount = {
  organization_id: string;
  organization_name: string;
  connection_status: string | null;
  last_sync_at: string | null;
  emails_total: number;
  flows_active: number;
  score: number;
  level: "critica" | "alta" | "media" | "estable";
  reasons: Array<{ text: string; weight: number; kind: string }>;
  blind: boolean;
};

const LEVEL_PRESENTATION: Record<
  TriagedKlaviyoAccount["level"],
  { label: string; tone: Tone }
> = {
  critica: { label: "revisar hoy", tone: "danger" },
  alta: { label: "esta semana", tone: "warn" },
  media: { label: "cuando puedas", tone: "neutral" },
  estable: { label: "sin señales", tone: "success" },
};

function syncLabel(iso: string | null) {
  if (!iso) return "sin sincronizar nunca";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "sincronizado hoy";
  if (days === 1) return "sincronizado ayer";
  return `sincronizado hace ${days} días`;
}

/**
 * Cartera del consultor: qué cuenta de email hay que mirar hoy.
 *
 * Como la de /meta y a diferencia de la de /shopify, aquí no hablan los
 * agentes: cada motivo es un hecho contable (ningún flujo activo, ningún email
 * con enlaces etiquetados). Por eso se puede enseñar el porqué de cada puesto
 * sin abrir la cuenta.
 */
function ConsultantAccountsView() {
  const { setOrganizationId } = useActiveOrganization();
  const [ranking, setRanking] = useState<TriagedKlaviyoAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);

  useEffect(() => {
    let current = true;

    void (async () => {
      try {
        const response = await apiFetch("/v1/consultant/klaviyo-accounts");
        if (!current) return;

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(body?.error ?? `HTTP ${response.status}`);
          return;
        }

        const payload = (await response.json()) as {
          ranking: TriagedKlaviyoAccount[];
        };
        setRanking(payload.ranking ?? []);
        setError(null);
      } catch {
        if (!current) return;
        setError("No se pudo cargar la cartera de email.");
      }
    })();

    return () => {
      current = false;
    };
  }, []);

  if (error) {
    return (
      <Card>
        <ErrorBlock>{error}</ErrorBlock>
      </Card>
    );
  }

  if (!ranking) {
    return (
      <Card>
        <LoadingBlock label="Revisando el email de la cartera..." />
      </Card>
    );
  }

  const needsReview = ranking.filter((row) => row.level !== "estable");
  const shown = onlyNeedsReview ? needsReview : ranking;

  return (
    <div className="grid gap-4">
      <Card
        title="Email por cliente"
        description="Ordenado por lo que cuesta no mirarlo."
        actions={
          <Button
            variant={onlyNeedsReview ? "primary" : "secondary"}
            onClick={() => setOnlyNeedsReview((value) => !value)}
          >
            Solo los que piden revisión
          </Button>
        }
      >
        {ranking.length === 0 ? (
          <EmptyState
            title="No hay clientes en tu cartera."
            hint="Los clientes se asignan desde Configuración."
          />
        ) : shown.length === 0 ? (
          <EmptyState title="Ningún cliente pide revisión ahora mismo." />
        ) : (
          <List>
            {shown.map((account, index) => {
              const level = LEVEL_PRESENTATION[account.level];

              return (
                <List.Item
                  key={account.organization_id}
                  as="button"
                  type="button"
                  onClick={() => setOrganizationId(account.organization_id)}
                  className="flex w-full items-start gap-4 py-3 text-left"
                >
                  {/* El puesto solo mientras la lista está entera: con el
                      filtro puesto, un "3" sería el tercero de lo que queda en
                      pantalla, no de la cartera. */}
                  <span className="w-6 shrink-0 pt-0.5 text-sm tabular-nums text-muted">
                    {onlyNeedsReview ? "·" : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={level.tone}>{level.label}</Badge>
                      {/* "No sabemos cómo va" no es lo mismo que "va mal". */}
                      {account.blind ? (
                        <Badge tone="neutral">sin datos fiables</Badge>
                      ) : null}
                      <span className="font-medium">
                        {account.organization_name}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {syncLabel(account.last_sync_at)}
                      {` · ${account.flows_active} flujo${account.flows_active === 1 ? "" : "s"} activo${account.flows_active === 1 ? "" : "s"}`}
                      {` · ${account.emails_total} email${account.emails_total === 1 ? "" : "s"}`}
                    </p>
                    {account.reasons.length ? (
                      <ul className="mt-2 space-y-1">
                        {account.reasons.map((reason) => (
                          <li key={reason.text} className="text-sm">
                            {reason.text}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-muted">
                        Sin nada roto que contar.
                      </p>
                    )}
                  </div>
                </List.Item>
              );
            })}
          </List>
        )}
      </Card>
    </div>
  );
}

function KlaviyoRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  // Sin cliente elegido, el consultor ve la cartera; el cliente final siempre
  // tiene la suya, así que entra directo al módulo.
  if (isConsultant && !organizationId) {
    return <ConsultantAccountsView />;
  }

  return <KlaviyoView bootstrap={bootstrap} />;
}

export default function KlaviyoPage() {
  return (
    <PortalShell title="Klaviyo">
      {(bootstrap) => <KlaviyoRouter bootstrap={bootstrap} />}
    </PortalShell>
  );
}
