/**
 * Ranking de cuentas de email por urgencia de revision, para la vista de
 * cartera de /klaviyo.
 *
 * Misma regla que los otros dos rankings: NO SABER ES UNA RAZON PARA MIRAR, NO
 * PARA IGNORAR. Una tienda sin conectar produce cero problemas detectados y,
 * con una puntuacion ingenua, acabaria la ultima con aspecto de sana.
 *
 * Lo que cambia respecto a Meta es QUE cuesta dinero. En Meta lo grave es
 * gastar a ciegas: el presupuesto se quema igual de rapido con el pixel
 * apagado. En email lo grave es NO enviar. Una tienda sin flujos activos no
 * pierde dinero, deja de ganarlo todos los dias -- y eso no sale en ningun
 * informe, porque no hay nada de lo que informar. Por eso "sin flujos" pesa
 * aqui lo que "pixel apagado" pesa alli.
 */

export type KlaviyoSignalRow = {
  organization_id: string;
  connection_status: string | null;
  last_sync_at: string | null;
  sync_incomplete: boolean;
  emails_total: number;
  emails_sin_utm: number;
  emails_sin_cuerpo: number;
  flows_active: number;
  campaigns_in_window: number;
  last_send_at: string | null;
  lists: number;
  segments: number;
};

export type KlaviyoAccountInput = KlaviyoSignalRow & {
  organization_name: string;
};

export type KlaviyoTriageReason = {
  text: string;
  weight: number;
  kind: "conexion" | "dato" | "medicion" | "envio" | "contenido";
};

export type TriagedKlaviyoAccount = {
  organization_id: string;
  organization_name: string;
  connection_status: string | null;
  last_sync_at: string | null;
  emails_total: number;
  flows_active: number;
  score: number;
  level: "critica" | "alta" | "media" | "estable";
  reasons: KlaviyoTriageReason[];
  // true cuando el puesto NO sale de como va el email sino de que no se puede
  // leer. La pantalla lo dice distinto.
  blind: boolean;
};

const BROKEN_STATUSES = ["error", "reauthorization_required", "needs_reauth"];

// Dos dias, igual que en Meta: una pasada saltada por un reintento no es un
// problema.
const STALE_SYNC_MS = 48 * 60 * 60 * 1000;

// Un mes sin enviar nada. Mas alla de esto la lista se enfria: la gente olvida
// que se suscribio y los rebotes y quejas suben cuando por fin le escribes.
const SILENT_DAYS = 30;

const CONNECTION_BROKEN_WEIGHT = 50;
const NO_FLOWS_WEIGHT = 40;
const NEVER_CONNECTED_WEIGHT = 30;
const NO_UTM_WEIGHT = 30;
const SYNC_STALE_WEIGHT = 25;
const SILENT_WEIGHT = 20;
const NO_LISTS_WEIGHT = 20;
const CATALOG_INCOMPLETE_WEIGHT = 15;
const BODY_MISSING_WEIGHT = 6;
const BODY_MISSING_MAX = 18;

// Cada umbral vale lo que pesa la señal que le da nombre: quedarse sin flujos
// deja la cuenta en "critica" por si solo, un sync viejo en "alta", un mes sin
// enviar en "media".
const LEVEL_THRESHOLDS: Array<[TriagedKlaviyoAccount["level"], number]> = [
  ["critica", NO_FLOWS_WEIGHT],
  ["alta", SYNC_STALE_WEIGHT],
  ["media", SILENT_WEIGHT],
];

function daysAgo(iso: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(iso)) / (24 * 60 * 60 * 1000));
}

function sinceLabel(iso: string | null, now: Date): string {
  if (!iso) return "nunca";
  const days = daysAgo(iso, now);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

export function triageKlaviyoAccount(
  account: KlaviyoAccountInput,
  now: Date,
): TriagedKlaviyoAccount {
  const reasons: KlaviyoTriageReason[] = [];
  let score = 0;
  let blind = false;

  // --- Lo que impide leer la cuenta ---------------------------------------

  if (account.connection_status === null) {
    score += NEVER_CONNECTED_WEIGHT;
    blind = true;
    reasons.push({
      kind: "conexion",
      weight: NEVER_CONNECTED_WEIGHT,
      text: "No hay ninguna cuenta de Klaviyo conectada.",
    });
  } else if (BROKEN_STATUSES.includes(account.connection_status)) {
    score += CONNECTION_BROKEN_WEIGHT;
    blind = true;
    reasons.push({
      kind: "conexion",
      weight: CONNECTION_BROKEN_WEIGHT,
      text: "La conexión con Klaviyo está rota: no entran datos nuevos.",
    });
  } else {
    const syncAge = account.last_sync_at
      ? now.getTime() - Date.parse(account.last_sync_at)
      : null;

    if (syncAge === null || syncAge > STALE_SYNC_MS) {
      score += SYNC_STALE_WEIGHT;
      blind = true;
      reasons.push({
        kind: "dato",
        weight: SYNC_STALE_WEIGHT,
        text: `Sin sincronizar desde ${sinceLabel(account.last_sync_at, now)}: lo que se ve es viejo.`,
      });
    }
  }

  // El catalogo incompleto se cuenta aparte de la conexion: el sync puede
  // haber terminado "bien" y aun asi haberse dejado recursos.
  if (account.sync_incomplete) {
    score += CATALOG_INCOMPLETE_WEIGHT;
    blind = true;
    reasons.push({
      kind: "dato",
      weight: CATALOG_INCOMPLETE_WEIGHT,
      text: "El último sync se dejó recursos: falta parte del catálogo.",
    });
  }

  // --- Lo que se deja de ganar --------------------------------------------
  //
  // Va antes que la medicion, al reves que en Meta, y a proposito: en email lo
  // primero es que salgan mensajes. Medir bien algo que no se manda no sirve
  // de nada.
  //
  // Solo se afirma "no tiene flujos" cuando el catalogo es fiable. Con la
  // conexion rota o el sync incompleto, 0 flujos puede significar "no los
  // hemos traido" -- el mismo error por el que A12 llego a proponer montar
  // flujos que ya existian.

  if (account.flows_active === 0 && !blind) {
    score += NO_FLOWS_WEIGHT;
    reasons.push({
      kind: "envio",
      weight: NO_FLOWS_WEIGHT,
      text: "Ningún flujo activo: la tienda no envía nada automáticamente.",
    });
  }

  const silentDays = account.last_send_at
    ? daysAgo(account.last_send_at, now)
    : null;

  if (!blind && (silentDays === null || silentDays > SILENT_DAYS)) {
    score += SILENT_WEIGHT;
    reasons.push({
      kind: "envio",
      weight: SILENT_WEIGHT,
      text:
        silentDays === null
          ? "No consta ninguna campaña enviada."
          : `Sin enviar una campaña desde hace ${silentDays} días: la lista se enfría.`,
    });
  }

  if (account.lists === 0 && account.segments === 0 && !blind) {
    score += NO_LISTS_WEIGHT;
    reasons.push({
      kind: "envio",
      weight: NO_LISTS_WEIGHT,
      text: "No hay ninguna lista ni segmento: no hay a quién enviar.",
    });
  }

  // --- Lo que rompe la medicion -------------------------------------------

  if (account.emails_total > 0 && account.emails_sin_utm === account.emails_total) {
    score += NO_UTM_WEIGHT;
    reasons.push({
      kind: "medicion",
      weight: NO_UTM_WEIGHT,
      text: "Ningún email etiqueta sus enlaces: su tráfico llega sin atribuir.",
    });
  } else if (account.emails_sin_utm > 0) {
    score += NO_UTM_WEIGHT / 2;
    reasons.push({
      kind: "medicion",
      weight: NO_UTM_WEIGHT / 2,
      text: `${account.emails_sin_utm} de ${account.emails_total} emails no etiquetan sus enlaces.`,
    });
  }

  // --- Contenido que no podemos leer --------------------------------------

  if (account.emails_sin_cuerpo > 0) {
    const weight = Math.min(
      BODY_MISSING_MAX,
      account.emails_sin_cuerpo * BODY_MISSING_WEIGHT,
    );
    score += weight;
    reasons.push({
      kind: "contenido",
      weight,
      text: `${account.emails_sin_cuerpo} email${
        account.emails_sin_cuerpo === 1 ? "" : "s"
      } sin cuerpo: su plantilla ya no está en Klaviyo.`,
    });
  }

  let level: TriagedKlaviyoAccount["level"] = "estable";
  for (const [candidate, threshold] of LEVEL_THRESHOLDS) {
    if (score >= threshold) {
      level = candidate;
      break;
    }
  }

  return {
    organization_id: account.organization_id,
    organization_name: account.organization_name,
    connection_status: account.connection_status,
    last_sync_at: account.last_sync_at,
    emails_total: account.emails_total,
    flows_active: account.flows_active,
    score,
    level,
    reasons: reasons.sort((a, b) => b.weight - a.weight),
    blind,
  };
}

export function rankKlaviyoAccounts(
  accounts: KlaviyoAccountInput[],
  now: Date,
): TriagedKlaviyoAccount[] {
  return accounts
    .map((account) => triageKlaviyoAccount(account, now))
    .sort(
      (a, b) =>
        b.score - a.score ||
        // A igualdad, primero la que mas emails tiene en juego.
        b.emails_total - a.emails_total ||
        a.organization_name.localeCompare(b.organization_name, "es"),
    );
}
