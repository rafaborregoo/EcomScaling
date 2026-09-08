/**
 * Ranking de cuentas publicitarias por urgencia de revision, para la vista de
 * cartera de /meta.
 *
 * Misma regla que el ranking de tiendas: NO SABER ES UNA RAZON PARA MIRAR, NO
 * PARA IGNORAR. Una cuenta con la conexion rota o sin sincronizar produce cero
 * problemas detectados, y con una puntuacion ingenua acabaria la ultima, con
 * aspecto de sana.
 *
 * La diferencia con /shopify es de donde salen las señales: aqui no pasan por
 * los agentes. Un pixel que lleva dos dias sin disparar es un hecho contable,
 * no una interpretacion. Eso hace el orden reproducible y explicable sin
 * ensenar la formula, y deja el juicio (si la campaña tiene sentido) donde
 * tiene que estar, que es el consultor.
 *
 * El peso de cada señal es proporcional a lo que cuesta no verla, no a lo
 * llamativa que es. Un pixel apagado gasta presupuesto a ciegas todos los
 * dias; un conjunto en aprendizaje solo entrega peor un rato.
 */

export type MetaSignalRow = {
  organization_id: string;
  ad_accounts: number;
  connection_status: string | null;
  last_sync_at: string | null;
  spend: number;
  days_with_spend: number;
  pixels: number;
  pixels_silent: number;
  ads_with_issues: number;
  ad_sets_learning: number;
  spend_below_average: number;
  spend_with_verdict: number;
  recent_changes: number;
};

export type MetaAccountInput = MetaSignalRow & {
  organization_name: string;
};

export type MetaTriageReason = {
  text: string;
  weight: number;
  kind: "conexion" | "dato" | "medicion" | "entrega" | "dinero";
};

export type TriagedMetaAccount = {
  organization_id: string;
  organization_name: string;
  connection_status: string | null;
  last_sync_at: string | null;
  spend: number;
  ad_accounts: number;
  score: number;
  level: "critica" | "alta" | "media" | "estable";
  reasons: MetaTriageReason[];
  // Cuando es true, el puesto NO sale de como va la publicidad sino de que no
  // se puede leer. La pantalla lo dice distinto: "no sabemos como va" no es lo
  // mismo que "va mal".
  blind: boolean;
};

const BROKEN_STATUSES = ["error", "reauthorization_required", "needs_reauth"];

// Dos dias, igual que el aviso de frescura: un bloque puede saltarse una pasada
// por un reintento sin que eso sea un problema.
const STALE_SYNC_MS = 48 * 60 * 60 * 1000;

const CONNECTION_BROKEN_WEIGHT = 50;
const SYNC_STALE_WEIGHT = 25;
const NEVER_CONNECTED_WEIGHT = 30;
const PIXEL_SILENT_WEIGHT = 40;
const NO_PIXEL_WEIGHT = 20;
const AD_ISSUE_WEIGHT = 8;
const AD_ISSUE_MAX = 24;
const LEARNING_WEIGHT = 4;
const LEARNING_MAX = 16;
const BAD_SPEND_WEIGHT = 30;
const CHANGES_WEIGHT = 6;

// Gasto detras de creatividades que Meta marca por debajo de la media, a
// partir del cual deja de ser un detalle y pasa a ser el tema de la reunion.
const BAD_SPEND_SHARE = 0.3;

// Muchos cambios en una semana suele significar que alguien esta tocando a
// ciegas -- y cada cambio reinicia el aprendizaje.
const CHANGES_THRESHOLD = 15;

// Cada umbral vale lo que pesa la señal que le da nombre: un pixel apagado deja
// la cuenta en "critica" por si solo, un sync viejo en "alta", un puñado de
// anuncios rechazados en "media".
const LEVEL_THRESHOLDS: Array<[TriagedMetaAccount["level"], number]> = [
  ["critica", PIXEL_SILENT_WEIGHT],
  ["alta", SYNC_STALE_WEIGHT],
  ["media", AD_ISSUE_WEIGHT],
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

function euros(value: number): string {
  return `${Math.round(value).toLocaleString("es-ES")} €`;
}

export function triageMetaAccount(
  account: MetaAccountInput,
  now: Date,
): TriagedMetaAccount {
  const reasons: MetaTriageReason[] = [];
  let score = 0;
  let blind = false;

  // --- Lo que impide leer la cuenta ---------------------------------------

  if (account.connection_status === null) {
    score += NEVER_CONNECTED_WEIGHT;
    blind = true;
    reasons.push({
      kind: "conexion",
      weight: NEVER_CONNECTED_WEIGHT,
      text: "No hay ninguna cuenta de Meta conectada.",
    });
  } else if (BROKEN_STATUSES.includes(account.connection_status)) {
    score += CONNECTION_BROKEN_WEIGHT;
    blind = true;
    reasons.push({
      kind: "conexion",
      weight: CONNECTION_BROKEN_WEIGHT,
      text: "La conexión con Meta está rota: no entran datos nuevos.",
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

  // --- Lo que rompe la medicion -------------------------------------------
  //
  // Va antes que el rendimiento a proposito: sin pixel, las cifras de compras
  // y de ROAS que salen debajo no valen nada, y optimizar sobre ellas es peor
  // que no optimizar.

  if (account.pixels_silent > 0) {
    score += PIXEL_SILENT_WEIGHT;
    blind = true;
    reasons.push({
      kind: "medicion",
      weight: PIXEL_SILENT_WEIGHT,
      text:
        account.pixels_silent === 1
          ? "El píxel lleva más de un día sin disparar: Meta está optimizando a ciegas."
          : `${account.pixels_silent} píxeles llevan más de un día sin disparar.`,
    });
  } else if (account.pixels === 0 && account.spend > 0) {
    // Gasta sin pixel guardado. Puede ser que no lo hayamos traido todavia,
    // pero eso tambien es motivo para mirar.
    score += NO_PIXEL_WEIGHT;
    blind = true;
    reasons.push({
      kind: "medicion",
      weight: NO_PIXEL_WEIGHT,
      text: "Hay gasto pero no consta ningún píxel.",
    });
  }

  // --- Lo que frena la entrega --------------------------------------------

  if (account.ads_with_issues > 0) {
    const weight = Math.min(
      AD_ISSUE_MAX,
      account.ads_with_issues * AD_ISSUE_WEIGHT,
    );
    score += weight;
    reasons.push({
      kind: "entrega",
      weight,
      text:
        account.ads_with_issues === 1
          ? "1 anuncio con un problema de revisión: no está entregando."
          : `${account.ads_with_issues} anuncios con problemas de revisión.`,
    });
  }

  if (account.ad_sets_learning > 0) {
    const weight = Math.min(
      LEARNING_MAX,
      account.ad_sets_learning * LEARNING_WEIGHT,
    );
    score += weight;
    reasons.push({
      kind: "entrega",
      weight,
      text: `${account.ad_sets_learning} conjunto${
        account.ad_sets_learning === 1 ? "" : "s"
      } en fase de aprendizaje: entregan peor mientras dure.`,
    });
  }

  if (account.recent_changes >= CHANGES_THRESHOLD) {
    score += CHANGES_WEIGHT;
    reasons.push({
      kind: "entrega",
      weight: CHANGES_WEIGHT,
      text: `${account.recent_changes} cambios en la última semana: cada uno puede reiniciar el aprendizaje.`,
    });
  }

  // --- Donde va el dinero --------------------------------------------------

  const share =
    account.spend_with_verdict > 0
      ? account.spend_below_average / account.spend_with_verdict
      : null;

  if (share !== null && share >= BAD_SPEND_SHARE) {
    score += BAD_SPEND_WEIGHT;
    reasons.push({
      kind: "dinero",
      weight: BAD_SPEND_WEIGHT,
      text: `${euros(account.spend_below_average)} (${Math.round(
        share * 100,
      )}% del gasto juzgado) detrás de creatividades que Meta pone por debajo de la media.`,
    });
  }

  let level: TriagedMetaAccount["level"] = "estable";
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
    spend: account.spend,
    ad_accounts: account.ad_accounts,
    score,
    level,
    reasons: reasons.sort((a, b) => b.weight - a.weight),
    blind,
  };
}

export function rankMetaAccounts(
  accounts: MetaAccountInput[],
  now: Date,
): TriagedMetaAccount[] {
  return accounts
    .map((account) => triageMetaAccount(account, now))
    .sort(
      (a, b) =>
        b.score - a.score ||
        // A igualdad de puntuacion manda el gasto: si dos cuentas estan igual
        // de mal, la que quema mas dinero se mira antes.
        b.spend - a.spend ||
        a.organization_name.localeCompare(b.organization_name, "es"),
    );
}
