"use client";

import { channelStyle } from "@/components/marketing-channel";
import type {
  CampaignItem,
  CampaignResources,
} from "@/hooks/use-campaign-items";
import type {
  KlaviyoAttribution,
  MetaAttribution,
} from "@/hooks/use-attribution-report";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  List,
  type Tone,
} from "@/components/ui";
import { CampaignResultCell } from "./campaign-result-cell";
import { visibleCampaignRows } from "./campaign-thread-rows";
import { fmtDate } from "./format";

const ITEM_STATUS: Record<string, { label: string; tone: Tone }> = {
  planned: { label: "Planificada", tone: "neutral" },
  in_progress: { label: "En curso", tone: "brand" },
  published: { label: "Publicada", tone: "success" },
  completed: { label: "Completada", tone: "success" },
  cancelled: { label: "Cancelada", tone: "danger" },
};

const DRAFT_STATUS: Record<MarketingDraft["status"], { label: string; tone: Tone }> =
  {
    draft: { label: "Borrador", tone: "neutral" },
    pending_approval: { label: "Pendiente", tone: "warn" },
    approved: { label: "Aprobada", tone: "success" },
    rejected: { label: "Rechazada", tone: "danger" },
    published: { label: "Publicada", tone: "success" },
  };

/**
 * El hilo campaña -> pieza.
 *
 * A05 decide QUE lanzar y el generador escribe la pieza, pero hasta ahora no
 * habia ningun sitio donde se vieran juntos: el calendario vivia en
 * Planificacion y las piezas aqui, sin saber unas de otras. Esta lista es el
 * unico punto del producto donde una campaña dice si ya tiene con que salir.
 *
 * Ademas resuelve el problema de que la pestaña abriera vacia: hasta que no
 * pedias una propuesta no habia nada que mirar, aunque el calendario tuviera
 * campañas dentro.
 */
export function CampaignThread({
  organizationId,
  items,
  isLoading,
  drafts,
  klaviyo,
  meta,
  resources,
  onOpenDraft,
  onWritePiece,
  onChanged,
}: {
  organizationId: string;
  items: CampaignItem[];
  isLoading: boolean;
  drafts: MarketingDraft[];
  klaviyo: KlaviyoAttribution | null;
  meta: MetaAttribution | null;
  resources: CampaignResources;
  onOpenDraft: (draftId: string) => void;
  onWritePiece: (item: CampaignItem) => void;
  onChanged: () => void;
}) {
  const draftById = new Map(drafts.map((draft) => [draft.id, draft]));
  const visible = visibleCampaignRows(items);
  const withoutPiece = visible.filter((item) => !item.marketing_draft_id).length;

  return (
    <Card
      title="Campañas en el calendario"
      description="Qué hay que sacar y con qué. Una campaña sin pieza es una fecha sin nada que publicar."
      actions={
        withoutPiece > 0 ? (
          <Badge tone="warn">{withoutPiece} sin pieza</Badge>
        ) : visible.length > 0 ? (
          <Badge tone="success">Todas con pieza</Badge>
        ) : undefined
      }
    >
      {isLoading ? (
        <LoadingBlock label="Cargando el calendario…" />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Sin campañas activas"
          hint="Propón un plan arriba y llévalo al calendario, o créalas desde Planificación."
        />
      ) : (
        <List as="ul">
          {visible.map((item) => {
            const style = channelStyle(item.channel);
            const status = ITEM_STATUS[item.status] ?? ITEM_STATUS.planned;
            const piece = item.marketing_draft_id
              ? draftById.get(item.marketing_draft_id)
              : undefined;
            return (
              <List.Item
                as="li"
                key={item.id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <span
                  aria-hidden
                  className={`h-8 w-1 shrink-0 ${style.fill}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {item.title}
                  </span>
                  <span className="block text-xs text-muted">
                    {style.label} · {fmtDate(item.starts_at)}
                    {item.ends_at ? ` → ${fmtDate(item.ends_at)}` : ""}
                  </span>
                </span>
                <Badge tone={status.tone}>{status.label}</Badge>
                {piece ? (
                  <span className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenDraft(piece.id)}
                    >
                      {piece.template_name || piece.subject || "Ver la pieza"}
                    </Button>
                    <Badge tone={DRAFT_STATUS[piece.status].tone}>
                      {DRAFT_STATUS[piece.status].label}
                    </Badge>
                  </span>
                ) : item.marketing_draft_id ? (
                  // Enlazada a un borrador que ya no esta en las ultimas 50.
                  <span className="text-xs text-muted">Pieza archivada</span>
                ) : (
                  <Button size="sm" onClick={() => onWritePiece(item)}>
                    Escribir la pieza
                  </Button>
                )}
                <CampaignResultCell
                  organizationId={organizationId}
                  item={item}
                  klaviyo={klaviyo}
                  meta={meta}
                  resources={resources}
                  onChanged={onChanged}
                />
              </List.Item>
            );
          })}
        </List>
      )}
    </Card>
  );
}
