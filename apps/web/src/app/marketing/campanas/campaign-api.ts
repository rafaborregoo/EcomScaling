"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CampaignBrief,
  ClientCampaignSummary,
  PortfolioCampaignTotals,
  SentRollup,
} from "@e-nora/contracts";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";

/**
 * Lo que la pantalla de Campañas lee y escribe de la API: la lectura del
 * consultor (cartera, cliente, tienda), el hilo de revisión de cada campaña y
 * la edición con IA. Las reglas (estados, titulares, quién puede qué) viven en
 * `@e-nora/contracts` y en la API; aquí solo se llama.
 */

export type SentCampaign = {
  organization_id: string;
  organization_name: string;
  campaign_id: string;
  name: string;
  sent_at: string;
  delivered: number;
  open_rate: number | null;
  click_rate: number | null;
  revenue: number | null;
  currency_code: string | null;
  store_id: string | null;
  top_link: { url: string; clicks: number } | null;
};

export type ReviewQueueRow = {
  item_id: string;
  organization_id: string;
  organization_name: string;
  title: string;
  channel: string;
  starts_at: string;
  review_status: "pending" | "changes_requested";
  review_requested_at: string | null;
  open_corrections: number;
};

export type StoreCampaignSummary = {
  store_id: string;
  connection_id: string | null;
  label: string;
  week: CampaignBrief[];
  late: number;
  awaiting_review: number;
  no_piece_soon: number;
  last_week: SentRollup;
};

export type CampaignsOverview = {
  level: "portfolio" | "client" | "store";
  organization_id: string | null;
  store_id: string | null;
  generated_at: string;
  currency_code: string | null;
  headline: { title: string; detail: string };
  clients: ClientCampaignSummary[];
  totals: PortfolioCampaignTotals;
  reviews: ReviewQueueRow[];
  last_week_sends: SentCampaign[];
  items?: CampaignBrief[];
  stores?: StoreCampaignSummary[];
  truncated: boolean;
};

/** GET /v1/consultant/campaigns/overview: cartera sin cliente, un cliente, o una tienda. */
export function useCampaignsOverview(organizationId: string | null, connectionId: string | null) {
  const params = new URLSearchParams();
  if (organizationId) params.set("organizationId", organizationId);
  if (organizationId && connectionId) params.set("connectionId", connectionId);
  const query = params.toString();
  return useCachedQuery<CampaignsOverview>(`/v1/consultant/campaigns/overview${query ? `?${query}` : ""}`);
}

// ---------------------------------------------------------------------------
// Hilo de revisión
// ---------------------------------------------------------------------------

export type NoteKind = "note" | "correction" | "ai_proposal" | "system";
export type NoteTarget =
  | "subject"
  | "preheader"
  | "body"
  | "cta"
  | "schedule"
  | "audience"
  | "creative"
  | "flow"
  | "other";

export const TARGET_LABEL: Record<NoteTarget, string> = {
  subject: "Asunto",
  preheader: "Preheader",
  body: "Texto",
  cta: "Botón",
  schedule: "Fecha",
  audience: "Audiencia",
  creative: "Creativo",
  flow: "Flow",
  other: "Otro",
};

export type EditField =
  | "subject"
  | "preheader"
  | "body"
  | "headline"
  | "description"
  | "primary_text"
  | "destination_url"
  | "starts_at";

export type ProposedEdit = {
  field: EditField;
  label: string;
  was: string;
  now: string;
  why: string;
  state: "open" | "applied" | "dismissed";
};

export type ThreadNote = {
  id: string;
  source: "campaign" | "draft";
  kind: NoteKind;
  author_kind: string;
  author_user_id: string | null;
  author_name: string | null;
  target: NoteTarget | null;
  body: string;
  visible_to_client: boolean;
  payload: { edits?: ProposedEdit[]; piece_kind?: string } | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type ThreadPayload = {
  item: {
    id: string;
    title: string;
    origin: "staff" | "client" | "ai";
    review_status: "pending" | "changes_requested" | "reviewed" | null;
    marketing_draft_id: string | null;
    store_id: string | null;
    /** Conexion de la tienda de la campaña: la usa el selector de tienda del shell. */
    store_connection_id: string | null;
  };
  notes: ThreadNote[];
  open_corrections: number;
};

export type Outcome<T = void> = { ok: true; data: T } | { ok: false; error: string };

const base = (organizationId: string, itemId: string) =>
  `/v1/organizations/${organizationId}/campaign-planning/items/${itemId}`;

export async function send<T>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<Outcome<T>> {
  try {
    const response = await apiFetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) return { ok: false, error: await readApiError(response) };
    return { ok: true, data: (await response.json().catch(() => ({}))) as T };
  } catch {
    return { ok: false, error: "No se pudo completar por un error de red. Reintenta." };
  }
}

export function useCampaignThread(organizationId: string, itemId: string | null) {
  const [thread, setThread] = useState<ThreadPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(itemId));

  const reload = useCallback(async () => {
    if (!itemId || !organizationId) return;
    try {
      const response = await apiFetch(`${base(organizationId, itemId)}/thread`);
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setThread((await response.json()) as ThreadPayload);
      setError(null);
    } catch {
      setError("No se pudo cargar el hilo por un error de red.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, itemId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del hilo al abrir la campaña
    void reload();
  }, [reload]);

  return { thread, error, loading, reload };
}

export const postThreadNote = (
  organizationId: string,
  itemId: string,
  input: { body: string; kind: "note" | "correction"; target?: NoteTarget | null; visibleToClient: boolean },
) => send(`${base(organizationId, itemId)}/thread`, "POST", input);

export const resolveThreadNote = (organizationId: string, itemId: string, noteId: string) =>
  send(`${base(organizationId, itemId)}/thread/${noteId}/resolve`, "POST", {});

export const setCampaignReview = (
  organizationId: string,
  itemId: string,
  status: "reviewed" | "changes_requested",
  message?: string,
) => send<{ review_status: string }>(`${base(organizationId, itemId)}/review`, "POST", { status, message });

export const requestCampaignReview = (organizationId: string, itemId: string) =>
  send<{ review_status: string }>(`${base(organizationId, itemId)}/review/request`, "POST", {});

export type EditProposal = { note_id: string; answer: string; edits: ProposedEdit[]; piece_kind: string };

export const proposeAiEdit = (organizationId: string, itemId: string, instruction: string) =>
  send<EditProposal>(`${base(organizationId, itemId)}/ai-edit`, "POST", { instruction });

export const applyAiEdit = (
  organizationId: string,
  itemId: string,
  noteId: string,
  input: { fields?: EditField[]; dismiss?: boolean },
) => send<{ applied: EditField[]; dismissed: EditField[]; resolution: string | null }>(
  `${base(organizationId, itemId)}/ai-edit/${noteId}/apply`,
  "POST",
  input,
);

export const createClientCampaign = (
  organizationId: string,
  input: {
    title: string;
    channel: string;
    startsAt: string;
    description: string | null;
    storeId?: string | null;
  },
) =>
  send<{ id: string }>(`/v1/organizations/${organizationId}/campaign-planning/items`, "POST", {
    ...input,
    itemType: "campaign",
  });

export const patchDraft = (organizationId: string, draftId: string, patch: Record<string, string | null>) =>
  send(`/v1/organizations/${organizationId}/marketing/drafts/${draftId}`, "PATCH", patch);

export const decideDraft = (organizationId: string, draftId: string, decision: "approved" | "rejected", reason?: string) =>
  send(`/v1/organizations/${organizationId}/marketing/drafts/${draftId}/decision`, "POST", { decision, reason });

export const submitDraft = (organizationId: string, draftId: string) =>
  send(`/v1/organizations/${organizationId}/marketing/drafts/${draftId}/submit`, "POST");
