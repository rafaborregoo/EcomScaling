"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { MetaInsightsSections } from "./insights-sections";
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

type TriagedMetaAccount = {
  organization_id: string;
  organization_name: string;
  connection_status: string | null;
  last_sync_at: string | null;
  spend: number;
  ad_accounts: number;
  score: number;
  level: "critica" | "alta" | "media" | "estable";
  reasons: Array<{ text: string; weight: number; kind: string }>;
  blind: boolean;
};

const periodOptions: Array<{ days: number | "all"; label: string }> = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "1 año" },
  { days: "all", label: "Todo" },
];

const LEVEL_PRESENTATION: Record<
  TriagedMetaAccount["level"],
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
 * Cartera del consultor: qué cuenta publicitaria hay que mirar hoy.
 *
 * A diferencia del ranking de /shopify, aquí no hablan los agentes: cada motivo
 * es un hecho contable (un píxel apagado, un anuncio rechazado). Por eso se
 * puede enseñar el porqué de cada puesto sin abrir la cuenta.
 */
function ConsultantAccountsView() {
  const { setOrganizationId } = useActiveOrganization();
  const [ranking, setRanking] = useState<TriagedMetaAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);

  useEffect(() => {
    let current = true;

    void (async () => {
      try {
        const response = await apiFetch("/v1/consultant/meta-accounts");
        if (!current) return;

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(body?.error ?? `HTTP ${response.status}`);
          return;
        }

        const payload = (await response.json()) as {
          ranking: TriagedMetaAccount[];
        };
        setRanking(payload.ranking ?? []);
        setError(null);
      } catch {
        if (!current) return;
        setError("No se pudo cargar la cartera de Meta.");
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
        <LoadingBlock label="Revisando las cuentas de la cartera..." />
      </Card>
    );
  }

  const needsReview = ranking.filter((row) => row.level !== "estable");
  const shown = onlyNeedsReview ? needsReview : ranking;

  return (
    <div className="grid gap-4">
      <Card
        title="Cuentas de Meta"
        description="Ordenadas por lo que cuesta no mirarlas."
        actions={
          <Button
            variant={onlyNeedsReview ? "primary" : "secondary"}
            onClick={() => setOnlyNeedsReview((value) => !value)}
          >
            Solo las que piden revisión
          </Button>
        }
      >
        {ranking.length === 0 ? (
          <EmptyState
            title="No hay clientes en tu cartera."
            hint="Los clientes se asignan desde Configuración."
          />
        ) : shown.length === 0 ? (
          <EmptyState title="Ninguna cuenta pide revisión ahora mismo." />
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
                      {/* "No sabemos cómo va" no es lo mismo que "va mal", y
                          el puesto de estas cuentas sale de lo primero. */}
                      {account.blind ? (
                        <Badge tone="neutral">sin datos fiables</Badge>
                      ) : null}
                      <span className="font-medium">
                        {account.organization_name}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {syncLabel(account.last_sync_at)}
                      {account.spend > 0
                        ? ` · ${Math.round(account.spend).toLocaleString("es-ES")} de gasto en 30 días`
                        : " · sin gasto en 30 días"}
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

function MetaAccountView({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const [periodDays, setPeriodDays] = useState<number | "all">(30);

  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  const [connected, setConnected] = useState<boolean | null>(null);

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
            connection?: { id?: string; status?: string } | null;
          }>;
        };
        const meta = (payload.providers ?? []).find(
          (provider) => provider.id === "meta_ads",
        );
        setConnected(Boolean(meta?.connection));
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
        <EmptyState title="Elige un cliente para ver su cuenta de Meta." />
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Heading level={2}>Meta Ads</Heading>
            <p className="text-sm text-muted">
              Qué está funcionando, qué está roto y qué se tocó.
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
          Este cliente no tiene Meta conectado. Se conecta desde{" "}
          <Link href="/integraciones">Integraciones</Link>.
        </Banner>
      ) : null}

      <MetaInsightsSections
        organizationId={organizationId}
        connectionId={connectionId}
        periodDays={periodDays}
        showInternals={isConsultant}
      />

      {/* Los tres especialistas, en el mismo orden que los bloques de arriba y
          por la misma razon: si la medicion esta rota, lo que diga el de
          creatividad describe otra cosa.

          `areas` cierra el circulo: cada hallazgo vuelve al bloque de datos que
          lo prueba. El mapa vive aqui porque esta pagina es la unica que sabe
          que secciones ha montado -- `publicos` solo existe para el consultor,
          y darle esa clave al cliente lo mandaria a un ancla que no esta en su
          version de la pantalla. */}
      <AiDiagnosticSection
        organizationId={organizationId}
        title="Medición y entrega"
        getPath="/ai/medicion-meta"
        runPath="/ai/medicion-meta-run"
        loadingLabel="Comprobando si las cifras se pueden creer…"
        tasksLabelSingular="tarea"
        days={30}
        showInternals={isConsultant}
        areas={{
          medicion: { label: "Ver el píxel", href: "#meta-medicion" },
          aprendizaje: {
            label: "Ver los conjuntos en aprendizaje",
            href: "#meta-aprendizaje",
          },
          general: { label: "Ver la vista general", href: "#meta-general" },
        }}
      />
      <AiDiagnosticSection
        organizationId={organizationId}
        title="Creatividad y subasta"
        getPath="/ai/creatividad-meta"
        runPath="/ai/creatividad-meta-run"
        loadingLabel="Analizando qué pieza funciona y cuál quema presupuesto…"
        tasksLabelSingular="tarea"
        days={30}
        showInternals={isConsultant}
        areas={{
          creatividades: {
            label: "Ver las creatividades",
            href: "#meta-creatividades",
          },
          reparto: { label: "Ver dónde va el dinero", href: "#meta-reparto" },
          general: { label: "Ver la vista general", href: "#meta-general" },
        }}
      />
      <AiDiagnosticSection
        organizationId={organizationId}
        title="Cambios de la cuenta"
        getPath="/ai/cambios-meta"
        runPath="/ai/cambios-meta-run"
        loadingLabel="Revisando qué se tocó y qué pasó después…"
        tasksLabelSingular="tarea"
        days={30}
        showInternals={isConsultant}
        areas={{
          cambios: { label: "Ver qué se tocó", href: "#meta-cambios" },
          ...(isConsultant
            ? {
                publicos: {
                  label: "Ver los públicos",
                  href: "#meta-publicos",
                },
              }
            : {}),
          general: { label: "Ver la vista general", href: "#meta-general" },
        }}
      />
    </div>
  );
}

function MetaRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  // Sin cliente elegido, el consultor ve la cartera; el cliente final siempre
  // tiene la suya, así que entra directo al módulo.
  if (isConsultant && !organizationId) {
    return <ConsultantAccountsView />;
  }

  return <MetaAccountView bootstrap={bootstrap} />;
}

export default function MetaPage() {
  return (
    <PortalShell title="Meta Ads">
      {(bootstrap) => <MetaRouter bootstrap={bootstrap} />}
    </PortalShell>
  );
}
