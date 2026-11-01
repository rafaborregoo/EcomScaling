"use client";

import { useState } from "react";
import { readApiError } from "@/lib/api-error";
import { channelStyle } from "@/components/marketing-channel";
import {
  linkDraftToCampaign,
  type CampaignItem,
} from "@/hooks/use-campaign-items";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import { EmptyState, Button, ErrorBlock, EYEBROW, SearchableSelect, toast, Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui";
import { fmtDate } from "./format";

/**
 * El otro extremo del hilo: desde la pieza, a que campaña responde.
 *
 * Sin esto un borrador enseña lo que dice pero no para que existe, y dentro de
 * tres semanas nadie recuerda por que se escribio ni contra que se mide.
 */
export function DraftCampaignLink({
  organizationId,
  draft,
  items,
  onChanged,
}: {
  organizationId: string;
  draft: MarketingDraft;
  items: CampaignItem[];
  onChanged: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linked = draft.campaign_item;
  // Solo campañas libres: enlazar una que ya tiene pieza descartaria la otra
  // en silencio, porque el enlace vive en la campaña y es uno a uno.
  const available = items
    .filter((item) => !item.marketing_draft_id && item.status !== "cancelled")
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));

  async function save(itemId: string, draftId: string | null) {
    setBusy(true);
    setError(null);
    try {
      const response = await linkDraftToCampaign(
        organizationId,
        itemId,
        draftId,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success(draftId ? "Pieza enlazada a la campaña" : "Enlace retirado");
      setSelectedId("");
      onChanged();
    } catch {
      setError("No se pudo cambiar el enlace por un error de red. Reintenta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-separator pt-3">
      <p className={EYEBROW}>Campaña a la que sirve</p>
      {error ? (
        <div className="mt-2">
          <ErrorBlock>{error}</ErrorBlock>
        </div>
      ) : null}

      {linked ? (
        <Item size="xs" className="mt-1 px-0">
          <ItemMedia>
            <span aria-hidden className={`size-2 rounded-full ${channelStyle(linked.channel).fill}`} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{linked.title}</ItemTitle>
            <ItemDescription>
              {fmtDate(linked.starts_at)}
              {linked.ends_at ? ` → ${fmtDate(linked.ends_at)}` : ""}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void save(linked.id, null)}
            >
              Desenlazar
            </Button>
          </ItemActions>
        </Item>
      ) : available.length === 0 ? (
        <EmptyState size="sm" title="No hay campañas libres en el calendario" hint="Llévate un plan al calendario desde la pestaña Plan." />
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <SearchableSelect
            className="w-72"
            aria-label="Campaña a la que sirve esta pieza"
            placeholder="Sin campaña"
            emptyText="No hay ninguna campaña con ese nombre."
            showClear
            value={selectedId}
            onChange={setSelectedId}
            options={available.map((item) => ({
              value: item.id,
              label: `${item.title} · ${fmtDate(item.starts_at)}`,
            }))}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !selectedId}
            onClick={() => void save(selectedId, draft.id)}
          >
            Enlazar
          </Button>
        </div>
      )}
    </div>
  );
}
