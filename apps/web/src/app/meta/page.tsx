"use client";

import { useCallback, useEffect, useState } from "react";
import { useCachedQuery } from "@/lib/use-cached-query";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { useAssignedConsultant } from "@/hooks/use-assigned-consultant";
import { ClientMeta } from "../dashboard/client-meta";
import { ChannelBand } from "../dashboard/channel-band";
import { MetaTrustStrip } from "./trust-strip";
import r from "../shopify/legible.module.css";
import { PortfolioAttention } from "@/components/portfolio-attention";
import { AiSpecialistItem } from "@/components/ai-diagnostic-section";
import {
  Accordion,
  Badge,
  Banner,
  Button,
  EmptyState,
  ErrorBlock,
  Link,
  List,
  LoadingBlock,
  type Tone,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
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

const PERIODS: Array<number | "all"> = [7, 30, 90, 180, 365, "all"];

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
  const query = useCachedQuery<{ ranking: TriagedMetaAccount[] }>("/v1/consultant/meta-accounts");
  const ranking = query.data ? (query.data.ranking ?? []) : null;
  const error = query.error;
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);

  if (error) {
    return (
      <Card>
        <CardContent>
          <ErrorBlock>{error}</ErrorBlock>
        </CardContent>
      </Card>
    );
  }

  if (!ranking) {
    return (
      <Card>
        <CardContent>
          <LoadingBlock label="Revisando las cuentas de la cartera..." />
        </CardContent>
      </Card>
    );
  }

  const needsReview = ranking.filter((row) => row.level !== "estable");
  const shown = onlyNeedsReview ? needsReview : ranking;

  return (
    <div className="grid gap-4">
      <PortfolioAttention
        noun="cuentas"
        weightLabel="Gasto en Meta"
        formatWeight={(value) => `${Math.round(value).toLocaleString("es-ES")} €`}
        onOpen={(id) => setOrganizationId(id)}
        items={ranking.map((account) => ({
          id: account.organization_id,
          name: account.organization_name,
          sub: `Gasto ${Math.round(account.spend).toLocaleString("es-ES")} € · ${syncLabel(account.last_sync_at)}`,
          level: account.level,
          score: account.score,
          reasons: account.reasons.map((reason) => reason.text),
          weight: account.spend > 0 ? account.spend : null,
          blind: account.blind,
        }))}
      />
      <Card>
        <CardHeader>
          <CardTitle>Cuentas de Meta</CardTitle>
          <CardDescription>Ordenadas por lo que cuesta no mirarlas.</CardDescription>
          <CardAction><Button
            variant={onlyNeedsReview ? "default" : "secondary"}
            onClick={() => setOnlyNeedsReview((value) => !value)}
          >
            Solo las que piden revisión
          </Button></CardAction>
        </CardHeader>
        <CardContent>
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
                  <Item
                    key={account.organization_id}
                    role="listitem"
                    className="flex-nowrap items-start"
                    render={<button type="button" onClick={() => setOrganizationId(account.organization_id)} />}
                  >
                    {/* El puesto solo mientras la lista está entera: con el
                        filtro puesto, un "3" sería el tercero de lo que queda en
                        pantalla, no de la cartera. */}
                    <ItemMedia className="w-6 pt-0.5 text-sm tabular-nums text-muted">
                      {onlyNeedsReview ? "·" : index + 1}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        <Badge tone={level.tone}>{level.label}</Badge>
                        {/* "No sabemos cómo va" no es lo mismo que "va mal", y
                            el puesto de estas cuentas sale de lo primero. */}
                        {account.blind ? (
                          <Badge tone="neutral">sin datos fiables</Badge>
                        ) : null}
                        <span>
                          {account.organization_name}
                        </span>
                      </ItemTitle>
                      <ItemDescription>
                        {syncLabel(account.last_sync_at)}
                        {account.spend > 0
                          ? ` · ${Math.round(account.spend).toLocaleString("es-ES")} de gasto en 30 días`
                          : " · sin gasto en 30 días"}
                      </ItemDescription>
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
                    </ItemContent>
                  </Item>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetaAccountView({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const [periodDays, setPeriodDays] = useState<number | "all">(30);
  const { consultant } = useAssignedConsultant(organizationId ?? null);

  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );
  const organization = bootstrap.memberships.find(
    (membership) => membership.organization_id === organizationId,
  )?.organization;

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
        <CardContent>
          <EmptyState title="Elige un cliente para ver su cuenta de Meta." />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="portal-page nora-min grid gap-5 sm:gap-6">
      <ChannelBand
        eyebrow="Tu publicidad en Facebook e Instagram"
        title={organization?.display_name ?? "Meta Ads"}
      />
      {connected === false ? (
        <Banner tone="warn" className="text-sm">
          Este cliente no tiene Meta conectado. Se conecta desde{" "}
          <Link href="/integraciones">Integraciones</Link>.
        </Banner>
      ) : null}

      <div className={`nora-min ${r.min}`}>
      <ClientMeta
        organizationId={organizationId}
        organizationName={organization?.display_name ?? "Meta Ads"}
        connectionId={connectionId || null}
        userId={bootstrap.user.id}
        consultant={consultant}
        asConsultant={isConsultant}
        days={periodDays}
        onDaysChange={setPeriodDays}
        periods={PERIODS}
        hideFullLink
        afterHero={
          <MetaTrustStrip
            organizationId={organizationId}
            connectionId={connectionId || null}
            days={periodDays}
          />
        }
      />
      </div>

      {/* Los dos especialistas, en el mismo orden que los bloques de arriba y
          por la misma razon: si la medicion esta rota, lo que diga el de
          creatividad describe otra cosa.

          `areas` cierra el circulo: cada hallazgo vuelve al bloque de datos que
          lo prueba. */}
      {isConsultant ? (
      <section id="meta-ia" aria-labelledby="meta-ia-title" className="border-t border-separator pt-4">
      <h2 id="meta-ia-title" className="text-base font-semibold">Análisis de los especialistas IA</h2>
      <Accordion multiple className="mt-1">
      <AiSpecialistItem
        value="medicion"
        organizationId={organizationId}
        title="Medición y entrega"
        getPath="/ai/medicion-meta"
        runPath="/ai/medicion-meta-run"
        loadingLabel="Comprobando si las cifras se pueden creer…"
        tasksLabelSingular="tarea"
        days={30}
        showInternals={isConsultant}
        areas={{
          medicion: { label: "Ver el píxel", href: "#meta-measure" },
          general: { label: "Ver la fiabilidad de las cifras", href: "#meta-medicion" },
          aprendizaje: { label: "Ver el estado de aprendizaje", href: "#meta-medicion" },
        }}
      />
      <AiSpecialistItem
        value="creatividad"
        organizationId={organizationId}
        title="Creatividad y subasta"
        description="Revisa anuncios y piezas de Meta en la tienda seleccionada durante los últimos 30 días completos. El análisis se prepara en el ciclo automático cuando hay una cuenta conectada y sincronizada; también puedes actualizarlo desde aquí. Las propuestas requieren revisión del consultor."
        getPath="/ai/creatividad-meta"
        runPath="/ai/creatividad-meta-run"
        loadingLabel="Analizando qué pieza funciona y cuál quema presupuesto…"
        tasksLabelSingular="tarea"
        days={30}
        showInternals={isConsultant}
        areas={{
          creatividades: {
            label: "Ver las creatividades",
            href: "#meta-ads",
          },
          reparto: { label: "Ver dónde va el dinero", href: "#meta-ads" },
          general: { label: "Ver la fiabilidad de las cifras", href: "#meta-medicion" },
        }}
      />
      <AiSpecialistItem
        value="cambios"
        organizationId={organizationId}
        title="Cambios y públicos"
        getPath="/ai/cambios-meta"
        runPath="/ai/cambios-meta-run"
        loadingLabel="Revisando los cambios de la cuenta y la cobertura de sus públicos…"
        tasksLabelSingular="tarea"
        days={30}
        showInternals={isConsultant}
        areas={{
          cambios: { label: "Ver la actividad de Meta", href: "#meta-ads" },
          publicos: { label: "Revisar este análisis", href: "#meta-ia" },
          general: { label: "Ver la fiabilidad de las cifras", href: "#meta-measure" },
        }}
      />
      </Accordion>
      </section>
      ) : null}
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
