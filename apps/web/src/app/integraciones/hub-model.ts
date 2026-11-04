// Lo que pinta el hub de /integraciones además de las tiendas: la cola de lo
// que hay que arreglar, el historial de pasadas, qué trae cada bloque y qué
// desbloquea cada permiso. Aparte de los componentes para probarlo sin montar
// la interfaz (hub-model.test.ts).

import { SHOPIFY_SCOPES_USED } from "@e-nora/contracts";
import type { IntegrationConnection, IntegrationProvider, IntegrationSyncRun, IntegrationsResponse } from "./shared";
import {
  explainError,
  explainHealth,
  healthSeverity,
  type Explanation,
  type StoreView,
} from "./store-view-model";

// --- Conexiones antiguas ----------------------------------------------------

export type OldConnection = { provider: string; name: string; connection: IntegrationConnection };

/** Lo que ya no trae datos: programado para borrar, desconectado, o un intento
 *  que falló antes de autorizarse. Es lo que se puede limpiar a mano. */
export function isOldConnection(connection: IntegrationConnection): boolean {
  if (["pending_deletion", "disconnected", "revoked"].includes(connection.status)) return true;
  return connection.status === "error" && !connection.connected_at && !connection.last_sync_at;
}

export function oldConnections(providers: IntegrationProvider[]): OldConnection[] {
  return providers.flatMap((provider) =>
    provider.connections
      .filter(isOldConnection)
      .map((connection) => ({ provider: provider.id, name: provider.name, connection })),
  );
}

/** El nombre de una fila antigua. Un intento guarda `pending:<uuid>` como cuenta,
 *  y eso no es algo que enseñar ni pedir que se teclee. */
export function oldConnectionLabel({ name, connection }: OldConnection): string {
  const account = connection.provider_account_name ?? connection.provider_account_id;
  return !account || account.startsWith("pending:") ? name : account;
}

/** Quita las cuentas de Meta y Klaviyo programadas para borrar de las vistas
 *  vivas: ya no tienen permiso. Las tiendas de Shopify se apartan aparte porque
 *  la tienda sigue en el alcance hasta que se purga. */
export function withoutScheduledAccounts(payload: IntegrationsResponse): IntegrationsResponse {
  return {
    ...payload,
    providers: payload.providers.map((provider) =>
      provider.id === "shopify"
        ? provider
        : { ...provider, connections: provider.connections.filter((item) => item.status !== "pending_deletion") },
    ),
  };
}

// --- Cola de arreglos -----------------------------------------------------

export type FixItem = {
  key: string;
  provider: string;
  /** Tienda afectada; null en conexiones de la cuenta (Instagram, Fathom). */
  store: string | null;
  severity: "bad" | "warn";
  title: string;
  detail: string | null;
  fix: Explanation["fix"];
  connection: IntegrationConnection | null;
  /** Arreglo fuera de NORA (p. ej. conectar Shopify dentro de Klaviyo). */
  href?: string;
  hrefLabel?: string;
};

/**
 * Lo que necesita que alguien haga algo, lo más grave primero. Solo cuenta lo
 * conectado: no tener Klaviyo es una decisión, no una avería. Un OAuth que se
 * está autorizando ahora mismo tampoco entra: está naciendo, no roto.
 */
export function buildFixQueue(
  stores: StoreView[],
  accountProviders: IntegrationProvider[],
  crossChecks: FixItem[] = [],
): FixItem[] {
  const items: Array<FixItem & { rank: number }> = [];
  const push = (
    provider: string,
    providerName: string,
    store: string | null,
    connection: IntegrationConnection,
    explanation: Explanation,
  ) => {
    const rank = healthSeverity(connection.health.status);
    if (explanation.fix === "discard") {
      items.push({ key: `${provider}:${connection.id}`, provider, store, severity: "warn", rank: 1, title: `${providerName}: conexión sin terminar`, detail: explanation.detail, fix: "discard", connection });
      return;
    }
    if (rank === 0 || explanation.fix === "wait" || !explanation.fix) return;
    const error = explainError(connection.latest_sync?.error_message ?? connection.last_error_message);
    const automaticRetry =
      ["meta_ads", "klaviyo"].includes(provider) &&
      connection.status === "error" &&
      explanation.fix === "retry";
    items.push({
      key: `${provider}:${connection.id}`,
      provider,
      store,
      severity: rank >= 4 ? "bad" : "warn",
      rank,
      title: `${providerName}: ${explanation.label.toLowerCase()}`,
      detail: [error?.text, automaticRetry ? explanation.detail : null]
        .filter(Boolean)
        .join(" ") || null,
      fix: explanation.fix,
      connection,
    });
  };

  for (const store of stores) {
    for (const view of store.providers) {
      if (view.attempt === "in_progress") continue;
      for (const connection of view.connections) {
        push(view.provider, view.name, store.name, connection, explainHealth(connection.health, connection, view.provider));
      }
    }
  }
  for (const provider of accountProviders) {
    for (const connection of provider.connections) {
      push(provider.id, provider.name, null, connection, explainHealth(connection.health, connection, provider.id));
    }
  }
  for (const check of crossChecks) items.push({ ...check, rank: check.severity === "bad" ? 4 : 2 });

  return items
    .sort((a, b) => b.rank - a.rank || (a.store ?? "").localeCompare(b.store ?? "", "es"))
    .map(({ rank: _rank, ...item }) => item);
}

/**
 * Klaviyo sin Shopify dentro: sus métricas son solo las de sus propios emails
 * (abrir, clic…). Sin «Placed Order» ni «Started Checkout» no hay carrito
 * abandonado, post-compra ni ingresos atribuidos. `null` = no se sabe todavía.
 */
export function klaviyoReceivesStore(
  metrics: Array<{ name: string; integration?: string | null }> | null,
): boolean | null {
  if (!metrics || metrics.length === 0) return null;
  return metrics.some(
    (metric) =>
      (metric.integration ?? "").toLowerCase().includes("shopify") ||
      metric.name === "Placed Order",
  );
}

// --- Historial y bloques --------------------------------------------------

export type RunMark = "ok" | "partial" | "fail" | "run";

export function runMark(status: string): RunMark {
  if (status === "succeeded" || status === "success") return "ok";
  if (status === "partial") return "partial";
  if (status === "running" || status === "queued" || status === "pending") return "run";
  return "fail";
}

/** Las últimas `size` pasadas, la más antigua a la izquierda. */
export function runHistory(connection: IntegrationConnection | null, size = 14): RunMark[] {
  const runs = connection?.recent_syncs ?? (connection?.latest_sync ? [connection.latest_sync] : []);
  return runs.slice(0, size).reverse().map((run) => runMark(run.status));
}

const BLOCK_LABEL: Record<string, string> = {
  orders: "Pedidos",
  catalog: "Catálogo",
  collections: "Colecciones",
  customers: "Clientes",
  discounts: "Descuentos",
  inventory: "Inventario",
  refunds: "Devoluciones",
  sessions: "Sesiones",
  abandoned_checkouts: "Carritos abandonados",
  marketing_events: "Eventos de marketing",
  insights: "Rendimiento de anuncios",
  insights_demografia: "Edad y sexo",
  insights_hora: "Por hora",
  insights_pais: "Por país",
  insights_plataforma: "Por plataforma",
  flow_daily_series: "Flows por día",
  form_stats: "Formularios",
  segment_series: "Segmentos por día",
};

export function blockLabel(scope: string): string {
  return BLOCK_LABEL[scope] ?? scope.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}

/** Lo último que trajo cada bloque (pedidos, catálogo…), en el orden de llegada. */
export function latestBlocks(connection: IntegrationConnection | null): IntegrationSyncRun[] {
  const seen = new Set<string>();
  const blocks: IntegrationSyncRun[] = [];
  for (const run of connection?.recent_syncs ?? []) {
    if (!run.sync_scope || seen.has(run.sync_scope)) continue;
    seen.add(run.sync_scope);
    blocks.push(run);
  }
  return blocks;
}

// --- Permisos -------------------------------------------------------------

export type PermissionRow = { scope: string; label: string; note?: string; granted: boolean; required: boolean };

const KLAVIYO_SCOPES: Array<Omit<PermissionRow, "granted">> = [
  { scope: "events:read", label: "Eventos", required: true },
  { scope: "metrics:read", label: "Métricas", required: true },
  { scope: "campaigns:read", label: "Campañas", required: true },
  { scope: "flows:read", label: "Flows", required: true },
  { scope: "lists:read", label: "Listas", required: true },
  { scope: "segments:read", label: "Segmentos", required: true },
  { scope: "forms:read", label: "Formularios", required: false },
  { scope: "templates:read", label: "Plantillas", required: false },
  { scope: "templates:write", label: "Subir piezas desde Crear", required: false },
  { scope: "campaigns:write", label: "Programar campañas", required: false },
  { scope: "flows:write", label: "Crear flows desde NORA", required: false },
];

/** Qué permisos tiene la conexión y qué desbloquea cada uno. Sin catálogo
 * propio (Meta, Instagram…), los concedidos tal cual. */
export function permissionRows(provider: string, scopes: string[]): PermissionRow[] {
  const granted = new Set(scopes);
  if (provider === "shopify") {
    return SHOPIFY_SCOPES_USED.map((item) => ({ ...item, granted: granted.has(item.scope) }));
  }
  if (provider === "klaviyo") {
    return KLAVIYO_SCOPES.map((item) => ({ ...item, granted: granted.has(item.scope) }));
  }
  return scopes.map((scope) => ({ scope, label: scope, granted: true, required: false }));
}
