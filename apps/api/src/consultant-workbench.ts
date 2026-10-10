/**
 * Mesa de trabajo diaria del consultor (docs/PLAN_MESA_TRABAJO_DIARIA_CONSULTOR.md).
 *
 * No hay tabla nueva ni metrica nueva: todo lo que aparece aqui ya existe en
 * alertas, tareas, llamadas, mensajes, conexiones, hitos y propuestas de IA.
 * Lo que faltaba era un sitio donde la siguiente decision este decidida --
 * hoy el consultor la reconstruye saltando entre seis pantallas.
 *
 * El reparto (que sube, que se fusiona con que, a donde lleva cada fila) vive
 * en `buildWorkbench`, puro a proposito: es la logica que se rompe en silencio
 * -- la pantalla seguiria pintando filas, solo que las equivocadas.
 */

export type WorkbenchOrganization = {
  id: string;
  display_name: string;
  store_count: number;
  attention: {
    open_alerts: number;
    critical_alerts: number;
    high_alerts: number;
    oldest_alert_days: number;
    overdue_tasks: number;
    open_tasks: number;
    score: number;
  };
};

export type WorkbenchAlertRow = {
  id: string;
  organization_id: string;
  severity: string;
  status: string;
  title: string;
  first_detected_at: string;
};

export type WorkbenchTaskRow = {
  id: string;
  organization_id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  alert_id: string | null;
  assignee_name: string | null;
};

export type WorkbenchCallRow = {
  id: string;
  organization_id: string;
  title: string;
  scheduled_at: string | null;
  held_at: string | null;
  summary_pending: boolean;
  /** Resumen pendiente que se puede decidir desde la mesa (el mas reciente). */
  pending_summary_id?: string | null;
};

export type WorkbenchProposalRow = {
  organization_id: string;
  title: string;
  rationale: string;
  priority: string;
  phase: string | null;
  evidence: Array<{ label: string; value: string; source?: string | null }>;
  /** Salida del agente que contiene la propuesta y cuantas propuestas vivas tiene. */
  output_id?: string | null;
  sibling_count?: number;
};

export type WorkbenchThreadRow = {
  organization_id: string;
  unread_count: number;
  counterpart_name: string | null;
  last_message_at: string | null;
};

export type WorkbenchConnectionRow = {
  organization_id: string;
  provider: string;
  status: string;
  last_sync_at: string | null;
};

export type WorkbenchMilestoneRow = {
  id: string;
  organization_id: string;
  name: string;
  target_date: string;
  status: string;
  phase_name: string | null;
};

export type WorkbenchCampaignRow = {
  id: string;
  organization_id: string;
  title: string;
  channel: string;
  starts_at: string;
  status: string;
};

export type WorkbenchActionKind =
  | "critical_alert"
  | "overdue_task"
  | "call_approval"
  | "ai_proposal"
  | "unread_message"
  | "integration_reauth"
  | "financial_coverage"
  | "milestone_due";

export type WorkbenchAction = {
  id: string;
  kind: WorkbenchActionKind;
  organization_id: string;
  organization_name: string;
  priority: "urgent" | "high" | "normal";
  title: string;
  reason: string;
  evidence: Array<{ label: string; value: string; source?: string }>;
  due_at: string | null;
  assignee_name: string | null;
  href: string;
  action_label: string;
  /**
   * Decision que se puede tomar sin salir de la mesa: POST { decision:
   * "approved" | "rejected" } a este endpoint. Solo cuando la decision es
   * atomica (un resumen, o la unica propuesta de su salida); si no, se decide
   * en el modulo donde se ven las hermanas.
   */
  decision?: { endpoint: string } | null;
};

export type PortfolioHealthRow = {
  organization_id: string;
  organization_name: string;
  status: "urgente" | "revisar" | "vigilar" | "al_dia";
  next_action: { title: string; href: string; action_label: string } | null;
  open_alerts: number;
  critical_alerts: number;
  open_tasks: number;
  overdue_tasks: number;
  data_issues: string[];
  next_event: { label: string; at: string } | null;
  href: string;
};

export type UpcomingItem = {
  id: string;
  kind: "task" | "milestone" | "campaign" | "call";
  organization_id: string;
  organization_name: string;
  title: string;
  at: string;
  href: string;
};

/** Bloques que pueden caer sin tumbar la mesa (ver `sources` en la respuesta). */
export type WorkbenchSourceKey =
  | "alerts"
  | "tasks"
  | "calls"
  | "proposals"
  | "messages"
  | "connections"
  | "financial"
  | "milestones"
  | "campaigns";

export type WorkbenchSourceState = "ok" | "error";

const DAY_MS = 86_400_000;

/** Ventana de "proximos siete dias" de la mesa. */
export const UPCOMING_DAYS = 7;

/** Un sync mas viejo que esto se declara; no se presenta como dato fresco. */
const STALE_SYNC_DAYS = 3;

const PRIORITY_RANK: Record<WorkbenchAction["priority"], number> = {
  urgent: 0,
  high: 1,
  normal: 2,
};

const TASK_PRIORITY_TO_ACTION: Record<string, WorkbenchAction["priority"]> = {
  urgent: "urgent",
  high: "high",
  medium: "normal",
  low: "normal",
};

const PROVIDER_LABELS: Record<string, string> = {
  shopify: "Shopify",
  meta: "Meta Ads",
  klaviyo: "Klaviyo",
  instagram: "Instagram",
};

function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

function withOrg(path: string, organizationId: string): string {
  return `${path}?organizationId=${organizationId}`;
}

function daysAgo(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  return Math.floor((nowMs - at) / DAY_MS);
}

function formatDate(iso: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return iso;
  return new Date(at).toISOString().slice(0, 10);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * `tier` con los MISMOS tramos que `attentionBadge` del front y que el
 * `portfolio` del overview. Un cliente no puede salir urgente en una pantalla
 * y "al dia" en la de al lado.
 */
export function attentionTier(score: number): PortfolioHealthRow["status"] {
  if (score >= 15) return "urgente";
  if (score >= 5) return "revisar";
  if (score > 0) return "vigilar";
  return "al_dia";
}

export function buildWorkbench(input: {
  organizations: WorkbenchOrganization[];
  alerts: WorkbenchAlertRow[];
  tasks: WorkbenchTaskRow[];
  calls: WorkbenchCallRow[];
  proposals: WorkbenchProposalRow[];
  threads: WorkbenchThreadRow[];
  connections: WorkbenchConnectionRow[];
  /** Organizaciones que SI tienen configuracion financiera guardada. */
  organizationsWithFinancialSettings: string[];
  milestones: WorkbenchMilestoneRow[];
  campaigns: WorkbenchCampaignRow[];
  sources: Record<WorkbenchSourceKey, WorkbenchSourceState>;
  windowDays: 7 | 30 | 90;
  nowMs: number;
}) {
  const {
    organizations,
    alerts,
    tasks,
    calls,
    proposals,
    threads,
    connections,
    milestones,
    campaigns,
    sources,
    windowDays,
    nowMs,
  } = input;

  const orgById = new Map(organizations.map((org) => [org.id, org]));
  const nameOf = (id: string) => orgById.get(id)?.display_name ?? id;
  const inPortfolio = (id: string) => orgById.has(id);
  const financialSet = new Set(input.organizationsWithFinancialSettings);
  const horizonMs = nowMs + UPCOMING_DAYS * DAY_MS;

  const actions: WorkbenchAction[] = [];

  // --- Tareas vencidas ----------------------------------------------------
  // Van antes que las alertas a proposito: una tarea vencida ya es una
  // decision tomada que nadie ejecuto, y arrastra consigo la alerta que la
  // origino (ver dedup mas abajo).
  const openTasks = tasks.filter(
    (task) =>
      inPortfolio(task.organization_id) &&
      ["pending", "in_progress"].includes(task.status),
  );
  const alertById = new Map(alerts.map((alert) => [alert.id, alert]));
  // Una alerta que ya tiene tarea abierta NO ocupa dos filas: se fusiona con
  // la tarea y se declara la relacion como evidencia.
  const alertsCoveredByTask = new Set(
    openTasks.flatMap((task) => (task.alert_id ? [task.alert_id] : [])),
  );

  for (const task of openTasks) {
    const overdue = Boolean(task.due_at && Date.parse(task.due_at) < nowMs);
    if (!overdue) continue;
    const linkedAlert = task.alert_id ? alertById.get(task.alert_id) : null;
    const lateDays = daysAgo(task.due_at, nowMs) ?? 0;
    const evidence: WorkbenchAction["evidence"] = [
      {
        label: "Venció",
        value: lateDays <= 0 ? "hoy" : `hace ${plural(lateDays, "día", "días")}`,
        source: "tareas",
      },
    ];
    if (linkedAlert) {
      evidence.push({
        label: "Alerta vinculada",
        value: `${linkedAlert.title} (${linkedAlert.severity})`,
        source: "alertas",
      });
    }
    actions.push({
      id: `overdue_task:${task.id}`,
      kind: "overdue_task",
      organization_id: task.organization_id,
      organization_name: nameOf(task.organization_id),
      priority:
        lateDays >= 7
          ? "urgent"
          : (TASK_PRIORITY_TO_ACTION[task.priority] ?? "normal"),
      title: `Revisa la tarea vencida: ${task.title}`,
      reason: linkedAlert
        ? "La tarea que abrió esta alerta sigue sin cerrarse."
        : "Comprometida con fecha y sin cerrar.",
      evidence,
      due_at: task.due_at,
      assignee_name: task.assignee_name,
      href: withOrg("/tareas", task.organization_id),
      action_label: "Abrir en Tareas",
    });
  }

  // --- Alertas criticas sin tarea ----------------------------------------
  for (const alert of alerts) {
    if (!inPortfolio(alert.organization_id)) continue;
    if (!["open", "acknowledged"].includes(alert.status)) continue;
    if (!["critical", "high"].includes(alert.severity)) continue;
    if (alertsCoveredByTask.has(alert.id)) continue;
    const age = daysAgo(alert.first_detected_at, nowMs) ?? 0;
    actions.push({
      id: `critical_alert:${alert.id}`,
      kind: "critical_alert",
      organization_id: alert.organization_id,
      organization_name: nameOf(alert.organization_id),
      priority: alert.severity === "critical" ? "urgent" : "high",
      title: `Atiende la alerta: ${alert.title}`,
      reason:
        "Ninguna tarea la está tratando todavía; decide si se ejecuta o se descarta.",
      evidence: [
        {
          label: "Severidad",
          value: alert.severity === "critical" ? "Crítica" : "Alta",
          source: "alertas",
        },
        {
          label: "Abierta",
          value: age <= 0 ? "hoy" : `hace ${plural(age, "día", "días")}`,
          source: "alertas",
        },
      ],
      due_at: null,
      assignee_name: null,
      href: withOrg("/tareas", alert.organization_id),
      action_label: "Abrir en Tareas",
    });
  }

  // --- Resumenes de llamada por aprobar -----------------------------------
  for (const call of calls) {
    if (!inPortfolio(call.organization_id)) continue;
    if (!call.summary_pending) continue;
    const held = call.held_at ? (daysAgo(call.held_at, nowMs) ?? 0) : null;
    actions.push({
      id: `call_approval:${call.id}`,
      kind: "call_approval",
      organization_id: call.organization_id,
      organization_name: nameOf(call.organization_id),
      // Un resumen sin aprobar bloquea lo que el cliente ve de esa llamada.
      priority: held !== null && held >= 3 ? "high" : "normal",
      title: `Aprueba el resumen de la llamada: ${call.title}`,
      reason:
        "El cliente no ve el resumen ni sus compromisos hasta que lo apruebes.",
      evidence: [
        {
          label: "Llamada",
          value: call.held_at ? formatDate(call.held_at) : "sin fecha",
          source: "llamadas",
        },
        ...(held !== null && held > 0
          ? [
              {
                label: "Esperando",
                value: plural(held, "día", "días"),
                source: "llamadas",
              },
            ]
          : []),
      ],
      due_at: null,
      assignee_name: null,
      href: withOrg("/llamadas", call.organization_id),
      action_label: "Revisar en Llamadas",
      decision: call.pending_summary_id
        ? {
            endpoint: `/v1/organizations/${call.organization_id}/call-summaries/${call.pending_summary_id}/decision`,
          }
        : null,
    });
  }

  // --- Propuestas de IA esperando decision humana -------------------------
  // Con una sola propuesta en su salida se decide en la mesa; si no, en /tareas.
  for (const proposal of proposals) {
    if (!inPortfolio(proposal.organization_id)) continue;
    actions.push({
      id: `ai_proposal:${proposal.organization_id}:${proposal.title}`,
      kind: "ai_proposal",
      organization_id: proposal.organization_id,
      organization_name: nameOf(proposal.organization_id),
      priority: proposal.priority === "urgent" ? "high" : "normal",
      title: `Decide sobre la propuesta: ${proposal.title}`,
      reason:
        proposal.rationale ||
        "Propuesta de un agente pendiente de aprobar, editar o descartar.",
      evidence: [
        ...proposal.evidence.slice(0, 2).map((item) => ({
          label: item.label,
          value: item.value,
          ...(item.source ? { source: item.source } : {}),
        })),
        ...(proposal.phase
          ? [{ label: "Fase", value: proposal.phase, source: "camino" }]
          : []),
      ],
      due_at: null,
      assignee_name: null,
      href: withOrg("/tareas", proposal.organization_id),
      action_label: "Decidir en Tareas",
      // Aprobar una salida aprueba todas sus propuestas: desde la mesa solo se
      // decide cuando esta es la unica; con hermanas se decide en /tareas.
      decision:
        proposal.output_id && (proposal.sibling_count ?? 0) === 1
          ? {
              endpoint: `/v1/organizations/${proposal.organization_id}/ai/outputs/${proposal.output_id}/decision`,
            }
          : null,
    });
  }

  // --- Mensajes sin leer --------------------------------------------------
  for (const thread of threads) {
    if (!inPortfolio(thread.organization_id)) continue;
    if (thread.unread_count <= 0) continue;
    const waiting = daysAgo(thread.last_message_at, nowMs);
    actions.push({
      id: `unread_message:${thread.organization_id}`,
      kind: "unread_message",
      organization_id: thread.organization_id,
      organization_name: nameOf(thread.organization_id),
      priority: waiting !== null && waiting >= 2 ? "high" : "normal",
      title: `Responde a ${thread.counterpart_name ?? "tu cliente"}`,
      reason: "Hay mensajes sin leer en el hilo con este cliente.",
      evidence: [
        {
          label: "Sin leer",
          value: String(thread.unread_count),
          source: "mensajes",
        },
        ...(waiting !== null && waiting > 0
          ? [
              {
                label: "Esperando",
                value: plural(waiting, "día", "días"),
                source: "mensajes",
              },
            ]
          : []),
      ],
      due_at: null,
      assignee_name: null,
      href: withOrg("/mensajes", thread.organization_id),
      action_label: "Abrir el hilo",
    });
  }

  // --- Integraciones por reconectar ---------------------------------------
  // Una fila por cliente, no una por conexion: reconectar es una sola visita a
  // /integraciones y tres filas seguidas del mismo cliente tapan la cola.
  const brokenByOrg = new Map<string, string[]>();
  const staleByOrg = new Map<string, string[]>();
  for (const connection of connections) {
    if (!inPortfolio(connection.organization_id)) continue;
    if (
      ["reauthorization_required", "needs_reauth", "error"].includes(
        connection.status,
      )
    ) {
      brokenByOrg.set(connection.organization_id, [
        ...(brokenByOrg.get(connection.organization_id) ?? []),
        providerLabel(connection.provider),
      ]);
      continue;
    }
    const since = daysAgo(connection.last_sync_at, nowMs);
    if (
      ["connected", "syncing"].includes(connection.status) &&
      since !== null &&
      since >= STALE_SYNC_DAYS
    ) {
      staleByOrg.set(connection.organization_id, [
        ...(staleByOrg.get(connection.organization_id) ?? []),
        `${providerLabel(connection.provider)} (${since} días)`,
      ]);
    }
  }

  for (const [organizationId, providers] of brokenByOrg) {
    const unique = [...new Set(providers)];
    actions.push({
      id: `integration_reauth:${organizationId}`,
      kind: "integration_reauth",
      organization_id: organizationId,
      organization_name: nameOf(organizationId),
      // Sin datos no hay diagnostico: esto invalida el resto de la mesa para
      // ese cliente, por eso sube aunque no tenga fecha.
      priority: "urgent",
      title: `Reconecta ${unique.join(" y ")} para recuperar datos`,
      reason:
        "Mientras la conexión esté rota, las cifras de este cliente no se actualizan.",
      evidence: [
        { label: "Canal", value: unique.join(", "), source: "integraciones" },
      ],
      due_at: null,
      assignee_name: null,
      href: withOrg("/integraciones", organizationId),
      action_label: "Abrir Integraciones",
    });
  }

  // --- Configuracion financiera incompleta --------------------------------
  for (const organization of organizations) {
    if (organization.store_count === 0) continue;
    if (financialSet.has(organization.id)) continue;
    actions.push({
      id: `financial_coverage:${organization.id}`,
      kind: "financial_coverage",
      organization_id: organization.id,
      organization_name: organization.display_name,
      priority: "normal",
      title: "Completa los costes para poder leer beneficio y margen",
      reason:
        "Sin configuración financiera no se puede calcular beneficio ni margen; hasta entonces no se muestran.",
      evidence: [
        {
          label: "Tiendas conectadas",
          value: String(organization.store_count),
          source: "integraciones",
        },
      ],
      due_at: null,
      assignee_name: null,
      href: withOrg("/configuracion", organization.id),
      action_label: "Abrir Configuración",
    });
  }

  // --- Hitos que vencen dentro de la ventana ------------------------------
  for (const milestone of milestones) {
    if (!inPortfolio(milestone.organization_id)) continue;
    if (["completed", "skipped", "locked"].includes(milestone.status)) continue;
    const targetMs = Date.parse(`${milestone.target_date}T00:00:00.000Z`);
    if (Number.isNaN(targetMs) || targetMs > horizonMs) continue;
    const late = targetMs < nowMs;
    actions.push({
      id: `milestone_due:${milestone.id}`,
      kind: "milestone_due",
      organization_id: milestone.organization_id,
      organization_name: nameOf(milestone.organization_id),
      priority: late ? "high" : "normal",
      title: late
        ? `Hito pasado de fecha: ${milestone.name}`
        : `Hito a punto de vencer: ${milestone.name}`,
      reason: late
        ? "El compromiso del plan venció y sigue abierto."
        : "Vence dentro de la semana; decide si llega o se replanifica.",
      evidence: [
        { label: "Fecha", value: milestone.target_date, source: "camino" },
        ...(milestone.phase_name
          ? [{ label: "Fase", value: milestone.phase_name, source: "camino" }]
          : []),
      ],
      due_at: new Date(targetMs).toISOString(),
      assignee_name: null,
      href: withOrg("/camino", milestone.organization_id),
      action_label: "Abrir Mi Camino",
    });
  }

  // Orden estable: urgencia declarada, luego lo que ya vencio, luego el
  // cliente que peor va (misma senal de atencion que el resto del producto),
  // luego la fecha mas proxima y el nombre como desempate. El `id` cierra el
  // orden para que dos cargas iguales den la misma lista.
  const dueMs = (action: WorkbenchAction) =>
    action.due_at ? Date.parse(action.due_at) : Number.MAX_SAFE_INTEGER;
  actions.sort((a, b) => {
    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (byPriority !== 0) return byPriority;
    const aOverdue = dueMs(a) < nowMs ? 0 : 1;
    const bOverdue = dueMs(b) < nowMs ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    const scoreA = orgById.get(a.organization_id)?.attention.score ?? 0;
    const scoreB = orgById.get(b.organization_id)?.attention.score ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;
    if (dueMs(a) !== dueMs(b)) return dueMs(a) - dueMs(b);
    const byName = a.organization_name.localeCompare(b.organization_name);
    if (byName !== 0) return byName;
    return a.id.localeCompare(b.id);
  });

  // --- Proximos siete dias ------------------------------------------------
  const upcoming: UpcomingItem[] = [];
  for (const milestone of milestones) {
    if (!inPortfolio(milestone.organization_id)) continue;
    if (["completed", "skipped"].includes(milestone.status)) continue;
    const at = Date.parse(`${milestone.target_date}T00:00:00.000Z`);
    if (Number.isNaN(at) || at > horizonMs) continue;
    upcoming.push({
      id: `milestone:${milestone.id}`,
      kind: "milestone",
      organization_id: milestone.organization_id,
      organization_name: nameOf(milestone.organization_id),
      title: milestone.phase_name
        ? `${milestone.name} · ${milestone.phase_name}`
        : milestone.name,
      at: new Date(at).toISOString(),
      href: withOrg("/camino", milestone.organization_id),
    });
  }
  for (const campaign of campaigns) {
    if (!inPortfolio(campaign.organization_id)) continue;
    const at = Date.parse(campaign.starts_at);
    if (Number.isNaN(at) || at > horizonMs) continue;
    upcoming.push({
      id: `campaign:${campaign.id}`,
      kind: "campaign",
      organization_id: campaign.organization_id,
      organization_name: nameOf(campaign.organization_id),
      title: `${campaign.title} · ${campaign.channel}`,
      at: new Date(at).toISOString(),
      href: withOrg("/planificacion", campaign.organization_id),
    });
  }
  for (const task of openTasks) {
    if (!task.due_at) continue;
    const at = Date.parse(task.due_at);
    if (Number.isNaN(at) || at < nowMs || at > horizonMs) continue;
    upcoming.push({
      id: `task:${task.id}`,
      kind: "task",
      organization_id: task.organization_id,
      organization_name: nameOf(task.organization_id),
      title: task.title,
      at: new Date(at).toISOString(),
      href: withOrg("/tareas", task.organization_id),
    });
  }
  for (const call of calls) {
    if (!inPortfolio(call.organization_id) || !call.scheduled_at) continue;
    const at = Date.parse(call.scheduled_at);
    if (Number.isNaN(at) || at < nowMs || at > horizonMs) continue;
    upcoming.push({
      id: `call:${call.id}`,
      kind: "call",
      organization_id: call.organization_id,
      organization_name: nameOf(call.organization_id),
      title: call.title,
      at: new Date(at).toISOString(),
      href: withOrg("/llamadas", call.organization_id),
    });
  }
  upcoming.sort(
    (a, b) =>
      Date.parse(a.at) - Date.parse(b.at) ||
      a.organization_name.localeCompare(b.organization_name) ||
      a.id.localeCompare(b.id),
  );

  // --- Cartera ------------------------------------------------------------
  const firstActionByOrg = new Map<string, WorkbenchAction>();
  for (const action of actions) {
    if (!firstActionByOrg.has(action.organization_id)) {
      firstActionByOrg.set(action.organization_id, action);
    }
  }

  const nextEventByOrg = new Map<string, UpcomingItem>();
  for (const item of upcoming) {
    if (!nextEventByOrg.has(item.organization_id)) {
      nextEventByOrg.set(item.organization_id, item);
    }
  }

  const UPCOMING_LABELS: Record<UpcomingItem["kind"], string> = {
    task: "Tarea",
    milestone: "Hito",
    campaign: "Campaña",
    call: "Llamada",
  };

  const portfolio: PortfolioHealthRow[] = organizations.map((organization) => {
    const dataIssues: string[] = [];
    const broken = brokenByOrg.get(organization.id);
    if (broken?.length) {
      dataIssues.push(`Reconectar ${[...new Set(broken)].join(", ")}`);
    }
    const stale = staleByOrg.get(organization.id);
    if (stale?.length) {
      dataIssues.push(`Sin sincronizar: ${[...new Set(stale)].join(", ")}`);
    }
    if (organization.store_count === 0) {
      dataIssues.push("Sin tienda conectada");
    } else if (!financialSet.has(organization.id)) {
      dataIssues.push("Sin configuración financiera");
    }
    const first = firstActionByOrg.get(organization.id) ?? null;
    const next = nextEventByOrg.get(organization.id) ?? null;
    return {
      organization_id: organization.id,
      organization_name: organization.display_name,
      status: attentionTier(organization.attention.score),
      next_action: first
        ? {
            title: first.title,
            href: first.href,
            action_label: first.action_label,
          }
        : null,
      open_alerts: organization.attention.open_alerts,
      critical_alerts: organization.attention.critical_alerts,
      open_tasks: organization.attention.open_tasks,
      overdue_tasks: organization.attention.overdue_tasks,
      data_issues: dataIssues,
      next_event: next
        ? { label: `${UPCOMING_LABELS[next.kind]}: ${next.title}`, at: next.at }
        : null,
      href: withOrg("/consultor", organization.id),
    };
  });

  // Mismo orden que el resto del producto: quien peor va, arriba.
  portfolio.sort(
    (a, b) =>
      (orgById.get(b.organization_id)?.attention.score ?? 0) -
        (orgById.get(a.organization_id)?.attention.score ?? 0) ||
      a.organization_name.localeCompare(b.organization_name),
  );

  const urgentClients = new Set(
    actions
      .filter((action) => action.priority === "urgent")
      .map((action) => action.organization_id),
  );
  const countKind = (kind: WorkbenchActionKind) =>
    actions.filter((action) => action.kind === kind).length;

  return {
    window_days: windowDays,
    generated_at: new Date(nowMs).toISOString(),
    summary: {
      clients: organizations.length,
      urgent_clients: urgentClients.size,
      critical_alerts: organizations.reduce(
        (sum, org) => sum + org.attention.critical_alerts,
        0,
      ),
      overdue_tasks: countKind("overdue_task"),
      pending_call_summaries: countKind("call_approval"),
      pending_ai_proposals: countKind("ai_proposal"),
      unread_threads: countKind("unread_message"),
      data_issues: portfolio.reduce(
        (sum, row) => sum + row.data_issues.length,
        0,
      ),
    },
    actions,
    portfolio,
    upcoming,
    sources,
  };
}

/**
 * Desde cuando se cuenta "lo que ha cambiado" en la ficha de un cliente.
 *
 * La revision humana manda, pero solo si cae DENTRO de la ventana: una
 * revision de hace tres meses con la ventana en 7 dias contaria noventa dias
 * de alertas bajo la etiqueta "desde tu revision", que es justo la cifra
 * enganosa que este bloque existe para evitar. En ese caso gana la ventana y
 * la UI lo dice.
 *
 * Solo aplica a la ACTIVIDAD (alertas nacidas, tareas cerradas). Las cifras de
 * negocio siguen comparando ventana contra ventana anterior: un periodo suelto
 * contra otro de distinta longitud inventa una subida o una caida.
 */
export function resolveActivityCut(input: {
  lastReviewedAt: string | null;
  windowStartIso: string;
}): { since: string; kind: "review" | "window" } {
  const { lastReviewedAt, windowStartIso } = input;
  if (!lastReviewedAt) return { since: windowStartIso, kind: "window" };

  const reviewedMs = Date.parse(lastReviewedAt);
  const windowMs = Date.parse(windowStartIso);
  if (Number.isNaN(reviewedMs) || Number.isNaN(windowMs)) {
    return { since: windowStartIso, kind: "window" };
  }

  return reviewedMs > windowMs
    ? { since: lastReviewedAt, kind: "review" }
    : { since: windowStartIso, kind: "window" };
}
