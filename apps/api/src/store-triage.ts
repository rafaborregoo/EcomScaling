/**
 * Ranking de tiendas por urgencia de revision, para la vista general de
 * /shopify.
 *
 * La regla que lo gobierna todo: NO SABER ES UNA RAZON PARA MIRAR, NO PARA
 * IGNORAR. Una tienda con la conexion rota, sin sincronizar o sin analizar
 * produce agentes que no encuentran nada, y con una puntuacion ingenua acabaria
 * la ultima de la lista, con aspecto de sana. Es el mismo engaño que el
 * dashboard con el token caducado: cifras viejas que parecen de hoy. Por eso el
 * silencio puntua alto y el motivo lo dice con todas las letras.
 *
 * El calculo es deterministico a proposito. Los agentes ya razonaron: esto solo
 * suma lo que dijeron. Asi el consultor puede ver POR QUE una tienda esta la
 * primera, y dos cargas de la pagina dan el mismo orden.
 */

export type TriageFinding = {
  title: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
};

export type TriageProposal = {
  priority: "low" | "medium" | "high" | "urgent";
};

export type AgentSignal = {
  agentCode: string;
  agentLabel: string;
  ranAt: string;
  findings: TriageFinding[];
  proposals: TriageProposal[];
  confidence: "low" | "medium" | "high";
  warnings: string[];
};

export type StoreInput = {
  connectionId: string;
  organizationId: string;
  organizationName: string;
  storeName: string;
  status: string;
  lastSyncAt: string | null;
  signals: AgentSignal[];
};

export type TriageReason = {
  text: string;
  weight: number;
  kind: "conexion" | "dato" | "hallazgo" | "trabajo" | "silencio";
};

export type TriagedStore = {
  connection_id: string;
  organization_id: string;
  organization_name: string;
  store_name: string;
  status: string;
  last_sync_at: string | null;
  score: number;
  level: "critica" | "alta" | "media" | "estable";
  reasons: TriageReason[];
  analyzed_at: string | null;
  agents_reporting: number;
  // Cuando esto es true, el orden de esta tienda NO sale de su negocio sino de
  // que no se puede leer. La pantalla tiene que decirlo distinto: "no sabemos
  // como va" no es lo mismo que "va mal".
  blind: boolean;
};

const SEVERITY_WEIGHT: Record<TriageFinding["severity"], number> = {
  critical: 40,
  high: 20,
  medium: 8,
  low: 2,
  info: 0,
};

const PRIORITY_WEIGHT: Record<TriageProposal["priority"], number> = {
  urgent: 25,
  high: 12,
  medium: 4,
  low: 1,
};

const BROKEN_STATUSES = ["error", "reauthorization_required", "needs_reauth"];

// Dos dias, igual que el aviso de frescura: un bloque puede saltarse una pasada
// por un reintento sin que eso sea un problema.
const STALE_SYNC_MS = 48 * 60 * 60 * 1000;

// Un analisis de mas de una semana describe una tienda que ya no existe.
const STALE_ANALYSIS_MS = 7 * 24 * 60 * 60 * 1000;

const CONNECTION_BROKEN_WEIGHT = 50;
const SYNC_STALE_WEIGHT = 25;
const NEVER_ANALYZED_WEIGHT = 30;
const STALE_ANALYSIS_WEIGHT = 15;
const LOW_CONFIDENCE_WEIGHT = 10;

// Cada umbral vale exactamente lo que pesa el hallazgo que le da nombre: un
// solo hallazgo `critical` deja la tienda en "critica", uno `high` en "alta",
// uno `medium` en "media". Asi el nivel se puede explicar sin ensenar la
// formula, y no hace falta discutir de donde salio un 60.
const LEVEL_THRESHOLDS: Array<[TriagedStore["level"], number]> = [
  ["critica", SEVERITY_WEIGHT.critical],
  ["alta", SEVERITY_WEIGHT.high],
  ["media", SEVERITY_WEIGHT.medium],
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

export function triageStore(store: StoreInput, now: Date): TriagedStore {
  const reasons: TriageReason[] = [];
  let score = 0;
  let blind = false;

  // --- Lo que impide leer la tienda ---------------------------------------

  if (BROKEN_STATUSES.includes(store.status)) {
    score += CONNECTION_BROKEN_WEIGHT;
    blind = true;
    reasons.push({
      kind: "conexion",
      weight: CONNECTION_BROKEN_WEIGHT,
      text: "La conexión con Shopify está rota: no entran datos nuevos.",
    });
  }

  const syncAge = store.lastSyncAt
    ? now.getTime() - Date.parse(store.lastSyncAt)
    : null;

  if (syncAge === null || syncAge > STALE_SYNC_MS) {
    score += SYNC_STALE_WEIGHT;
    blind = true;
    reasons.push({
      kind: "dato",
      weight: SYNC_STALE_WEIGHT,
      text: `Sin sincronizar desde ${sinceLabel(store.lastSyncAt, now)}: lo que se ve es viejo.`,
    });
  }

  // --- Lo que dicen los agentes -------------------------------------------

  const ranAts = store.signals
    .map((signal) => Date.parse(signal.ranAt))
    .filter((value) => !Number.isNaN(value));
  const analyzedAt = ranAts.length ? new Date(Math.max(...ranAts)) : null;

  if (!store.signals.length) {
    score += NEVER_ANALYZED_WEIGHT;
    blind = true;
    reasons.push({
      kind: "silencio",
      weight: NEVER_ANALYZED_WEIGHT,
      text: "Ningún agente ha analizado esta tienda todavía.",
    });
  } else if (
    analyzedAt &&
    now.getTime() - analyzedAt.getTime() > STALE_ANALYSIS_MS
  ) {
    score += STALE_ANALYSIS_WEIGHT;
    reasons.push({
      kind: "silencio",
      weight: STALE_ANALYSIS_WEIGHT,
      text: `El último análisis es de ${sinceLabel(analyzedAt.toISOString(), now)}.`,
    });
  }

  for (const signal of store.signals) {
    for (const finding of signal.findings) {
      const weight = SEVERITY_WEIGHT[finding.severity] ?? 0;
      score += weight;
      // Los `info` no mueven la aguja y llenarian la lista de ruido.
      if (weight > 0) {
        reasons.push({
          kind: "hallazgo",
          weight,
          text: `${signal.agentLabel}: ${finding.title}`,
        });
      }
    }

    let proposalWeight = 0;
    let urgent = 0;
    for (const proposal of signal.proposals) {
      proposalWeight += PRIORITY_WEIGHT[proposal.priority] ?? 0;
      if (proposal.priority === "urgent") urgent += 1;
    }
    score += proposalWeight;

    // Las tareas se resumen en una linea por agente: enumerarlas todas
    // repetiria lo que ya dicen los hallazgos.
    if (urgent > 0) {
      reasons.push({
        kind: "trabajo",
        weight: PRIORITY_WEIGHT.urgent * urgent,
        text: `${signal.agentLabel}: ${urgent} ${urgent === 1 ? "tarea urgente" : "tareas urgentes"} sin abrir.`,
      });
    }
  }

  // Un analisis en el que el propio agente no confia no baja la urgencia: la
  // sube. Significa que hay algo que mirar Y que ni siquiera sabemos bien que.
  const lowConfidence = store.signals.filter(
    (signal) => signal.confidence === "low",
  );
  if (lowConfidence.length) {
    score += LOW_CONFIDENCE_WEIGHT;
    blind = true;
    reasons.push({
      kind: "silencio",
      weight: LOW_CONFIDENCE_WEIGHT,
      text: `${lowConfidence.length === 1 ? "Un análisis no es fiable" : `${lowConfidence.length} análisis no son fiables`}: faltan datos para juzgar la tienda.`,
    });
  }

  const level =
    LEVEL_THRESHOLDS.find(([, threshold]) => score >= threshold)?.[0] ??
    "estable";

  return {
    connection_id: store.connectionId,
    organization_id: store.organizationId,
    organization_name: store.organizationName,
    store_name: store.storeName,
    status: store.status,
    last_sync_at: store.lastSyncAt,
    score,
    level,
    // Lo mas grave primero, y solo tres: la lista existe para decidir a quien
    // llamar hoy, no para leer el diagnostico entero.
    reasons: reasons.sort((a, b) => b.weight - a.weight).slice(0, 3),
    analyzed_at: analyzedAt?.toISOString() ?? null,
    agents_reporting: store.signals.length,
    blind,
  };
}

export function rankStores(stores: StoreInput[], now: Date): TriagedStore[] {
  return stores
    .map((store) => triageStore(store, now))
    .sort(
      (a, b) =>
        b.score - a.score ||
        // A igualdad, primero la que lleva mas tiempo sin mirarse.
        (Date.parse(a.analyzed_at ?? "0") || 0) -
          (Date.parse(b.analyzed_at ?? "0") || 0) ||
        a.store_name.localeCompare(b.store_name),
    );
}
