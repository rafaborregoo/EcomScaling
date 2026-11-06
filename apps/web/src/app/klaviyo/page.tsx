"use client";

import { useState } from "react";
import { useCachedQuery } from "@/lib/use-cached-query";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { PortfolioAttention } from "@/components/portfolio-attention";
import { KlaviyoAnalytics } from "./klaviyo-analytics";
import r from "../shopify/legible.module.css";
import { AiDiagnosticSection, AiSpecialistItem } from "@/components/ai-diagnostic-section";
import { A26_EMAIL_AUDIT } from "@/components/a26-email-audit";
import {
  Accordion,
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
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

function KlaviyoView({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();

  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );
  const organization = bootstrap.memberships.find(
    (membership) => membership.organization_id === organizationId,
  )?.organization;

  if (!organizationId) {
    return (
      <Card>
        <CardContent>
          <EmptyState title="Elige un cliente para ver su email marketing." />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="portal-page grid gap-5 sm:gap-6">
      <section id="analisis-email" aria-label="Análisis del rendimiento de email">
        <AiDiagnosticSection
          key={`a12:${organizationId}:${connectionId ?? "auto"}`}
          organizationId={organizationId}
          connectionIdOverride={connectionId || undefined}
          title="A12 · Rendimiento de email"
          description="Compara el último mes completo con el anterior: campañas, flujos, ingresos atribuidos y entregabilidad. Abrir esta página consulta el análisis guardado."
          getPath="/ai/email-analyst"
          runPath="/ai/email-analyst-run"
          loadingLabel="Cargando el análisis de email de esta tienda…"
          tasksLabelSingular="tarea"
          variant={isConsultant ? "full" : "summary"}
        />
      </section>
      {/* Lo esencial del email: ingresos, tasas, fiabilidad, flujos y asuntos.
          Crear y programar vive en Marketing. */}
      <div className={`nora-min ${r.min}`}>
      <KlaviyoAnalytics
        organizationId={organizationId}
        organizationName={organization?.display_name ?? "Klaviyo"}
        connectionId={connectionId || null}
        isConsultant={isConsultant}
      />
      </div>

      {/* Los especialistas, como en Shopify y Meta: del consultor y plegados. */}
      {isConsultant ? (
      <section id="klaviyo-ia" aria-labelledby="klaviyo-ia-title" className="border-t border-separator pt-4">
      <h2 id="klaviyo-ia-title" className="text-base font-semibold">Análisis de los especialistas IA</h2>
      <Accordion multiple className="mt-1">
      {/* El ancla la usan Marketing y Flows (/klaviyo#revision-contenido-email): abre esta fila. */}
      <AiSpecialistItem
        key={`${organizationId}:${connectionId ?? "auto"}`}
        value="contenido"
        id="revision-contenido-email"
        organizationId={organizationId}
        connectionIdOverride={connectionId}
        {...A26_EMAIL_AUDIT}
      />
      <AiSpecialistItem
        value="flujos"
        organizationId={organizationId}
        title="Arquitectura de flujos"
        getPath="/ai/klaviyo-flow-architect"
        runPath="/ai/klaviyo-flow-architect-run"
        loadingLabel="Revisando los flujos y oportunidades de automatización…"
        tasksLabelSingular="tarea"
        days={60}
        showInternals={isConsultant}
      />
      </Accordion>
      </section>
      ) : null}
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
  const query = useCachedQuery<{ ranking: TriagedKlaviyoAccount[] }>("/v1/consultant/klaviyo-accounts");
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
          <LoadingBlock label="Revisando el email de la cartera..." />
        </CardContent>
      </Card>
    );
  }

  const needsReview = ranking.filter((row) => row.level !== "estable");
  const shown = onlyNeedsReview ? needsReview : ranking;

  return (
    <div className="grid gap-4">
      <PortfolioAttention
        noun="clientes"
        weightLabel="Emails en la cuenta"
        formatWeight={(value) => Math.round(value).toLocaleString("es-ES")}
        onOpen={(id) => setOrganizationId(id)}
        items={ranking.map((account) => ({
          id: account.organization_id,
          name: account.organization_name,
          sub: `${account.emails_total} emails · ${account.flows_active} flows activos`,
          level: account.level,
          score: account.score,
          reasons: account.reasons.map((reason) => reason.text),
          weight: account.emails_total > 0 ? account.emails_total : null,
          blind: account.blind,
        }))}
      />
      <Card>
        <CardHeader>
          <CardTitle>Email por cliente</CardTitle>
          <CardDescription>Ordenado por lo que cuesta no mirarlo.</CardDescription>
          <CardAction><Button
            variant={onlyNeedsReview ? "default" : "secondary"}
            onClick={() => setOnlyNeedsReview((value) => !value)}
          >
            Solo los que piden revisión
          </Button></CardAction>
        </CardHeader>
        <CardContent>
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
                        {/* "No sabemos cómo va" no es lo mismo que "va mal". */}
                        {account.blind ? (
                          <Badge tone="neutral">sin datos fiables</Badge>
                        ) : null}
                        <span>
                          {account.organization_name}
                        </span>
                      </ItemTitle>
                      <ItemDescription>
                        {syncLabel(account.last_sync_at)}
                        {` · ${account.flows_active} flujo${account.flows_active === 1 ? "" : "s"} activo${account.flows_active === 1 ? "" : "s"}`}
                        {` · ${account.emails_total} email${account.emails_total === 1 ? "" : "s"}`}
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
