"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import type { TemplateDesign } from "@/app/marketing/template-design";

/**
 * Carga de borradores de marketing, fuera del componente de pagina.
 *
 * Vive aqui por dos razones. La primera es que `/marketing` era un unico
 * componente de ~2.000 lineas con 51 `useState`, y el React Compiler dejaba de
 * optimizarlo entero: no podia preservar la memoizacion de este `useCallback`.
 * Un hook pequeño se analiza solo. La segunda es que la lista de borradores es
 * el estado que comparten las tres pestañas del modulo (crear escribe en ella,
 * contenido la lee, rendimiento la ignora), asi que tiene que ser una sola
 * fuente y no copias por seccion.
 */
export type MarketingDraft = {
  id: string;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "published";
  content_type: "campaign" | "flow_step" | "popup";
  request: {
    channel?: string;
    content_type?: string;
    brief?: string;
    design?: TemplateDesign;
    source?: string;
    klaviyo_template_id?: string;
  } | null;
  summary: string;
  template_name: string;
  subject: string;
  preheader: string;
  from_name: string;
  reply_to: string | null;
  purpose: string;
  audience: string;
  locale: string;
  tone: string;
  plain_text: string;
  html: string;
  blocks: unknown[];
  personalization_tokens: string[];
  compliance_notes: string[];
  sources: unknown[];
  confidence: "low" | "medium" | "high";
  warnings: string[];
  version: number;
  created_at: string;
  updated_at: string;
  scheduled_for: string | null;
  decision_reason: string | null;
  /**
   * Campaña del calendario a la que sirve esta pieza. La resuelve el backend
   * en la misma llamada (el enlace vive en `campaign_calendar_items`), para
   * que la lista no tenga que preguntar una vez por borrador.
   */
  campaign_item: {
    id: string;
    title: string;
    channel: string;
    starts_at: string;
    ends_at: string | null;
    status: string;
  } | null;
};

export function useMarketingDrafts(organizationId: string, canView: boolean) {
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!organizationId || !canView) {
      setDrafts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as {
        drafts?: MarketingDraft[];
      };
      setDrafts(payload.drafts ?? []);
    } catch {
      setError(
        "No se pudieron cargar los borradores por un error de red. Reintenta.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [canView, organizationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { drafts, isLoading, error, setError, reload };
}
