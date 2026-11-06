"use client";

import { useCallback, useState } from "react";
import { useCachedQuery } from "@/lib/use-cached-query";
import type { TemplateDesign } from "@/app/marketing/template-design";
import type { StudioDesign } from "@/app/marketing/studio/studio-design";
import type { PieceThread } from "@/app/marketing/piece-analysis";
import type { RealMarketingLab, MarketingSpecialistTrace } from "@/app/marketing/model-comparison";

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
    ai_lab?: RealMarketingLab;
    lab_original_output?: Record<string, unknown>;
    specialist_pipeline?: MarketingSpecialistTrace;
    overlay_composition?: {
      overlay_id: string;
      revision: string;
      preview_error?: string;
      assets: Array<{ url: string; alt_text?: string; slide_index: number }>;
    };
    /** Versión 1: editor anterior. Versión 2: estudio de contenido. */
    design?: TemplateDesign | StudioDesign;
    template_profile?: Record<string, unknown>;
    source?: string;
    klaviyo_template_id?: string;
    store_id?: string | null;
    camino_task?: {
      task_id: string;
      title: string;
      description: string | null;
      categories: string[];
      milestone_id: string | null;
      milestone_name: string | null;
      milestone_target_date: string | null;
    };
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
  /**
   * Resumen del hilo de la pieza (cuántos mensajes y quién habló el último).
   * Lo resuelve el backend en la misma llamada para que la rejilla pueda
   * encender el icono de mensaje sin abrir las piezas una por una.
   */
  thread: PieceThread | null;
  template_performance?: {
    measured_entities: number;
    delivered: number;
    opens_unique: number;
    clicks_unique: number;
    conversions: number;
    revenue: number;
    currency_code: string | null;
    unsubscribes: number;
    last_sent_at: string | null;
  } | null;
};

export function useMarketingDrafts(
  organizationId: string,
  canView: boolean,
  connectionId?: string | null,
) {
  const [manualError, setManualError] = useState<string | null>(null);
  const key =
    organizationId && canView
      ? `/v1/organizations/${organizationId}/marketing/drafts${connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ""}`
      : null;
  const query = useCachedQuery<{ drafts?: MarketingDraft[] }>(key);

  const reload = useCallback(() => {
    setManualError(null);
    query.reload();
  }, [query.reload]);

  return {
    drafts: query.data?.drafts ?? [],
    isLoading: query.isLoading,
    loadError: query.error,
    error: manualError ?? query.error,
    setError: setManualError,
    reload,
  };
}
