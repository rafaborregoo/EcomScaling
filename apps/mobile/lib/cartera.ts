import { refetch, useApi } from "./use-api";
import { CAUTION, c, GOOD } from "./theme";

// Subconjunto de /v1/consultant/daily-workbench (ver apps/web/src/app/consultor/workbench.tsx): la mesa de trabajo del
// consultor. Una sola petición alimenta Hoy, la lista de clientes y el selector de cliente.
export type ActionKind = "critical_alert" | "call_approval" | "ai_proposal" | "unread_message" | "integration_reauth" | "financial_coverage" | "milestone_due";

export type PortfolioAction = {
  id: string;
  kind: ActionKind;
  organization_id: string;
  organization_name: string;
  priority: "urgent" | "high" | "normal";
  title: string;
  due_at: string | null;
  /** Decisión que se toma sin salir de la lista (aprobar o descartar). */
  decision?: { endpoint: string } | null;
};

export type ClientStatus = "urgente" | "revisar" | "vigilar" | "al_dia";

export type PortfolioClient = {
  organization_id: string;
  organization_name: string;
  status: ClientStatus;
  next_action: { title: string } | null;
  critical_alerts: number;
};

export type Workbench = {
  summary: { clients: number; urgent_clients: number; critical_alerts: number; pending_ai_proposals: number; unread_threads: number; pending_call_summaries: number; data_issues: number };
  actions: PortfolioAction[];
  portfolio: PortfolioClient[];
};

export const STATUS: Record<ClientStatus, { label: string; color: string; rank: number }> = {
  urgente: { label: "Urgente", color: c.danger, rank: 0 },
  revisar: { label: "Revisar", color: CAUTION, rank: 1 },
  vigilar: { label: "Vigilar", color: c.muted, rank: 2 },
  al_dia: { label: "Al día", color: GOOD, rank: 3 },
};

const WORKBENCH = "/v1/consultant/daily-workbench?days=30";
export const useWorkbench = () => useApi<Workbench>(WORKBENCH);
/** Tras decidir, completar o revisar algo fuera de Hoy: los números del nav y el semáforo salen de la mesa. */
export const refreshWorkbench = () => refetch(WORKBENCH);

/** Clientes por urgencia y, a igualdad, por nombre. */
export const byUrgency = (list: PortfolioClient[]) => [...list].sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || a.organization_name.localeCompare(b.organization_name));
