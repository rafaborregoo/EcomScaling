"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";

/**
 * Campañas del calendario, para el hilo campaña -> pieza -> resultado.
 *
 * El plan de A05 crea items de calendario y el generador crea borradores, y
 * hasta ahora eran dos mundos: no se podia mirar una campaña y ver que piezas
 * la sirven, ni mirar una pieza y saber a que responde. El enlace ya existia
 * en la base (`campaign_calendar_items.marketing_draft_id`) desde la fase 3,
 * sin que nadie lo escribiera nunca.
 */
export type CampaignItem = {
  id: string;
  calendar_id: string;
  title: string;
  description: string | null;
  channel: string;
  status: "planned" | "in_progress" | "published" | "completed" | "cancelled";
  starts_at: string;
  ends_at: string | null;
  marketing_draft_id: string | null;
  /** Campaña real del proveedor, para poder leer lo que atribuyó. */
  meta_campaign_id: string | null;
  klaviyo_campaign_id: string | null;
};

export type CampaignResources = {
  metaCampaigns: Array<{ id: string; name: string }>;
  klaviyoCampaigns: Array<{ id: string; name: string }>;
};

export function useCampaignItems(organizationId: string) {
  const [items, setItems] = useState<CampaignItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!organizationId) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/campaign-planning`,
      );
      if (!response.ok) return;
      const payload = (await response.json()) as { items?: CampaignItem[] };
      setItems(payload.items ?? []);
    } catch {
      // El calendario es contexto: si no carga, Marketing sigue funcionando.
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, isLoading, reload };
}

/**
 * Campañas reales sincronizadas de cada proveedor, para poder decir "esta
 * campaña del calendario es AQUELLA de Klaviyo" y leer lo que atribuyó. El
 * endpoint ya existía (`/campaign-planning/resources`) y nadie lo llamaba.
 */
export function useCampaignResources(organizationId: string) {
  const [resources, setResources] = useState<CampaignResources>({
    metaCampaigns: [],
    klaviyoCampaigns: [],
  });

  useEffect(() => {
    let cancelled = false;
    if (!organizationId) return;
    void apiFetch(
      `/v1/organizations/${organizationId}/campaign-planning/resources`,
    )
      .then(async (response) => {
        if (cancelled || !response.ok) return;
        const payload = (await response.json()) as Partial<CampaignResources>;
        setResources({
          metaCampaigns: payload.metaCampaigns ?? [],
          klaviyoCampaigns: payload.klaviyoCampaigns ?? [],
        });
      })
      .catch(() => {
        // Enlazar el resultado es opcional; sin esto el hilo sigue funcionando
        // hasta la pieza.
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return resources;
}

/** Enlaza (o desenlaza con `draftId: null`) la pieza que sirve a una campaña. */
export async function linkDraftToCampaign(
  organizationId: string,
  itemId: string,
  draftId: string | null,
) {
  return patchCampaignItem(organizationId, itemId, {
    marketingDraftId: draftId,
  });
}

export async function patchCampaignItem(
  organizationId: string,
  itemId: string,
  patch: Record<string, string | null>,
) {
  return apiFetch(
    `/v1/organizations/${organizationId}/campaign-planning/items/${itemId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
}
