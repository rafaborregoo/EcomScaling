"use client";

import { useEffect } from "react";
import type { CampaignItem } from "@/hooks/use-campaign-items";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import { useActiveConnection } from "@/components/active-connection";
import { Button, LoadingBlock } from "@/components/ui";
import type { CampaignRow } from "./campaign-rows";
import type { KWorkspace } from "./klaviyo-workspace";
import { useCampaignThread } from "./campanas/campaign-api";
import { CampaignWorkspace } from "./campanas/campaign-workspace";
import type { CampaignsNav } from "./campanas/campanas-nav";
import { ClientCampaigns } from "./campanas/client-campaigns";
import { ClientView } from "./campanas/client-view";
import { Stage } from "./campanas/campanas-parts";
import { QuickActionsManager } from "./campanas/quick-actions-manager";
import { StoreCampaigns } from "./campanas/store-campaigns";

/**
 * Marketing -> Campañas de UN cliente (las del consultor sin cliente elegido
 * viven en `campanas/portfolio-campaigns.tsx`).
 *
 * Una sola entrada que decide qué pantalla toca:
 *
 *   campaña abierta (?campaign=)            -> la campaña, a pantalla completa
 *   cliente (su propia paleta)              -> sus campañas y lo que le toca aprobar
 *   consultor con cliente, sin tienda       -> mini resumen de sus tiendas y campañas
 *   consultor con cliente y tienda          -> calendario y cola de esa tienda
 *
 * Las reglas de estado, los titulares y quién puede qué no se calculan aquí:
 * viven en `@e-nora/contracts` y en la API.
 */
export type CampaignsViewProps = {
  rows: CampaignRow[];
  workspace: KWorkspace | undefined;
  organizationId: string;
  organizationName: string;
  connectionId: string;
  viewer: "consultant" | "client";
  viewerUserId: string;
  /** null = todavía no se sabe (el cliente lo conoce al cargar su agenda). */
  hasConsultant: boolean | null;
  campaignId: string | null;
  /** Gestor de acciones rápidas (`?acciones=1`); solo para el consultor. */
  quickActions: boolean;
  itemsLoading: boolean;
  nav: CampaignsNav;
  onOpenRow: (row: CampaignRow) => void;
  onOpenDraft: (draftId: string) => void;
  onReviewPlan: () => void;
  onOpenMetaCampaign: (campaignId: string) => void;
  onPropose: () => void;
  onCreate: () => void;
  onOpenAgenda: () => void;
  onChanged: () => void;
  onOpenStudio: (draft: MarketingDraft) => void;
  onWritePiece: (item: CampaignItem) => void;
  onWriteWithAi: (itemId: string) => void;
};

export function CampaignsView(props: CampaignsViewProps) {
  if (props.campaignId) return <OpenCampaign {...props} campaignId={props.campaignId} />;
  if (props.quickActions && props.viewer === "consultant" && props.organizationId) {
    return (
      <QuickActionsManager
        organizationId={props.organizationId}
        organizationName={props.organizationName}
        workspace={props.workspace}
        nav={props.nav}
      />
    );
  }
  if (props.viewer === "client") {
    if (props.hasConsultant === null) {
      return (
        <Stage client>
          <LoadingBlock label="Cargando tus campañas…" />
        </Stage>
      );
    }
    return (
      <ClientView
        rows={props.rows}
        organizationId={props.organizationId}
        organizationName={props.organizationName}
        hasConsultant={props.hasConsultant}
        workspace={props.workspace}
        nav={props.nav}
        onChanged={props.onChanged}
        onWriteWithAi={props.onWriteWithAi}
        onPropose={props.onPropose}
      />
    );
  }
  if (!props.connectionId) {
    return (
      <ClientCampaigns
        organizationId={props.organizationId}
        organizationName={props.organizationName}
        nav={props.nav}
        onPropose={props.onPropose}
        onCreate={props.onCreate}
      />
    );
  }
  return (
    <StoreCampaigns
      rows={props.rows}
      workspace={props.workspace}
      organizationId={props.organizationId}
      organizationName={props.organizationName}
      connectionId={props.connectionId}
      nav={props.nav}
      onOpenRow={props.onOpenRow}
      onOpenDraft={props.onOpenDraft}
      onReviewPlan={props.onReviewPlan}
      onOpenMetaCampaign={props.onOpenMetaCampaign}
      onPropose={props.onPropose}
      onCreate={props.onCreate}
      onOpenAgenda={props.onOpenAgenda}
      onChanged={props.onChanged}
      onWriteWithAi={props.onWriteWithAi}
    />
  );
}

function OpenCampaign(props: CampaignsViewProps & { campaignId: string }) {
  const { rows, campaignId, organizationId, viewer } = props;
  const thread = useCampaignThread(organizationId, campaignId);
  const { connectionId, setConnectionId } = useActiveConnection();
  const row = rows.find((entry) => entry.item?.id === campaignId) ?? null;
  const target = thread.thread?.item.store_connection_id ?? null;
  const staff = viewer === "consultant";

  // El aviso de la campana puede llevar a una campaña de otra tienda que la
  // elegida en el selector: se salta a la suya para que aparezcan su pieza y su Klaviyo.
  useEffect(() => {
    if (!row && target && target !== connectionId) setConnectionId(target);
  }, [row, target, connectionId, setConnectionId]);

  const back = (
    <Button variant="secondary" onClick={props.nav.closeCampaign}>
      Volver a Campañas
    </Button>
  );

  if (!row?.item) {
    const searching = props.itemsLoading || thread.loading || Boolean(target && target !== connectionId);
    return (
      <Stage client={!staff}>
        {searching ? (
          <LoadingBlock label="Abriendo la campaña…" />
        ) : (
          <div className="grid gap-3 py-6">
            <p>{thread.error ?? "Esta campaña ya no está en el calendario."}</p>
            <div>{back}</div>
          </div>
        )}
      </Stage>
    );
  }

  const hasConsultant = staff ? true : props.hasConsultant;
  if (hasConsultant === null) {
    return (
      <Stage client>
        <LoadingBlock label="Abriendo la campaña…" />
      </Stage>
    );
  }
  return (
    <CampaignWorkspace
      organizationId={organizationId}
      organizationName={props.organizationName}
      viewer={viewer}
      viewerUserId={props.viewerUserId}
      hasConsultant={hasConsultant}
      row={row as CampaignRow & { item: CampaignItem }}
      thread={thread}
      workspace={props.workspace}
      nav={props.nav}
      onChanged={props.onChanged}
      onOpenStudio={props.onOpenStudio}
      onWritePiece={props.onWritePiece}
    />
  );
}
