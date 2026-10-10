"use client";

import { useState } from "react";
import type {
  ProfitClientRow,
  ProfitStoreRow,
  ProfitTotals,
} from "@e-nora/contracts";
import { apiFetch, invalidateApiGetCache } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import { toast } from "@/components/ui";

/** Respuesta de GET /v1/consultant/profitability (cartera o un cliente). */
export type ProfitabilityPayload = {
  level: "portfolio" | "client";
  organization_id: string | null;
  period: { days: number; start: string; end: string };
  generated_at: string;
  stores: ProfitStoreRow[];
  clients: ProfitClientRow[];
  totals: ProfitTotals;
  monthly: Array<{ month: string; revenue: number; profit: number }>;
  failed_stores: Array<{ store_id: string; shop_name: string }>;
  truncated: boolean;
  /** Estado y ultimo sync de cada conexion por cliente (sin cuentas ni errores). */
  connections?: Array<{ organization_id: string; provider: string; status: string; last_sync_at: string | null }>;
};

export function useProfitability(days: number, organizationId: string | null) {
  const org = organizationId ? `&organizationId=${encodeURIComponent(organizationId)}` : "";
  return useCachedQuery<ProfitabilityPayload>(
    `/v1/consultant/profitability?days=${days}${org}`,
  );
}

/** Lectura A02 del panel: escrita para el consultor, nunca la del cliente. */
export type PanelReading = {
  generated_at: string;
  stale?: boolean;
  output: { headline?: string; answer?: string };
};

/** A02 solo guarda lecturas de 7, 30 y 90 días: el selector de 1 año no tiene lectura. */
const READING_DAYS = [30, 90];

export function usePanelReading({
  organizationId,
  connectionId,
  days,
}: {
  organizationId: string;
  connectionId: string | null;
  days: number;
}) {
  const base = `/v1/organizations/${organizationId}`;
  const scope = connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : "";
  const supported = READING_DAYS.includes(days);
  const query = useCachedQuery<PanelReading>(
    supported ? `${base}/ai/monitor?days=${days}&view=panel${scope}` : null,
  );
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      const response = await apiFetch(
        `${base}/ai/monitor-run?days=${days}&view=panel${scope}`,
        { method: "POST" },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Lectura de rentabilidad actualizada.");
      invalidateApiGetCache();
      invalidateCachedQueries(`${base}/ai/monitor`);
      query.reload();
    } catch {
      toast.danger("No se pudo lanzar la lectura por un error de red.");
    } finally {
      setRunning(false);
    }
  }

  const text = query.data?.output.headline ?? query.data?.output.answer ?? null;

  return {
    supported,
    isLoading: supported && query.isLoading,
    text,
    generatedAt: query.data?.generated_at ?? null,
    stale: query.data?.stale,
    running,
    run,
  };
}

/** Navegación entre alcances: la fija el selector del shell, no el panel. */
export type PanelNav = {
  portfolio: () => void;
  client: (organizationId: string) => void;
  clientOfStore: () => void;
  store: (organizationId: string, connectionId: string | null) => void;
};

// ---------------------------------------------------------------------------
// Orden del día de la próxima llamada con el cliente
// ---------------------------------------------------------------------------

type WorkbenchClient = {
  client?: {
    relationship?: {
      next_call: { id: string; title: string; scheduled_at: string | null } | null;
    };
  };
};

type CallsPayload = {
  calls: Array<{
    id: string;
    call_internal_notes?: Array<{ id: string; body: string; created_at: string }>;
  }>;
};

/**
 * "Añadir a la llamada" es una nota interna de la próxima llamada agendada
 * (solo la ve el consultor): no hay un orden del día aparte. Sin llamada
 * agendada no hay a donde llevar el punto, y el botón lo dice en vez de fingir.
 */
export function useCallNotes(organizationId: string) {
  const base = `/v1/organizations/${organizationId}`;
  const workbench = useCachedQuery<WorkbenchClient>(
    `/v1/consultant/daily-workbench?days=30&organizationId=${encodeURIComponent(organizationId)}`,
  );
  const nextCall = workbench.data?.client?.relationship?.next_call ?? null;
  const calls = useCachedQuery<CallsPayload>(nextCall ? `${base}/calls` : null);
  const [adding, setAdding] = useState<string | null>(null);

  async function add(note: string, key: string) {
    if (!nextCall) return;
    setAdding(key);
    try {
      const response = await apiFetch(`${base}/calls/${nextCall.id}/internal-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: note }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Añadido a la próxima llamada.");
      invalidateApiGetCache();
      invalidateCachedQueries(`${base}/calls`);
      calls.reload();
    } catch {
      toast.danger("No se pudo añadir a la llamada por un error de red.");
    } finally {
      setAdding(null);
    }
  }

  const queued = calls.data?.calls.find((call) => call.id === nextCall?.id)?.call_internal_notes ?? [];
  return { nextCall, queued, adding, add };
}

/** "Crear tarea" desde una palanca: trabajo interno del consultor, no visible al cliente. */
export async function createLeverTask(
  organizationId: string,
  title: string,
  description: string,
): Promise<boolean> {
  try {
    const response = await apiFetch(`/v1/organizations/${organizationId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.slice(0, 255),
        description,
        priority: "medium",
        category: "shopify",
        isVisibleToClient: false,
      }),
    });
    if (!response.ok) {
      toast.danger(await readApiError(response));
      return false;
    }
    toast.success("Tarea creada en tu trabajo.");
    invalidateApiGetCache();
    return true;
  } catch {
    toast.danger("No se pudo crear la tarea por un error de red.");
    return false;
  }
}
