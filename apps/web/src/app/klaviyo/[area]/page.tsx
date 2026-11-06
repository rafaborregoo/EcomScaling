"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { Badge, DataTable, EmptyState, ErrorBlock, Heading, LoadingBlock, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { withPortalRouteContext } from "@/lib/portal-route-context";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { useMarketingDrafts } from "@/hooks/use-marketing-drafts";
import { AudiencesView } from "@/app/marketing/audiences-view";
import { FlowsView } from "@/app/marketing/flows-view";
import { TemplatesView } from "@/app/marketing/templates-view";
import { useKlaviyoWorkspace, type KCampaign } from "@/app/marketing/klaviyo-workspace";
import { KlaviyoFormsView } from "../formularios-view";

const AREA_LABELS: Record<string, string> = {
  campanas: "Campañas",
  flows: "Flows",
  plantillas: "Plantillas",
  audiencias: "Audiencias",
  formularios: "Formularios",
};

const STATUS_LABEL: Record<string, string> = { draft: "Borrador", sent: "Enviada", sending: "Enviando", scheduled: "Programada", queued: "En cola", cancelled: "Cancelada", canceled: "Cancelada" };
const CHANNEL_LABEL: Record<string, string> = { email: "Email", sms: "SMS", push: "Push", mobile_push: "Push" };

function count(value: number | undefined) {
  return Math.round(value ?? 0).toLocaleString("es-ES");
}

function CampaignsView({ campaigns, connected, currency, campaignHref }: { campaigns: KCampaign[]; connected: boolean; currency: string; campaignHref: (id: string) => string }) {
  return (
    <div className="grid gap-5">
      <header className="grid gap-1">
        <p className="text-sm font-medium text-muted">Klaviyo · Envíos</p>
        <Heading size="lg">Campañas</Heading>
        <p className="text-base text-muted">Campañas remotas y sus resultados atribuidos por Klaviyo.</p>
      </header>
      {!connected ? <Card>
        <CardContent><EmptyState title="Conecta Klaviyo para ver sus campañas." /></CardContent>
      </Card> : campaigns.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Campañas de Klaviyo</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              ariaLabel="Campañas de Klaviyo"
              rows={campaigns}
              searchPlaceholder="Buscar campaña o asunto…"
              columns={[
                { key: "name", label: "Campaña", value: (campaign) => `${campaign.name} ${campaign.subject ?? ""}`, render: (campaign) => <><Link className="font-semibold underline underline-offset-4" href={campaignHref(campaign.id)}>{campaign.name}</Link><span className="block text-sm text-muted">{campaign.subject || "Sin asunto"}</span><Link className="text-sm underline underline-offset-4" href={campaignHref(campaign.id)}>Ver email, resultados y valoración</Link></> },
                { key: "status", label: "Estado", render: (campaign) => <Badge tone={campaign.status?.toLowerCase().includes("sent") ? "success" : "neutral"}>{campaign.status ? (STATUS_LABEL[campaign.status.toLowerCase()] ?? campaign.status) : "Sin estado"}</Badge> },
                { key: "channel", label: "Canal", render: (campaign) => (campaign.channel ? (CHANNEL_LABEL[campaign.channel.toLowerCase()] ?? campaign.channel) : "—") },
                { key: "recipients", label: "Destinatarios", align: "end", value: (campaign) => campaign.stats?.recipients, render: (campaign) => count(campaign.stats?.recipients) },
                { key: "clicks", label: "Clics", align: "end", value: (campaign) => campaign.stats?.clicks_unique, render: (campaign) => count(campaign.stats?.clicks_unique) },
                { key: "revenue", label: "Ingresos atribuidos", align: "end", value: (campaign) => campaign.stats?.revenue, render: (campaign) => (campaign.stats?.revenue == null ? "—" : new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 0, useGrouping: "always" }).format(campaign.stats.revenue)) },
              ]}
            />
          </CardContent>
        </Card>
      ) : <Card>
        <CardContent><EmptyState title="No hay campañas sincronizadas." /></CardContent>
      </Card>}
    </div>
  );
}

function KlaviyoArea({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const params = useParams<{ area: string }>();
  const router = useRouter();
  const area = params.area;
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const membership = bootstrap.memberships.find((item) => item.organization_id === organizationId);
  const canViewDrafts = ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role) || ["owner", "manager"].includes(membership?.role ?? "");
  const workspaceQuery = useKlaviyoWorkspace(organizationId, 90, connectionId || null);
  const workspace = workspaceQuery.data;
  const drafts = useMarketingDrafts(organizationId, canViewDrafts, connectionId || null);
  const label = AREA_LABELS[area];
  const openMarketing = (href: string) => router.push(withPortalRouteContext(href, organizationId, connectionId));

  if (!label) return <Card>
    <CardContent><EmptyState title="Esta sección de Klaviyo no existe." /></CardContent>
  </Card>;
  if (!organizationId) return <Card>
    <CardContent><EmptyState title="Elige un cliente para consultar Klaviyo." /></CardContent>
  </Card>;
  if (workspaceQuery.isLoading && !workspace) return <LoadingBlock label={`Cargando ${label.toLowerCase()} de Klaviyo…`} />;
  if (workspaceQuery.error) return <Card>
    <CardContent><ErrorBlock>{workspaceQuery.error}</ErrorBlock></CardContent>
  </Card>;

  if (area === "campanas") return <CampaignsView campaigns={workspace?.campaigns ?? []} connected={Boolean(workspace?.connected)} currency={workspace?.account?.currency || "EUR"} campaignHref={(id) => withPortalRouteContext(`/klaviyo/campanas/${id}`, organizationId, connectionId)} />;
  if (area === "flows") return <FlowsView organizationId={organizationId} workspace={workspace} drafts={drafts.drafts} basePath="/klaviyo/flows" isConsultant={["platform_admin", "consultant"].includes(bootstrap.profile.platform_role)} onOpenPiece={() => openMarketing("/marketing?section=contenido")} onNewPiece={() => openMarketing("/marketing?section=crear")} />;
  if (area === "plantillas") return <TemplatesView organizationId={organizationId} workspace={workspace} drafts={drafts.drafts} onOpenDraft={() => openMarketing("/marketing?section=contenido")} onCreate={() => openMarketing("/marketing?section=crear")} onChanged={drafts.reload} />;
  if (area === "audiencias") return <AudiencesView workspace={workspace} />;
  return <KlaviyoFormsView workspace={workspace} />;
}

export default function KlaviyoAreaPage() {
  return (
    <PortalShell title="Klaviyo">
      {(bootstrap) => <div className="nora-min"><Suspense fallback={<LoadingBlock label="Cargando Klaviyo…" />}><KlaviyoArea bootstrap={bootstrap} /></Suspense></div>}
    </PortalShell>
  );
}
