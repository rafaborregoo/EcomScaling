/**
 * Reglas puras de Marketing -> Campañas: en que estado esta cada campaña, que
 * resumen sale por cliente y que dice el titular de cada pantalla.
 *
 * Viven aqui porque las usan la API (que agrega la cartera del consultor) y la
 * pantalla (que construye el cliente, la tienda y la vista del cliente) y una
 * cifra o una frase que se calcula dos veces acaba siendo dos frases.
 *
 * Hay DOS voces. La del consultor habla del cliente en tercera persona y de lo
 * que se le escapa; la del cliente habla de lo que sale esta semana y de lo que
 * espera SU decision. El cliente no ve estados internos ("Plan IA", "Sin pieza").
 */

import { panelMoney, panelPct } from "./panel-profitability.js";

// ---------------------------------------------------------------------------
// Estado de una campaña
// ---------------------------------------------------------------------------

export type CampaignOrigin = "staff" | "client" | "ai";
export type CampaignReviewStatus = "pending" | "changes_requested" | "reviewed";

export type CampaignWorkState =
  | "late" // planificada, la fecha paso y no ha salido
  | "plan" // accion de A05 en calendario, por revisar y preparar
  | "nopiece" // planificada sin pieza
  | "review" // pieza en borrador o esperando aprobacion
  | "ready" // pieza aprobada, falta programar
  | "scheduled"
  | "sending"
  | "active"
  | "paused"
  | "sent"
  | "draft"
  | "cancelled";

/** Estados "por venir": los que cuentan para "esta semana" y para lo que se escapa. */
export const UPCOMING_CAMPAIGN_STATES: readonly CampaignWorkState[] = [
  "late",
  "plan",
  "nopiece",
  "review",
  "ready",
  "scheduled",
  "sending",
];

export type CampaignItemFacts = {
  /** Estado del item en el calendario: planned | in_progress | published | completed | cancelled. */
  status: string;
  starts_at: string;
  ends_at?: string | null;
  has_draft: boolean;
  /** Estado de la pieza enlazada: draft | pending_approval | approved | rejected | published. */
  draft_status: string | null;
  /** Estado de la campaña enlazada de Klaviyo ("Scheduled", "Sent"...), si la hay. */
  klaviyo_status: string | null;
  /** effective_status de la campaña Meta enlazada, si la hay. */
  meta_status: string | null;
  is_a05_proposal: boolean;
};

/** Mismo mapeo que la lista de Campañas: Klaviyo habla en ingles y por frases. */
export function klaviyoWorkState(
  status: string | null,
): "draft" | "scheduled" | "sending" | "sent" | "cancelled" {
  const value = (status ?? "").toLowerCase();
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("scheduled") || value.includes("preparing to schedule")) return "scheduled";
  if (
    value.includes("sending") ||
    value.includes("queued") ||
    value.includes("adding") ||
    value.includes("preparing")
  ) {
    return "sending";
  }
  if (value.includes("sent")) return "sent";
  return "draft";
}

export function metaWorkState(status: string | null): CampaignWorkState {
  const value = (status ?? "").toUpperCase();
  if (value === "ACTIVE") return "active";
  if (value === "PAUSED") return "paused";
  if (["ARCHIVED", "DELETED"].includes(value)) return "cancelled";
  if (["PENDING_REVIEW", "IN_PROCESS"].includes(value)) return "review";
  return "draft";
}

/**
 * Estado de trabajo de una campaña del calendario. Si hay campaña real del
 * proveedor enlazada manda ella; si no, se deduce de la pieza y de la fecha.
 */
export function campaignWorkState(facts: CampaignItemFacts, nowMs: number): CampaignWorkState {
  if (facts.status === "cancelled") return "cancelled";
  if (facts.klaviyo_status !== null) return klaviyoWorkState(facts.klaviyo_status);
  if (facts.meta_status !== null) return metaWorkState(facts.meta_status);
  if (["published", "completed"].includes(facts.status)) return "sent";
  const past = Date.parse(facts.ends_at ?? facts.starts_at) < nowMs;
  if (!facts.has_draft) return past ? "late" : facts.is_a05_proposal ? "plan" : "nopiece";
  if (facts.draft_status !== null && ["approved", "published"].includes(facts.draft_status)) {
    return past ? "late" : "ready";
  }
  return past ? "late" : "review";
}

export type CampaignBrief = {
  id: string;
  title: string;
  channel: string;
  starts_at: string;
  state: CampaignWorkState;
  origin: CampaignOrigin;
  review_status: CampaignReviewStatus | null;
  store_id: string | null;
  store_label: string | null;
};

const DAY_MS = 86_400_000;

/** ¿Sale en los proximos 7 dias (hoy incluido)? */
export function isWithinNextDays(startsAt: string, nowMs: number, days = 7): boolean {
  const time = Date.parse(startsAt);
  if (!Number.isFinite(time)) return false;
  // Se mira desde el inicio del dia: una campaña de las 09:00 sigue siendo "de hoy" a las 18:00.
  const startOfToday = nowMs - (nowMs % DAY_MS);
  return time >= startOfToday && time - nowMs <= days * DAY_MS;
}

/** Creada por el cliente y a la espera de que el consultor la revise. */
export function awaitsConsultantReview(brief: Pick<CampaignBrief, "origin" | "review_status">): boolean {
  return brief.origin === "client" && brief.review_status === "pending";
}

/** El consultor pidio cambios y espera al cliente. */
export function awaitsClientChanges(brief: Pick<CampaignBrief, "origin" | "review_status">): boolean {
  return brief.origin === "client" && brief.review_status === "changes_requested";
}

/**
 * ¿Hay que pedirle su visto bueno al cliente? Con consultor, lo que el
 * consultor le prepara y esta en revision; lo que el propio cliente creo no
 * (esa la revisa el consultor). Sin consultor, sus propios borradores sí.
 */
export function needsClientApproval(
  brief: Pick<CampaignBrief, "state" | "origin" | "review_status">,
  clientHasConsultant: boolean,
): boolean {
  if (brief.state !== "review") return false;
  if (!clientHasConsultant) return true;
  return brief.origin !== "client";
}

// ---------------------------------------------------------------------------
// Resumen por cliente y de la cartera
// ---------------------------------------------------------------------------

export type SentRollup = {
  sent: number;
  /** Media ponderada por envios; null si no hubo envios con entregados. */
  open_rate: number | null;
  click_rate: number | null;
  /** EUR atribuidos por Klaviyo: de toda la vida de cada campaña. No se suma con Meta. */
  revenue: number | null;
};

export type ClientCampaignSummary = {
  organization_id: string;
  organization_name: string;
  store_count: number;
  week: CampaignBrief[];
  late: number;
  awaiting_review: number;
  changes_requested: number;
  no_piece_soon: number;
  scheduled: number;
  active_meta: number;
  last_week: SentRollup;
};

export function emptySentRollup(): SentRollup {
  return { sent: 0, open_rate: null, click_rate: null, revenue: null };
}

/** Cuenta lo que importa de las campañas de un cliente. `items` = todas las vivas. */
export function summarizeClientCampaigns(input: {
  organization_id: string;
  organization_name: string;
  store_count: number;
  items: CampaignBrief[];
  last_week: SentRollup;
  nowMs: number;
}): ClientCampaignSummary {
  const upcoming = input.items.filter((item) => UPCOMING_CAMPAIGN_STATES.includes(item.state));
  const week = upcoming
    .filter((item) => item.state !== "late" && isWithinNextDays(item.starts_at, input.nowMs))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  return {
    organization_id: input.organization_id,
    organization_name: input.organization_name,
    store_count: input.store_count,
    week,
    late: input.items.filter((item) => item.state === "late").length,
    awaiting_review: input.items.filter(awaitsConsultantReview).length,
    changes_requested: input.items.filter(awaitsClientChanges).length,
    no_piece_soon: week.filter((item) => item.state === "nopiece" && item.origin !== "client").length,
    scheduled: input.items.filter((item) => item.state === "scheduled").length,
    active_meta: input.items.filter((item) => item.state === "active").length,
    last_week: input.last_week,
  };
}

export type PortfolioCampaignTotals = {
  clients: number;
  clients_with_sends: number;
  week_items: number;
  late: number;
  awaiting_review: number;
  changes_requested: number;
  no_piece_soon: number;
  active_meta: number;
  clients_without_sends: string[];
  last_week: SentRollup;
};

export function aggregatePortfolioCampaigns(clients: ClientCampaignSummary[]): PortfolioCampaignTotals {
  const sentClients = clients.filter((client) => client.last_week.sent > 0);
  const sent = sentClients.reduce((total, client) => total + client.last_week.sent, 0);
  const weighted = (pick: (rollup: SentRollup) => number | null) => {
    const rows = sentClients.filter((client) => pick(client.last_week) !== null);
    const weight = rows.reduce((total, client) => total + client.last_week.sent, 0);
    return weight
      ? rows.reduce((total, client) => total + (pick(client.last_week) as number) * client.last_week.sent, 0) / weight
      : null;
  };
  const revenueRows = sentClients.filter((client) => client.last_week.revenue !== null);
  return {
    clients: clients.length,
    clients_with_sends: clients.filter((client) => client.week.length > 0).length,
    week_items: clients.reduce((total, client) => total + client.week.length, 0),
    late: clients.reduce((total, client) => total + client.late, 0),
    awaiting_review: clients.reduce((total, client) => total + client.awaiting_review, 0),
    changes_requested: clients.reduce((total, client) => total + client.changes_requested, 0),
    no_piece_soon: clients.reduce((total, client) => total + client.no_piece_soon, 0),
    active_meta: clients.reduce((total, client) => total + client.active_meta, 0),
    clients_without_sends: clients.filter((client) => client.week.length === 0).map((client) => client.organization_name),
    last_week: {
      sent,
      open_rate: weighted((rollup) => rollup.open_rate),
      click_rate: weighted((rollup) => rollup.click_rate),
      revenue: revenueRows.length ? revenueRows.reduce((total, client) => total + (client.last_week.revenue as number), 0) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Titulares
// ---------------------------------------------------------------------------

export type CampaignsHeadline = { title: string; detail: string };

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function lastWeekSentence(rollup: SentRollup, currency = "EUR"): string {
  if (rollup.sent === 0) return "La semana pasada no salió ningún email.";
  const parts = [`${rollup.sent} ${plural(rollup.sent, "email", "emails")}`];
  if (rollup.open_rate !== null) parts.push(`${panelPct(rollup.open_rate * 100)} de apertura`);
  const tail = rollup.revenue !== null ? ` y ${panelMoney(rollup.revenue, currency)} atribuidos por Klaviyo` : "";
  return `La semana pasada ${plural(rollup.sent, "salió", "salieron")} ${parts.join(" con ")}${tail}.`;
}

/** Cartera del consultor: lo que han creado los clientes manda; despues, lo que va tarde. */
export function buildPortfolioCampaignsHeadline(
  clients: ClientCampaignSummary[],
  totals: PortfolioCampaignTotals,
): CampaignsHeadline {
  const reviewers = clients.filter((client) => client.awaiting_review > 0).map((client) => client.organization_name);
  let title: string;
  if (reviewers.length === 1) {
    title = `${reviewers[0]} ha creado una campaña que espera tu revisión.`;
  } else if (reviewers.length === 2) {
    title = `${reviewers[0]} y ${reviewers[1]} han creado campañas que esperan tu revisión.`;
  } else if (reviewers.length > 2) {
    title = `${reviewers.length} clientes han creado campañas que esperan tu revisión.`;
  } else if (totals.late > 0) {
    title = `${totals.late} ${plural(totals.late, "campaña va tarde", "campañas van tarde")}.`;
  } else if (totals.no_piece_soon > 0) {
    title = `${totals.no_piece_soon} ${plural(totals.no_piece_soon, "envío de esta semana no tiene pieza", "envíos de esta semana no tienen pieza")}.`;
  } else {
    title = "Tu cartera lleva el calendario al día.";
  }
  const issues = [
    totals.late > 0 ? `${totals.late} ${plural(totals.late, "va tarde", "van tarde")}` : null,
    totals.no_piece_soon > 0 ? `${totals.no_piece_soon} ${plural(totals.no_piece_soon, "no tiene pieza", "no tienen pieza")}` : null,
  ].filter((part): part is string => part !== null);
  const emptyClients = totals.clients_without_sends.length
    ? ` ${totals.clients_without_sends.join(", ")} ${plural(totals.clients_without_sends.length, "no tiene", "no tienen")} nada planificado.`
    : "";
  const detail =
    `Esta semana ${plural(totals.week_items, "sale", "salen")} ${totals.week_items} ${plural(totals.week_items, "envío", "envíos")} en ${totals.clients_with_sends} ${plural(totals.clients_with_sends, "cliente", "clientes")}` +
    (issues.length ? `, ${issues.join(" y ")}` : "") +
    `.${emptyClients} ${lastWeekSentence(totals.last_week)}`;
  return { title, detail };
}

/** Un cliente (todas sus tiendas), voz del consultor. */
export function buildClientCampaignsHeadline(
  summary: ClientCampaignSummary,
  items: CampaignBrief[],
): CampaignsHeadline {
  const fromClient = items.filter(awaitsConsultantReview);
  const late = items.filter((item) => item.state === "late");
  let title: string;
  if (fromClient[0]) {
    title = `${summary.organization_name} ha creado «${fromClient[0].title}» y espera tu revisión${late[0] ? `; además «${late[0].title}» no ha salido` : ""}.`;
  } else if (late[0]) {
    title = `«${late[0].title}» no ha salido.`;
  } else if (summary.no_piece_soon > 0) {
    title = `${summary.no_piece_soon} ${plural(summary.no_piece_soon, "envío de esta semana no tiene pieza", "envíos de esta semana no tienen pieza")}.`;
  } else {
    title = `${summary.organization_name} lleva el calendario al día.`;
  }
  const detail = `Esta semana ${plural(summary.week.length, "sale", "salen")} ${summary.week.length} ${plural(summary.week.length, "envío", "envíos")}. ${lastWeekSentence(summary.last_week)}`;
  return { title, detail };
}

const SPANISH_WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function weekdayOf(iso: string): string {
  return SPANISH_WEEKDAYS[new Date(iso).getUTCDay()] ?? "";
}

/** Una tienda, voz del consultor. `items` = campañas vivas de esa tienda. */
export function buildStoreCampaignsHeadline(
  storeLabel: string,
  items: CampaignBrief[],
  nowMs: number,
): CampaignsHeadline {
  const fromClient = items.filter(awaitsConsultantReview);
  const late = items.filter((item) => item.state === "late");
  const week = items
    .filter((item) => UPCOMING_CAMPAIGN_STATES.includes(item.state) && item.state !== "late" && isWithinNextDays(item.starts_at, nowMs))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const count = (state: CampaignWorkState) => week.filter((item) => item.state === state && item.origin !== "client").length;
  const noPiece = count("nopiece");
  let title: string;
  if (fromClient[0]) {
    title = `«${fromClient[0].title}» la ha creado el cliente y espera tu revisión.`;
  } else if (late[0]) {
    title = `«${late[0].title}» debía salir el ${weekdayOf(late[0].starts_at)} y no ha salido.`;
  } else if (noPiece > 0) {
    title = "Hay envíos de esta semana sin pieza.";
  } else {
    title = `${storeLabel} lleva el calendario al día.`;
  }
  const parts = [
    fromClient.length ? `${fromClient.length} creada por el cliente` : null,
    count("ready") ? `${count("ready")} ${plural(count("ready"), "lista", "listas")}` : null,
    count("scheduled") ? `${count("scheduled")} ${plural(count("scheduled"), "programada", "programadas")}` : null,
    count("review") ? `${count("review")} en revisión del cliente` : null,
    noPiece ? `${noPiece} sin pieza` : null,
  ].filter((part): part is string => part !== null);
  const detail = `Esta semana ${plural(week.length, "sale", "salen")} ${week.length} ${plural(week.length, "envío", "envíos")}: ${parts.length ? parts.join(", ") : "ninguno pendiente"}.`;
  return { title, detail };
}

/** Pantalla del CLIENTE: lo que sale y lo que espera su decision. Nada de estados internos. */
export function buildClientViewCampaignsHeadline(input: {
  clientHasConsultant: boolean;
  /** Lo que sale en 7 dias (sin las que van tarde). */
  weekCount: number;
  /** Piezas que esperan SU visto bueno. */
  pendingApproval: CampaignBrief[];
  /** Lo que el propio cliente creo y el consultor esta revisando. */
  ownUnderReview: CampaignBrief[];
  /** Campaña que se ha retrasado, si la hay. */
  late: CampaignBrief | null;
}): CampaignsHeadline {
  const week = `${input.weekCount} ${plural(input.weekCount, "email", "emails")}`;
  const pending = input.pendingApproval;
  let title: string;
  if (input.weekCount === 0 && pending.length === 0) {
    title = "Esta semana no sale ningún email.";
  } else if (input.clientHasConsultant) {
    title = pending.length
      ? `Esta semana ${plural(input.weekCount, "sale", "salen")} ${week} y ${pending.length} ${plural(pending.length, "necesita", "necesitan")} tu visto bueno.`
      : `Esta semana ${plural(input.weekCount, "sale", "salen")} ${week} y todo está aprobado.`;
  } else {
    title = pending.length === 1
      ? `Esta semana ${plural(input.weekCount, "sale", "salen")} ${week}: «${pending[0]!.title}» está lista para que la apruebes.`
      : pending.length > 1
        ? `Esta semana ${plural(input.weekCount, "sale", "salen")} ${week}: ${pending.length} están listas para que las apruebes.`
        : `Esta semana ${plural(input.weekCount, "sale", "salen")} ${week} y todos están aprobados.`;
  }
  const detailParts: string[] = [];
  if (input.clientHasConsultant) {
    if (input.ownUnderReview[0]) {
      detailParts.push(`Tu consultor está revisando «${input.ownUnderReview[0].title}», la que creaste tú.`);
    }
    if (input.late) detailParts.push(`«${input.late.title}» se retrasó y tu consultor la está recolocando.`);
  } else {
    detailParts.push("Tu asistente escribe los emails y tú decides cuáles salen. Nada se envía sin tu aprobación.");
  }
  return { title, detail: detailParts.join(" ") };
}
